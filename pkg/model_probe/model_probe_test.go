package model_probe

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	settingconfig "github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestMathJudgeUsesOnlyTerminalAnswer(t *testing.T) {
	for _, tc := range []struct{ output, status, answer string }{
		{"There are 6 choices and C(7,2) combinations.\n21", "pass", "21"},
		{`The result is **\boxed{21}**.`, "pass", "21"},
		{"Final: `21.0`", "pass", "21.0"},
		{"Expected 21, but my final answer is 20", "fail", "20"},
		{"21 is the answer, probably", "fail", ""},
		{"The answer is 1/21", "fail", ""},
		{"The answer is 1 / 21", "fail", ""},
		{"The answer is 2e21", "fail", ""},
		{"Final: 1,021", "fail", ""},
		{"Final: 1'021", "fail", ""},
		{"No answer", "fail", ""},
		{"The answer is -21", "fail", "-21"},
	} {
		t.Run(tc.output, func(t *testing.T) {
			status, answer := judgeMath(tc.output, "21")
			assert.Equal(t, tc.status, status)
			assert.Equal(t, tc.answer, answer)
		})
	}
}

func TestDrawingSanitizationPreservesSMILAndRejectsActiveContent(t *testing.T) {
	input := "```html\n<html><script>outside()</script><svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 100 100\" onload=\"alert(1)\"><style>@import url(https://evil.invalid)</style><script>inside()</script><foreignObject><iframe src=\"https://evil.invalid\"/></foreignObject><rect id=\"sheep\" x=\"1\" width=\"20\" height=\"10\" style=\"background:url(https://evil.invalid)\"><animate attributeName=\"x\" values=\"1;20;1\" dur=\"2s\" repeatCount=\"indefinite\"/></rect><use href=\"https://evil.invalid/s.svg#x\"/><use href=\"#sheep\"/><animate attributeName=\"href\" values=\"javascript:alert(1)\"/></svg></html>\n```"
	artifact, err := sanitizeDrawing(input)
	require.NoError(t, err)
	for _, forbidden := range []string{"<script", "onload", "foreignObject", "iframe", "evil.invalid", "javascript:", "attributeName=\"href\"", "style=\""} {
		assert.NotContains(t, artifact, forbidden)
	}
	assert.Contains(t, artifact, `viewBox="0 0 100 100"`)
	assert.Contains(t, artifact, `<animate attributeName="x"`)
	assert.Contains(t, artifact, `href="#sheep"`)
	assert.Contains(t, artifact, "script-src 'none'")
	nested, err := sanitizeDrawing("```svg\n" + `<svg xmlns="http://www.w3.org/2000/svg"><svg viewBox="0 0 80 80"><rect width="80" height="80"/></svg></svg>` + "\n``` trailing explanation")
	require.NoError(t, err)
	assert.Equal(t, 2, strings.Count(nested, "</svg>"), "the complete outer SVG includes its nested viewport")
	for _, bad := range []string{
		"There is no drawing", `<svg><path d="M 0 0"></svg>`,
		`<svg><script>alert(1)</script></svg>`,
		`<svg><rect fill="&external;"/></svg>`,
		`<svg><?xml-stylesheet href="https://evil.invalid"?><rect/></svg>`,
	} {
		_, err := sanitizeDrawing(bad)
		assert.Error(t, err, bad)
	}
}

func TestResponsesParserRequiresCompletionAndIgnoresReasoning(t *testing.T) {
	completed := "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"usage\":{\"input_tokens\":12,\"output_tokens\":4}}}\n\n"
	for _, tc := range []struct {
		name, data, text, errorKind string
		retry                       bool
	}{
		{"reasoning does not contaminate answer", "data: {\"type\":\"response.reasoning_summary_text.delta\",\"delta\":\"21\"}\n\ndata: {\"type\":\"response.output_text.delta\",\"delta\":\"20\"}\n\n" + completed, "20", "", false},
		{"completed response supplies final text", `data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"reasoning","content":[{"type":"output_text","text":"20"}]},{"type":"message","role":"assistant","content":[{"type":"output_text","text":"21"}]}]}}` + "\n\n", "21", "", false},
		{"separate final parts cannot form a new number", `data: {"type":"response.completed","response":{"status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":"2"},{"type":"output_text","text":"1"}]}]}}` + "\n\n", "2\n1", "", false},
		{"done sentinel is not success", "data: {\"type\":\"response.output_text.delta\",\"delta\":\"21\"}\n\ndata: [DONE]\n\n", "21", "incomplete_stream", true},
		{"failure after text remains error", "data: {\"type\":\"response.output_text.delta\",\"delta\":\"21\"}\n\ndata: {\"type\":\"response.failed\",\"response\":{\"error\":{\"code\":\"server_error\"}}}\n\n", "21", "response_failed", true},
		{"incomplete is not passing", "data: {\"type\":\"response.incomplete\"}\n\n", "", "response_failed", false},
		{"top-level error code is retryable", "data: {\"type\":\"error\",\"code\":\"server_error\"}\n\n", "", "response_failed", true},
		{"malformed frame fails closed", "data: not-json\n\n" + completed, "", "invalid_response", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			writer := newResponseCapture(context.Background())
			writer.Header().Set("Content-Type", "text/event-stream")
			// Exercise boundaries split inside UTF-8/JSON/SSE lines.
			for offset := 0; offset < len(tc.data); offset += 7 {
				_, err := writer.Write([]byte(tc.data[offset:min(offset+7, len(tc.data))]))
				require.NoError(t, err)
			}
			result := writer.result()
			assert.Equal(t, tc.text, result.Text)
			assert.Equal(t, tc.errorKind, result.ErrorKind)
			assert.Equal(t, tc.retry, result.Retryable)
		})
	}
	t.Run("HTTP status controls retries without retaining errors", func(t *testing.T) {
		for _, code := range []int{400, 401, 403, 429, 500, 503} {
			writer := newResponseCapture(context.Background())
			writer.WriteHeader(code)
			_, err := writer.Write([]byte(`{"error":{"message":"credential-must-not-be-retained"}}`))
			require.NoError(t, err)
			result := writer.result()
			assert.Equal(t, code == 429 || code >= 500, result.Retryable)
			assert.NotContains(t, result.ErrorDetail, "credential")
		}
	})
	t.Run("output cap cancels parsing", func(t *testing.T) {
		writer := newResponseCapture(context.Background())
		_, err := writer.Write([]byte(strings.Repeat("x", maxResponseBytes+1)))
		require.Error(t, err)
		assert.Equal(t, "output_limit", writer.result().ErrorKind)
	})
}

func TestProbeStreamSeparatesTransportAndAnswerLimits(t *testing.T) {
	t.Run("small answer survives SSE overhead above two MiB", func(t *testing.T) {
		writer := newResponseCapture(context.Background())
		writer.Header().Set("Content-Type", "text/event-stream")
		event := `data: {"type":"response.output_text.delta","delta":"x","padding":"` + strings.Repeat("p", 1024) + "\"}\n\n"
		for range 2048 {
			_, err := writer.Write([]byte(event))
			require.NoError(t, err)
		}
		_, err := fmt.Fprint(writer, "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\"}}\n\n")
		require.NoError(t, err)
		result := writer.result()
		assert.Empty(t, result.ErrorKind)
		assert.Equal(t, strings.Repeat("x", 2048), result.Text)
	})
	t.Run("terminal answer is bounded independently of transport", func(t *testing.T) {
		writer := newResponseCapture(context.Background())
		writer.Header().Set("Content-Type", "text/event-stream")
		_, err := fmt.Fprintf(writer, "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":%q}]}]}}\n\n", strings.Repeat("x", 2*1024*1024+1))
		require.Error(t, err)
		assert.Equal(t, "output_limit", writer.result().ErrorKind)
		assert.Empty(t, writer.result().Text)
	})
}

func TestProbeResourceLimitsAndUsagePresence(t *testing.T) {
	for _, tc := range []struct {
		name, data string
		frames     int
		detail     string
	}{
		{"oversized unfinished event", "data: " + strings.Repeat("x", 8*1024*1024), 1, "event"},
		{"bounded total stream including comments", ": " + strings.Repeat("x", 1024*1024) + "\n\n", 32, "transport"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			capture := newResponseCapture(context.Background())
			defer capture.cancel()
			capture.Header().Set("Content-Type", "text/event-stream")
			var err error
			for range tc.frames {
				_, err = capture.Write([]byte(tc.data))
				if err != nil {
					break
				}
			}
			require.Error(t, err)
			assert.Equal(t, "output_limit", capture.result().ErrorKind)
			assert.Contains(t, capture.result().ErrorDetail, tc.detail)
		})
	}
	for _, tc := range []struct{ name, usage, source string }{
		{"omitted usage remains unknown", "", ""},
		{"reported zero usage is known", `,"usage":{"input_tokens":0,"output_tokens":0}`, "upstream"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			capture := newResponseCapture(context.Background())
			defer capture.cancel()
			_, err := fmt.Fprintf(capture, `{"status":"completed"%s}`, tc.usage)
			require.NoError(t, err)
			assert.Empty(t, capture.result().ErrorKind)
			assert.Equal(t, tc.source, capture.result().UsageSource)
		})
	}
	t.Run("sanitized artifact remains within the persisted size bound", func(t *testing.T) {
		_, err := sanitizeDrawing(`<svg><text>` + strings.Repeat("x", 2*1024*1024-100) + `</text></svg>`)
		require.ErrorIs(t, err, errDrawingTooLarge)
	})
}

func TestProbeExecutionUsesExistingTokenAndDoesNotRetryWrongAnswers(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	previous := model.DB
	model.DB = db
	t.Cleanup(func() { model.DB = previous; SetRelayHandler(nil); require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.ModelProbeRun{}))
	require.NoError(t, db.Create(&model.User{Id: 7, Username: "probe-user", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}).Error)
	token := model.Token{UserId: 7, Key: "test_probe_key", Group: "test-group", UnlimitedQuota: true}
	require.NoError(t, db.Create(&token).Error)
	config := model_probe_setting.ModelProbeSetting{ProbeUserID: 7, TimeoutSeconds: 30, MaxAttempts: 2, MathAnswer: "21"}
	target := model_probe_setting.Target{Group: "test-group", Model: "test-model", Effort: "medium", TokenID: token.Id, Enabled: true, Kinds: []string{"math"}}
	calls := 0
	SetRelayHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		assert.Equal(t, "/v1/responses", r.URL.Path)
		assert.Equal(t, "Bearer sk-test_probe_key", r.Header.Get("Authorization"))
		assert.Equal(t, "127.0.0.1:0", r.RemoteAddr)
		var body map[string]any
		require.NoError(t, common.DecodeJson(r.Body, &body))
		assert.Equal(t, "test-model", body["model"])
		assert.Equal(t, true, body["stream"])
		assert.Equal(t, false, body["store"])
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "data: {\"type\":\"response.completed\",\"response\":{\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"20\"}]}],\"usage\":{\"input_tokens\":10,\"output_tokens\":2}}}\n\n")
	}))
	_, err = executeRun(context.Background(), "task-one", "manual", config, target, "math")
	require.NoError(t, err)
	assert.Equal(t, 1, calls)
	runs, err := model.ListModelProbeRuns(model.ModelProbeRunFilter{IncludeContent: true})
	require.NoError(t, err)
	require.Len(t, runs, 1)
	assert.Equal(t, "fail", runs[0].Status)
	assert.Equal(t, "fail", runs[0].OriginalStatus)
	assert.Equal(t, "21", runs[0].ExpectedAnswer)
	assert.Equal(t, "20", runs[0].OutputText)
	assert.Equal(t, int64(10), runs[0].PromptTokens)
	assert.Equal(t, 1, runs[0].Attempts)
	// A claimed task/kind slot is not executed twice, even after completion.
	_, err = executeRun(context.Background(), "task-one", "manual", config, target, "math")
	require.NoError(t, err)
	assert.Equal(t, 1, calls)

	for _, bad := range []model_probe_setting.Target{
		{Group: "other-group", TokenID: token.Id}, {Group: "auto", TokenID: token.Id}, {Group: "test-group", TokenID: token.Id + 1},
	} {
		result := requestResponse(context.Background(), config, bad, "question", "")
		assert.Equal(t, "configuration", result.ErrorKind)
	}
	otherUser := config
	otherUser.ProbeUserID = 8
	assert.Equal(t, "configuration", requestResponse(context.Background(), otherUser, target, "question", "").ErrorKind)
	assert.Equal(t, 1, calls)

	t.Run("oversized response cancels relay context before cleanup", func(t *testing.T) {
		SetRelayHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			_, err := w.Write([]byte(strings.Repeat("x", 2*1024*1024+1)))
			assert.Error(t, err)
			assert.Error(t, r.Context().Err(), "the upstream request must be cancelled when capture stops")
		}))
		result := requestResponse(context.Background(), config, target, "question", "")
		assert.Equal(t, "output_limit", result.ErrorKind, "local cancellation must retain the original size-limit cause")
	})

	// Rejudging uses the persisted expected answer, not today's configuration.
	run := runs[0]
	require.NoError(t, db.Model(&model.ModelProbeRun{}).Where("id = ?", run.ID).Updates(map[string]any{"status": "pass", "judge_version": "old-judge"}).Error)
	result, err := Reevaluate(24)
	require.NoError(t, err)
	assert.Equal(t, 1, result.Scanned)
	assert.Equal(t, 1, result.Changed)
	rejudged, err := model.GetModelProbeRun(run.ID)
	require.NoError(t, err)
	assert.Equal(t, "fail", rejudged.Status)
	assert.Equal(t, "fail", rejudged.OriginalStatus)
	assert.Equal(t, "21", rejudged.ExpectedAnswer)

	// Deadline cancellation must not become a passing answer, even if a relay
	// ignores its context until it finishes work. The channel synchronizes the
	// fixture without sleeping or timing thresholds.
	ctx, cancel := context.WithCancel(context.Background())
	cancellationObserved := make(chan struct{})
	releaseCleanup := make(chan struct{})
	cleanupFinished := make(chan struct{})
	returned := make(chan responseResult, 1)
	SetRelayHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cancel()
		<-r.Context().Done()
		close(cancellationObserved)
		<-releaseCleanup
		close(cleanupFinished)
	}))
	go func() { returned <- requestResponse(ctx, config, target, "question", "") }()
	<-cancellationObserved
	var timed responseResult
	earlyReturn := false
	select {
	case timed = <-returned:
		earlyReturn = true
		t.Error("probe returned before the relay finished cleanup")
	default:
	}
	close(releaseCleanup)
	if !earlyReturn {
		timed = <-returned
	}
	select {
	case <-cleanupFinished:
	default:
		t.Error("probe result must wait for relay cleanup and billing settlement")
	}
	assert.Equal(t, "timeout", timed.ErrorKind)
	assert.False(t, timed.Retryable)

	require.NoError(t, db.Model(&model.Token{}).Where("id = ?", token.Id).Update("status", common.TokenStatusExhausted).Error)
	resultAfterExhaustion := requestResponse(context.Background(), config, target, "question", "")
	assert.Equal(t, "credential", resultAfterExhaustion.ErrorKind)
	assert.Contains(t, resultAfterExhaustion.ErrorDetail, "quota is exhausted")
	require.NoError(t, db.Model(&model.Token{}).Where("id = ?", token.Id).Update("status", common.TokenStatusEnabled).Error)

	// A user promoted to admin or disabled after configuration cannot be used
	// as an execution identity. This guard also runs between attempts.
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", 7).Update("role", common.RoleAdminUser).Error)
	assert.Equal(t, "configuration", requestResponse(context.Background(), config, target, "question", "").ErrorKind)
	require.NoError(t, db.Model(&model.User{}).Where("id = ?", 7).Updates(map[string]any{"role": common.RoleCommonUser, "status": common.UserStatusDisabled}).Error)
	assert.Equal(t, "configuration", requestResponse(context.Background(), config, target, "question", "").ErrorKind)

	t.Run("overview excludes infrastructure errors and filters groups", func(t *testing.T) {
		setting := settingconfig.GlobalConfig.Get("model_probe_setting").(*model_probe_setting.ModelProbeSetting)
		original := model_probe_setting.GetSetting()
		common.OptionMapRWMutex.Lock()
		setting.Enabled = false
		secretTarget := target
		secretTarget.Group = "private-group"
		setting.Targets = []model_probe_setting.Target{target, secretTarget}
		common.OptionMapRWMutex.Unlock()
		t.Cleanup(func() { common.OptionMapRWMutex.Lock(); *setting = original; common.OptionMapRWMutex.Unlock() })
		now := time.Now().Unix()
		for i, status := range []string{"pass", "error", "running"} {
			run := model.ModelProbeRun{RunKey: fmt.Sprintf("overview-%d", i), TargetKey: targetKey(target), Group: target.Group, Model: target.Model, Kind: "math", Effort: target.Effort, StartedAt: now - 60, TimeoutSeconds: 30}
			claimed, err := model.ClaimModelProbeRun(&run)
			require.NoError(t, err)
			require.True(t, claimed)
			if status == "running" {
				continue
			}
			run.Status, run.FinishedAt, run.LatencyMs = status, now, 100
			updated, err := model.FinishModelProbeRun(&run)
			require.NoError(t, err)
			require.True(t, updated)
		}
		data, err := Overview(24, []string{target.Group})
		require.NoError(t, err)
		require.Len(t, data.Targets, 1)
		stats := data.Targets[0].Math
		assert.Equal(t, 1, stats.Pass)
		assert.Equal(t, 1, stats.Fail)
		assert.Equal(t, 2, stats.Total)
		assert.Equal(t, 2, stats.Error)
		assert.Equal(t, float64(50), stats.PassRate)
		assert.Equal(t, "interrupted", stats.Latest.ErrorKind)
		assert.Equal(t, "pass", stats.LatestPass.Status)
		data, err = Overview(24, []string{})
		require.NoError(t, err)
		assert.Empty(t, data.Targets)
		data, err = Overview(24, nil)
		require.NoError(t, err)
		assert.Len(t, data.Targets, 2)
	})
}
