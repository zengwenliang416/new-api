package controller

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

const deployAgentBaseURL = "http://deploy-agent:8091"

var errDeployNotConfigured = errors.New("rollback is not configured")

// rollbackImagePattern is the only set of images an administrator can switch
// back to. The host rollback script uses the same rule.
var rollbackImagePattern = regexp.MustCompile(`^(?:docker\.io/)?zengwenliang0416/new-api:[0-9a-f]{40}$|^calciumion/new-api:v1\.0\.0-rc\.23$`)

type deploymentReleaseFile struct {
	CurrentImage    string `json:"current_image"`
	PreviousImage   string `json:"previous_image"`
	CurrentVersion  string `json:"current_version"`
	PreviousVersion string `json:"previous_version"`
}

type deploymentRollbackStatus struct {
	State     string `json:"state"`
	StartedAt string `json:"started_at"`
}

type deploymentReleaseView struct {
	CurrentImage      string `json:"current_image"`
	PreviousImage     string `json:"previous_image"`
	CurrentVersion    string `json:"current_version"`
	PreviousVersion   string `json:"previous_version"`
	RollbackAvailable bool   `json:"rollback_available"`
	RollbackState     string `json:"rollback_state"`
	UnavailableReason string `json:"unavailable_reason"`
}

func deploymentStateDir() string {
	if dir := os.Getenv("DEPLOY_STATE_DIR"); dir != "" {
		return dir
	}
	return "/app/deploy-state"
}

func allowedRollbackImage(image string) bool {
	return rollbackImagePattern.MatchString(image)
}

func deployAgentConfigured() bool {
	return os.Getenv("DEPLOY_AGENT_URL") == deployAgentBaseURL && os.Getenv("DEPLOY_AGENT_TOKEN") != ""
}

func deployAgentEndpoint() (string, error) {
	if os.Getenv("DEPLOY_AGENT_URL") != deployAgentBaseURL || os.Getenv("DEPLOY_AGENT_TOKEN") == "" {
		return "", errDeployNotConfigured
	}
	return deployAgentBaseURL + "/rollback", nil
}

func readDeploymentJSON(name string, dest any) error {
	data, err := os.ReadFile(filepath.Join(deploymentStateDir(), name))
	if err != nil {
		return err
	}
	if len(strings.TrimSpace(string(data))) == 0 {
		return io.EOF
	}
	return common.Unmarshal(data, dest)
}

func currentDeploymentView() deploymentReleaseView {
	var release deploymentReleaseFile
	_ = readDeploymentJSON("release.json", &release)
	var status deploymentRollbackStatus
	if err := readDeploymentJSON("rollback-status.json", &status); err != nil || status.State == "" {
		status.State = "idle"
	}
	view := deploymentReleaseView{
		CurrentImage:    release.CurrentImage,
		PreviousImage:   release.PreviousImage,
		CurrentVersion:  release.CurrentVersion,
		PreviousVersion: release.PreviousVersion,
		RollbackState:   status.State,
	}
	if !deployAgentConfigured() {
		view.UnavailableReason = "not_configured"
		return view
	}
	if release.PreviousImage == "" || release.PreviousImage == release.CurrentImage {
		view.UnavailableReason = "no_previous"
		return view
	}
	if !allowedRollbackImage(release.PreviousImage) {
		view.UnavailableReason = "rejected"
		return view
	}
	if status.State == "running" && !rollbackStatusStale(status.StartedAt) {
		return view
	}
	if status.State == "running" {
		view.RollbackState = "failed"
	}
	view.RollbackAvailable = true
	return view
}

func rollbackStatusStale(startedAt string) bool {
	started, err := time.Parse(time.RFC3339, startedAt)
	if err != nil {
		return true
	}
	return time.Since(started) > 15*time.Minute
}

func postDeployRollback(ctx context.Context, endpoint, token string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	client := &http.Client{Timeout: 15 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode != http.StatusAccepted {
		return errors.New("deploy agent rejected the rollback")
	}
	return nil
}

func GetDeploymentRelease(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    currentDeploymentView(),
	})
}

func PostDeploymentRollback(c *gin.Context) {
	view := currentDeploymentView()
	if view.UnavailableReason == "not_configured" {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Rollback is not configured on this server.",
		})
		return
	}
	if !view.RollbackAvailable {
		c.JSON(http.StatusConflict, gin.H{
			"success": false,
			"message": "No previous image is available.",
		})
		return
	}
	endpoint, err := deployAgentEndpoint()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Rollback is not configured on this server.",
		})
		return
	}
	token := os.Getenv("DEPLOY_AGENT_TOKEN")
	if err := postDeployRollback(c.Request.Context(), endpoint, token); err != nil {
		recordManageAudit(c, "deployment.rollback", map[string]any{
			"current_image":  view.CurrentImage,
			"previous_image": view.PreviousImage,
			"result":         "failed",
		})
		c.JSON(http.StatusBadGateway, gin.H{
			"success": false,
			"message": "Rollback failed.",
		})
		return
	}
	recordManageAudit(c, "deployment.rollback", map[string]any{
		"current_image":  view.CurrentImage,
		"previous_image": view.PreviousImage,
		"result":         "started",
	})
	c.JSON(http.StatusAccepted, gin.H{"success": true, "message": ""})
}
