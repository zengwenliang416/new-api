package model_probe

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"math"
	"math/rand/v2"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
)

const TaskType = "model_probe"
const JudgeVersion = "terminal-number-svg-v1"

type DefaultsData struct {
	MathPrompt     string         `json:"math_prompt"`
	MathAnswer     string         `json:"math_answer"`
	DrawingPrompt  string         `json:"drawing_prompt"`
	Instructions   string         `json:"instructions"`
	UserAgent      string         `json:"user_agent"`
	DrawingCatalog DrawingCatalog `json:"drawing_catalog"`
}

type DrawingCatalog struct {
	Vehicles []string `json:"vehicles"`
	Scenes   []string `json:"scenes"`
}

// Defaults is our own deterministic task set, not the reference site's private
// prompt. There are C(6+2-1,2)=21 unordered pairs with repetition.
func Defaults() DefaultsData {
	return DefaultsData{
		MathPrompt:     "有六种不同的糖果。任选两颗，允许选择同一种糖果，且不区分选择顺序。共有多少种不同的选择？请说明推导，最后一行只写答案的阿拉伯数字。",
		MathAnswer:     "21",
		DrawingPrompt:  "请绘制一只小羊乘坐{vehicle}经过{scene}的动画。只返回完整的 SVG（可放在 HTML 中），使用内联 SVG 图形和 SMIL 动画，不使用 JavaScript、外部资源、图片、foreignObject 或 CSS。",
		Instructions:   "Complete the requested task. Put the final answer in the assistant output, not only in reasoning.",
		UserAgent:      "new-api-model-probe/1.0",
		DrawingCatalog: DrawingCatalog{Vehicles: []string{"自行车", "小火车", "热气球", "帆船", "滑板"}, Scenes: []string{"草地", "海边", "雪山", "森林", "星空"}},
	}
}

var relay struct {
	sync.RWMutex
	handler http.Handler
}

// SetRelayHandler receives the fully configured HTTP router. Requests must go
// through TokenAuth, group routing and normal billing, never directly upstream.
func SetRelayHandler(handler http.Handler) {
	relay.Lock()
	defer relay.Unlock()
	relay.handler = handler
}

type Handler struct{}
type taskPayload struct {
	Trigger string `json:"trigger"`
}

func (Handler) Type() string  { return TaskType }
func (Handler) Enabled() bool { return model_probe_setting.GetSetting().Enabled }
func (Handler) Interval() time.Duration {
	return time.Duration(model_probe_setting.GetSetting().IntervalMinutes) * time.Minute
}
func (Handler) NewPayload() any { return taskPayload{Trigger: "scheduled"} }

func StartRun() (*model.SystemTask, bool, error) {
	config := model_probe_setting.GetSetting()
	if !config.Enabled {
		return nil, false, fmt.Errorf("model probes are disabled")
	}
	if err := model_probe_setting.Validate(config); err != nil {
		return nil, false, err
	}
	if err := model.ValidateModelProbeIdentity(config); err != nil {
		return nil, false, err
	}
	relay.RLock()
	ready := relay.handler != nil
	relay.RUnlock()
	if !ready {
		return nil, false, fmt.Errorf("model probe relay is unavailable")
	}
	return service.EnqueueSystemTask(TaskType, taskPayload{Trigger: "manual"})
}

func (Handler) Run(ctx context.Context, task *model.SystemTask, runnerID string) {
	var runErr error
	defer func() {
		if recovered := recover(); recovered != nil {
			runErr = fmt.Errorf("probe execution interrupted")
		}
		status, detail := model.SystemTaskStatusSucceeded, ""
		if runErr != nil {
			status, detail = model.SystemTaskStatusFailed, runErr.Error()
		}
		if err := model.FinishSystemTask(task.TaskID, runnerID, status, nil, detail); err != nil {
			common.SysError("model probe task could not be finalized")
		}
	}()
	config := model_probe_setting.GetSetting()
	if !config.Enabled {
		runErr = fmt.Errorf("model probes are disabled")
		return
	}
	if runErr = model_probe_setting.Validate(config); runErr != nil {
		return
	}
	if runErr = model.ValidateModelProbeIdentity(config); runErr != nil {
		return
	}
	payload := taskPayload{Trigger: "scheduled"}
	if runErr = task.DecodePayload(&payload); runErr != nil {
		return
	}
	if payload.Trigger != "manual" {
		payload.Trigger = "scheduled"
	}
	if _, runErr = model.ExpireModelProbeRuns(time.Now().Unix()); runErr != nil {
		return
	}
	if config.RetentionDays > 0 {
		if runErr = model.DeleteModelProbeRunsBefore(time.Now().Add(-time.Duration(config.RetentionDays) * 24 * time.Hour).Unix()); runErr != nil {
			return
		}
	}
	progress := service.NewSystemTaskProgressReporter(task, runnerID)
	total, processed := 0, 0
	for _, target := range config.Targets {
		if target.Enabled {
			total += len(target.Kinds)
		}
	}
	for _, target := range config.Targets {
		if !target.Enabled {
			continue
		}
		for _, kind := range target.Kinds {
			if runErr = ctx.Err(); runErr != nil {
				return
			}
			// Revocation takes effect between targets and the normal relay checks
			// current token/user validity on every individual request.
			if !model_probe_setting.GetSetting().Enabled {
				runErr = fmt.Errorf("model probes disabled during execution")
				return
			}
			if runErr = executeRun(ctx, task.TaskID, payload.Trigger, config, target, kind); runErr != nil {
				return
			}
			processed++
			progress(processed, total)
		}
	}
}

func targetKey(target model_probe_setting.Target) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(target.Group+"\x00"+target.Model+"\x00"+target.Effort)))
}

func executeRun(ctx context.Context, taskID, trigger string, config model_probe_setting.ModelProbeSetting, target model_probe_setting.Target, kind string) error {
	defaults := Defaults()
	prompt, expected := config.MathPrompt, config.MathAnswer
	vehicle, scene := "", ""
	if prompt == "" {
		prompt = defaults.MathPrompt
	}
	if kind == "drawing" {
		prompt = config.DrawingPrompt
		if prompt == "" {
			prompt = defaults.DrawingPrompt
		}
		vehicle = defaults.DrawingCatalog.Vehicles[rand.IntN(len(defaults.DrawingCatalog.Vehicles))]
		scene = defaults.DrawingCatalog.Scenes[rand.IntN(len(defaults.DrawingCatalog.Scenes))]
		prompt = strings.NewReplacer("{vehicle}", vehicle, "{scene}", scene).Replace(prompt)
		expected = ""
	}
	instructions := config.Instructions
	if instructions == "" {
		instructions = defaults.Instructions
	}
	key := targetKey(target)
	run := model.ModelProbeRun{
		RunKey: fmt.Sprintf("%x", sha256.Sum256([]byte(taskID+"\x00"+key+"\x00"+kind))), TargetKey: key,
		Group: target.Group, Model: target.Model, Effort: target.Effort, Kind: kind,
		StartedAt: time.Now().Unix(), TimeoutSeconds: config.TimeoutSeconds,
		ProbeUserID: config.ProbeUserID, TokenID: target.TokenID,
		Prompt: prompt, Instructions: instructions, ExpectedAnswer: expected, JudgeVersion: JudgeVersion,
		Vehicle: vehicle, Scene: scene, Trigger: trigger,
	}
	claimed, err := model.ClaimModelProbeRun(&run)
	if err != nil || !claimed {
		return err
	}
	started := time.Now()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.TimeoutSeconds)*time.Second)
	defer cancel()
	run.Status = model.ModelProbeStatusError
	for attempt := 1; attempt <= config.MaxAttempts; attempt++ {
		if ctx.Err() != nil {
			run.ErrorKind = "timeout"
			break
		}
		result := requestResponse(ctx, config, target, prompt, instructions)
		run.Attempts = attempt
		run.OutputText, run.FirstTokenMs = result.Text, result.FirstTokenMs
		run.PromptTokens += min(result.InputTokens, math.MaxInt64-run.PromptTokens)
		run.CompletionTokens += min(result.OutputTokens, math.MaxInt64-run.CompletionTokens)
		run.ErrorKind, run.ErrorDetail = result.ErrorKind, result.ErrorDetail
		if result.ErrorKind == "" {
			if kind == "math" {
				run.Status, run.Answer = judgeMath(result.Text, expected)
			} else {
				run.ArtifactHTML, err = sanitizeDrawing(result.Text)
				run.Status = model.ModelProbeStatusPass
				if err != nil {
					run.Status = model.ModelProbeStatusFail
					run.ErrorKind = "invalid_svg"
					if errors.Is(err, errDrawingTooLarge) {
						run.Status, run.ErrorKind = model.ModelProbeStatusError, "output_limit"
						run.ErrorDetail = "Probe drawing exceeded the artifact size limit"
					}
				}
			}
			break // A completed wrong answer is never retried.
		}
		if !result.Retryable || attempt == config.MaxAttempts {
			break
		}
		select {
		case <-ctx.Done():
			run.ErrorKind = "timeout"
		case <-time.After(time.Duration(attempt) * time.Second):
		}
	}
	run.LatencyMs, run.FinishedAt = time.Since(started).Milliseconds(), time.Now().Unix()
	_, err = model.FinishModelProbeRun(&run)
	return err
}

func requestResponse(ctx context.Context, config model_probe_setting.ModelProbeSetting, target model_probe_setting.Target, prompt, instructions string) (result responseResult) {
	if config.ProbeUserID <= 0 || target.TokenID <= 0 {
		return responseResult{ErrorKind: "configuration", ErrorDetail: "Probe identity and token must be configured"}
	}
	var user model.User
	if err := model.DB.Select("id", "role", "status").First(&user, config.ProbeUserID).Error; err != nil || user.Role != common.RoleCommonUser || user.Status != common.UserStatusEnabled {
		return responseResult{ErrorKind: "configuration", ErrorDetail: "Probe identity must be an active ordinary user"}
	}
	token, err := model.GetTokenByIds(target.TokenID, config.ProbeUserID)
	if err != nil || token == nil || token.UserId != config.ProbeUserID || token.Group != target.Group || target.Group == "auto" {
		return responseResult{ErrorKind: "configuration", ErrorDetail: "Probe token must belong to the configured user and exact non-auto group"}
	}
	relay.RLock()
	handler := relay.handler
	relay.RUnlock()
	if handler == nil {
		return responseResult{ErrorKind: "configuration", ErrorDetail: "Probe relay is unavailable"}
	}
	// No synthetic identity or authorization context is injected. The existing
	// token's quota, expiry, model restrictions and IP restrictions all apply.
	body, err := common.Marshal(map[string]any{
		"model": target.Model, "input": prompt, "instructions": instructions,
		"stream": true, "store": false, "reasoning": map[string]any{"effort": target.Effort},
	})
	if err != nil {
		return responseResult{ErrorKind: "configuration"}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "/v1/responses", bytes.NewReader(body))
	if err != nil {
		return responseResult{ErrorKind: "configuration"}
	}
	req.RemoteAddr = "127.0.0.1:0"
	req.Header.Set("Authorization", "Bearer sk-"+strings.TrimPrefix(token.Key, "sk-"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	userAgent := config.UserAgent
	if userAgent == "" {
		userAgent = Defaults().UserAgent
	}
	req.Header.Set("User-Agent", userAgent)
	writer := newResponseCapture(ctx)
	defer writer.cancel()
	req = req.WithContext(writer.ctx)
	defer func() {
		if recover() != nil {
			result = responseResult{ErrorKind: "relay_interrupted"}
		}
	}()
	// Context cancellation stops the upstream request, but the relay still owns
	// settlement and cleanup. Do not release the task lease or start another
	// target until that handler has returned.
	handler.ServeHTTP(writer, req)
	return writer.result()
}

func GetRun(id int64) (*model.ModelProbeRun, error) {
	run, err := model.GetModelProbeRun(id)
	if err != nil {
		return nil, err
	}
	if run.Status == model.ModelProbeStatusRunning && run.StartedAt+int64(run.TimeoutSeconds) < time.Now().Unix() {
		run.Status, run.ErrorKind = model.ModelProbeStatusError, "interrupted"
	}
	return run, nil
}

type ReevaluateResult struct {
	Scanned int `json:"scanned"`
	Changed int `json:"changed"`
}

func Reevaluate(hours int) (ReevaluateResult, error) {
	result := ReevaluateResult{}
	if hours < 1 || hours > 168 {
		return result, fmt.Errorf("hours must be between 1 and 168")
	}
	filter := model.ModelProbeRunFilter{StartTs: time.Now().Add(-time.Duration(hours) * time.Hour).Unix(), Kind: "math", Limit: 500, IncludeContent: true}
	for {
		runs, err := model.ListModelProbeRuns(filter)
		if err != nil {
			return result, err
		}
		for _, run := range runs {
			filter.BeforeID = run.ID
			if run.Status != model.ModelProbeStatusPass && run.Status != model.ModelProbeStatusFail {
				continue
			}
			result.Scanned++
			status, answer := judgeMath(run.OutputText, run.ExpectedAnswer)
			if status == run.Status && answer == run.Answer && run.JudgeVersion == JudgeVersion {
				continue
			}
			changed, err := model.RejudgeModelProbeRun(run.ID, run.Revision, status, answer, run.ExpectedAnswer, JudgeVersion)
			if err != nil {
				return result, err
			}
			if changed {
				result.Changed++
			}
		}
		if len(runs) < filter.Limit {
			return result, nil
		}
	}
}
