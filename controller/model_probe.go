package controller

import (
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	modelprobe "github.com/QuantumNous/new-api/pkg/model_probe"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Public access exposes only the site's generally selectable groups. User
// access additionally honors that user's group grants; admins see all targets.
func modelProbeVisibleGroups(c *gin.Context) ([]string, bool) {
	if c.GetInt("role") >= common.RoleAdminUser {
		return nil, true
	}
	userGroup := c.GetString("user_group")
	if c.GetInt("id") == 0 {
		config := model_probe_setting.GetSetting()
		if !config.Enabled || !config.PublicAccess {
			c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "login is required"})
			return nil, false
		}
		userGroup = ""
	}
	groups := make([]string, 0)
	for group := range service.GetUserUsableGroups(userGroup) {
		if group != "auto" && ratio_setting.ContainsGroupRatio(group) {
			groups = append(groups, group)
		}
	}
	return groups, true
}

func GetModelProbeOverview(c *gin.Context) {
	groups, allowed := modelProbeVisibleGroups(c)
	if !allowed {
		return
	}
	hours, err := strconv.Atoi(c.DefaultQuery("hours", "24"))
	if err != nil || (hours != 24 && hours != 72) {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "hours must be 24 or 72"})
		return
	}
	result, err := modelprobe.Overview(hours, groups)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func visibleModelProbeRun(c *gin.Context) (*model.ModelProbeRun, bool) {
	groups, allowed := modelProbeVisibleGroups(c)
	if !allowed {
		return nil, false
	}
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || id <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid run ID"})
		return nil, false
	}
	run, err := modelprobe.GetRun(id)
	if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && groups != nil && !slices.Contains(groups, run.Group)) {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "probe run not found"})
		return nil, false
	}
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	return run, true
}

func GetModelProbeRun(c *gin.Context) {
	run, allowed := visibleModelProbeRun(c)
	if !allowed {
		return
	}
	// Explicit projection: never serialize credential/account IDs, internal
	// execution keys, or instructions into an ordinary/public run response.
	data := gin.H{
		"id": run.ID, "kind": run.Kind, "group": run.Group, "group_name": run.Group,
		"model": run.Model, "effort": run.Effort, "status": run.Status,
		"started_at": run.StartedAt, "finished_at": run.FinishedAt,
		"latency_ms": run.LatencyMs, "first_token_ms": run.FirstTokenMs,
		"prompt_tokens": run.PromptTokens, "completion_tokens": run.CompletionTokens,
		"attempts": run.Attempts, "answer": run.Answer, "prompt": run.Prompt,
		"output_text": run.OutputText, "artifact_bytes": run.ArtifactBytes,
		"vehicle": run.Vehicle, "scene": run.Scene, "error_kind": run.ErrorKind,
		"judge_version": run.JudgeVersion, "revision": run.Revision,
	}
	if c.GetInt("role") >= common.RoleAdminUser {
		data["trigger"] = run.Trigger
		data["error_detail"] = run.ErrorDetail
		data["original_status"] = run.OriginalStatus
		data["expected_answer"] = run.ExpectedAnswer
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func GetModelProbeArtifact(c *gin.Context) {
	run, allowed := visibleModelProbeRun(c)
	if !allowed {
		return
	}
	if run.Kind != "drawing" || run.ArtifactHTML == "" {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "drawing artifact not found"})
		return
	}
	c.Header("X-Content-Type-Options", "nosniff")
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"html": run.ArtifactHTML}})
}

func RunModelProbe(c *gin.Context) {
	// There are no request-supplied credentials or target overrides: only the
	// root-approved configuration can consume the selected account's quota.
	task, created, err := modelprobe.StartRun()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"task_id": task.TaskID, "created": created, "run_ids": []int64{},
	}})
}

func ReevaluateModelProbes(c *gin.Context) {
	hours, err := strconv.Atoi(c.DefaultQuery("hours", "168"))
	if err != nil || hours < 1 || hours > 168 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "hours must be between 1 and 168"})
		return
	}
	result, err := modelprobe.Reevaluate(hours)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func GetModelProbeCandidates(c *gin.Context) {
	users, tokens, err := model.ModelProbeCredentialCandidates()
	if err != nil {
		common.ApiError(c, err)
		return
	}
	groups := make([]gin.H, 0)
	names := make([]string, 0)
	for name := range ratio_setting.GetGroupRatioCopy() {
		if name != "auto" {
			names = append(names, name)
		}
	}
	slices.Sort(names)
	for _, name := range names {
		groups = append(groups, gin.H{"group": name, "name": name, "description": setting.GetUsableGroupDescription(name)})
	}
	defaults := modelprobe.Defaults()
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"groups": groups, "users": users, "tokens": tokens,
		"defaults": defaults, "drawing_catalog": defaults.DrawingCatalog,
	}})
}

// This deliberately supports only probe options. Calling the general model
// bulk writer for arbitrary keys would bypass the other option validators in
// UpdateOption (payment, authentication and pricing settings).
func UpdateModelProbeOptions(c *gin.Context) {
	var request struct {
		Options map[string]any `json:"options"`
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 256*1024)
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Options) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid probe options"})
		return
	}
	values := make(map[string]string, len(request.Options))
	for key, value := range request.Options {
		if !strings.HasPrefix(key, model_probe_setting.Prefix) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "this endpoint only accepts model probe options"})
			return
		}
		switch value := value.(type) {
		case string:
			values[key] = value
		case bool, float64:
			values[key] = fmt.Sprint(value)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "probe options must be scalar values; targets must be encoded JSON"})
			return
		}
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{}})
}
