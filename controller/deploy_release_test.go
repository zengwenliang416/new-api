package controller

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRollbackImageAllowList(t *testing.T) {
	sha := strings.Repeat("a", 40)
	assert.True(t, allowedRollbackImage("docker.io/zengwenliang0416/new-api:"+sha))
	assert.True(t, allowedRollbackImage("zengwenliang0416/new-api:"+sha))
	assert.True(t, allowedRollbackImage("calciumion/new-api:v1.0.0-rc.23"))
	assert.False(t, allowedRollbackImage("calciumion/new-api:v1.0.0-rc.22"))
	assert.False(t, allowedRollbackImage("docker.io/zengwenliang0416/new-api:latest"))
	assert.False(t, allowedRollbackImage("docker.io/evil/new-api:"+sha))
	assert.False(t, allowedRollbackImage(""))
}

func TestDeployAgentEndpointRejectsOtherTargets(t *testing.T) {
	t.Setenv("DEPLOY_AGENT_URL", "")
	t.Setenv("DEPLOY_AGENT_TOKEN", "")
	_, err := deployAgentEndpoint()
	require.Error(t, err)

	t.Setenv("DEPLOY_AGENT_URL", "http://127.0.0.1:2375")
	t.Setenv("DEPLOY_AGENT_TOKEN", strings.Repeat("ab", 32))
	_, err = deployAgentEndpoint()
	require.Error(t, err)

	t.Setenv("DEPLOY_AGENT_URL", deployAgentBaseURL)
	endpoint, err := deployAgentEndpoint()
	require.NoError(t, err)
	assert.Equal(t, deployAgentBaseURL+"/rollback", endpoint)
}

func TestPostDeployRollbackSendsBearerAndNoBody(t *testing.T) {
	var gotAuth, gotBody, gotPath string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotPath = r.URL.Path
		body, readErr := io.ReadAll(r.Body)
		if readErr != nil {
			t.Errorf("read body: %v", readErr)
		}
		gotBody = string(body)
		w.WriteHeader(http.StatusAccepted)
	}))
	t.Cleanup(server.Close)

	err := postDeployRollback(context.Background(), server.URL+"/rollback", "test-token")
	require.NoError(t, err)
	assert.Equal(t, "Bearer test-token", gotAuth)
	assert.Equal(t, "/rollback", gotPath)
	assert.Empty(t, gotBody)

	rejected := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusForbidden)
	}))
	t.Cleanup(rejected.Close)
	err = postDeployRollback(context.Background(), rejected.URL+"/rollback", "test-token")
	require.Error(t, err)
}

func TestDeploymentReleaseView(t *testing.T) {
	dir := t.TempDir()
	t.Setenv("DEPLOY_STATE_DIR", dir)
	t.Setenv("DEPLOY_AGENT_URL", "")
	t.Setenv("DEPLOY_AGENT_TOKEN", "")
	view := currentDeploymentView()
	assert.Equal(t, "not_configured", view.UnavailableReason)
	assert.False(t, view.RollbackAvailable)

	sha := strings.Repeat("b", 40)
	previous := "docker.io/zengwenliang0416/new-api:" + sha
	current := "docker.io/zengwenliang0416/new-api:" + strings.Repeat("c", 40)
	body, err := common.Marshal(deploymentReleaseFile{
		CurrentImage: current, PreviousImage: previous,
		CurrentVersion: "v1.0.0-rc.41+cccccccccccc", PreviousVersion: "v1.0.0-rc.41+bbbbbbbbbbbb",
	})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "release.json"), body, 0o644))
	t.Setenv("DEPLOY_AGENT_URL", deployAgentBaseURL)
	t.Setenv("DEPLOY_AGENT_TOKEN", strings.Repeat("ab", 32))
	view = currentDeploymentView()
	assert.True(t, view.RollbackAvailable)
	assert.Equal(t, previous, view.PreviousImage)
	assert.Empty(t, view.UnavailableReason)

	require.NoError(t, os.WriteFile(filepath.Join(dir, "release.json"), []byte(`{"previous_image":"evil:latest","current_image":"also-evil"}`), 0o644))
	view = currentDeploymentView()
	assert.False(t, view.RollbackAvailable)
	assert.Equal(t, "rejected", view.UnavailableReason)

	status, err := common.Marshal(deploymentRollbackStatus{State: "running", StartedAt: "2000-01-01T00:00:00Z"})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "rollback-status.json"), status, 0o644))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "release.json"), body, 0o644))
	view = currentDeploymentView()
	assert.Equal(t, "failed", view.RollbackState)
	assert.True(t, view.RollbackAvailable)
}

func TestPostDeploymentRollbackWithoutAgent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("DEPLOY_AGENT_URL", "")
	t.Setenv("DEPLOY_AGENT_TOKEN", "")
	t.Setenv("DEPLOY_STATE_DIR", t.TempDir())
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/deploy/rollback", nil)
	PostDeploymentRollback(ctx)
	assert.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.NotContains(t, recorder.Body.String(), "DEPLOY_AGENT_TOKEN")
}

func TestRollbackScriptPrintsOnlyKnownImages(t *testing.T) {
	script := filepath.Join("..", "ops", "woodpecker", "rollback.sh")
	sha := strings.Repeat("d", 40)
	previous := "docker.io/zengwenliang0416/new-api:" + sha
	dir := t.TempDir()
	body, err := common.Marshal(deploymentReleaseFile{
		CurrentImage:  "docker.io/zengwenliang0416/new-api:" + strings.Repeat("e", 40),
		PreviousImage: previous,
	})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "release.json"), body, 0o644))

	cmd := exec.Command("bash", script, "--print-target")
	cmd.Env = append(os.Environ(), "DEPLOY_STATE_DIR="+dir)
	out, err := cmd.Output()
	require.NoError(t, err)
	assert.Equal(t, previous+"\n", string(out))

	require.NoError(t, os.WriteFile(filepath.Join(dir, "release.json"), []byte(`{"current_image":"docker.io/zengwenliang0416/new-api:`+strings.Repeat("e", 40)+`","previous_image":"docker.io/library/evil:latest"}`), 0o644))
	cmd = exec.Command("bash", script, "--print-target")
	cmd.Env = append(os.Environ(), "DEPLOY_STATE_DIR="+dir)
	err = cmd.Run()
	require.Error(t, err)
}
