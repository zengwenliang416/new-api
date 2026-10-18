package router

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	probe "github.com/QuantumNous/new-api/pkg/model_probe"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/model_probe_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// This fixture uses the production authentication, distributor, relay, billing
// and task handler. Only the external model server is replaced by httptest.
func setupModelProbeRouterTest(t *testing.T) *gin.Engine {
	t.Helper()
	setupRelayRouterTestDB(t)
	require.NoError(t, i18n.Init())
	require.NoError(t, model.DB.AutoMigrate(
		&model.Channel{}, &model.Log{}, &model.UserSubscription{},
		&model.ModelProbeRun{}, &model.SystemTask{}, &model.SystemTaskLock{},
		&model.UserSession{}, &model.AuditLog{}, &model.Option{},
	))
	previousConfig := model_probe_setting.GetSetting()
	previousRatios := ratio_setting.ModelRatio2JSONString()
	require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(`{"gpt-4o-mini":1}`))
	previousMemoryCache, previousBatch := common.MemoryCacheEnabled, common.BatchUpdateEnabled
	previousExport, previousCount := common.DataExportEnabled, constant.CountToken
	previousStreamingTimeout := constant.StreamingTimeout
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	common.MemoryCacheEnabled, common.BatchUpdateEnabled = false, false
	common.DataExportEnabled, constant.CountToken = false, false
	constant.StreamingTimeout = 30
	service.InitHttpClient()
	engine := gin.New()
	engine.Use(gin.Recovery())
	SetRelayRouter(engine)
	SetTaskPluginProtocolRouter(engine)
	SetApiRouter(engine)
	probe.SetRelayHandler(engine)
	t.Cleanup(func() {
		probe.SetRelayHandler(nil)
		common.OptionMapRWMutex.Lock()
		*config.GlobalConfig.Get("model_probe_setting").(*model_probe_setting.ModelProbeSetting) = previousConfig
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
		common.MemoryCacheEnabled, common.BatchUpdateEnabled = previousMemoryCache, previousBatch
		common.DataExportEnabled, constant.CountToken = previousExport, previousCount
		constant.StreamingTimeout = previousStreamingTimeout
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(previousRatios))
	})
	return engine
}

func TestModelProbeRunsThroughAuthenticatedBilledRelay(t *testing.T) {
	for _, tc := range []struct {
		name           string
		answer         string
		upstreamStatus int
		mutation       string
		expectedStatus string
		expectedError  string
		expectedCalls  int32
	}{
		{name: "correct answer", answer: "21", expectedStatus: model.ModelProbeStatusPass, expectedCalls: 1},
		{name: "wrong answer is not retried", answer: "22", expectedStatus: model.ModelProbeStatusFail, expectedCalls: 1},
		{name: "upstream error is not a wrong answer", upstreamStatus: 400, expectedStatus: model.ModelProbeStatusError, expectedError: "http_error", expectedCalls: 1},
		{name: "token belongs to another user", mutation: "owner", expectedStatus: model.ModelProbeStatusError, expectedError: "configuration"},
		{name: "token belongs to another group", mutation: "group", expectedStatus: model.ModelProbeStatusError, expectedError: "configuration"},
		{name: "exhausted account balance", mutation: "balance", expectedStatus: model.ModelProbeStatusError, expectedError: "http_error"},
		{name: "model permission denied", mutation: "model", expectedStatus: model.ModelProbeStatusError, expectedError: "http_error"},
		{name: "expired token", mutation: "expired", expectedStatus: model.ModelProbeStatusError, expectedError: "http_error"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setupModelProbeRouterTest(t)
			var calls atomic.Int32
			upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assert.Equal(t, "/v1/responses", r.URL.Path)
				assert.Equal(t, "Bearer probe-upstream-secret", r.Header.Get("Authorization"))
				var request map[string]any
				assert.NoError(t, common.DecodeJson(r.Body, &request))
				assert.Equal(t, true, request["stream"])
				assert.Equal(t, false, request["store"])
				if tc.upstreamStatus != 0 {
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(tc.upstreamStatus)
					_, _ = w.Write([]byte(`{"error":{"type":"invalid_request_error","message":"upstream rejected probe-upstream-secret"}}`))
					return
				}
				w.Header().Set("Content-Type", "text/event-stream")
				_, _ = fmt.Fprintf(w, "data: {\"type\":\"response.output_text.delta\",\"delta\":%q}\n\n", tc.answer)
				w.(http.Flusher).Flush()
				_, _ = fmt.Fprintf(w, "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_probe\",\"object\":\"response\",\"model\":\"gpt-4o-mini\",\"status\":\"completed\",\"output\":[{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":%q}]}],\"usage\":{\"input_tokens\":100,\"output_tokens\":10,\"total_tokens\":110}}}\n\ndata: [DONE]\n\n", tc.answer)
			}))
			t.Cleanup(upstream.Close)
			user := model.User{Username: "probe-user", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "default", Quota: 10_000_000}
			if tc.mutation == "balance" {
				user.Quota = 0
			}
			require.NoError(t, model.DB.Create(&user).Error)
			token := model.Token{UserId: user.Id, Key: "proberoutertokensecret", Name: "probe", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true, Group: "default"}
			switch tc.mutation {
			case "owner":
				token.UserId = user.Id + 1
			case "group":
				token.Group = "vip"
			case "model":
				token.ModelLimitsEnabled, token.ModelLimits = true, "gpt-4o"
			case "expired":
				token.ExpiredTime = time.Now().Add(-time.Minute).Unix()
			}
			require.NoError(t, model.DB.Create(&token).Error)
			channel := model.Channel{Type: constant.ChannelTypeOpenAI, Key: "probe-upstream-secret", Name: "probe-upstream", BaseURL: &upstream.URL, Models: "gpt-4o-mini", Group: "default", Status: common.ChannelStatusEnabled}
			require.NoError(t, model.DB.Create(&channel).Error)
			require.NoError(t, model.DB.Create(&model.Ability{Group: "default", Model: "gpt-4o-mini", ChannelId: channel.Id, Enabled: true}).Error)
			settings := model_probe_setting.GetSetting()
			settings.Enabled, settings.ProbeUserID, settings.MaxAttempts = true, user.Id, 2
			settings.Targets = []model_probe_setting.Target{{Group: "default", Model: "gpt-4o-mini", Effort: "medium", TokenID: token.Id, Kinds: []string{"math"}, Enabled: true}}
			common.OptionMapRWMutex.Lock()
			*config.GlobalConfig.Get("model_probe_setting").(*model_probe_setting.ModelProbeSetting) = settings
			common.OptionMapRWMutex.Unlock()
			task, _, err := probe.StartRun()
			if tc.mutation == "owner" || tc.mutation == "group" || tc.mutation == "expired" {
				require.Error(t, err, "invalid credentials must be rejected before enqueue")
				assert.Nil(t, task)
				assert.Zero(t, calls.Load())
				var count int64
				require.NoError(t, model.DB.Model(&model.ModelProbeRun{}).Count(&count).Error)
				assert.Zero(t, count)
				return
			}
			require.NoError(t, err)
			claimed, ok, err := model.ClaimSystemTask(task.ID, probe.TaskType, "probe-integration", time.Now().Add(time.Minute).Unix())
			require.NoError(t, err)
			require.True(t, ok)
			probe.Handler{}.Run(context.Background(), claimed, "probe-integration")
			runs, err := model.ListModelProbeRuns(model.ModelProbeRunFilter{IncludeContent: true})
			require.NoError(t, err)
			require.Len(t, runs, 1)
			run := runs[0]
			require.Equal(t, tc.expectedStatus, run.Status, "error kind=%s detail=%s", run.ErrorKind, run.ErrorDetail)
			assert.Equal(t, tc.expectedError, run.ErrorKind)
			assert.Equal(t, tc.expectedCalls, calls.Load())
			assert.Equal(t, 1, run.Attempts)
			assert.NotContains(t, run.ErrorDetail, token.Key)
			assert.NotContains(t, run.ErrorDetail, channel.Key)
			payload, err := common.Marshal(run)
			require.NoError(t, err)
			assert.NotContains(t, string(payload), token.Key)
			assert.NotContains(t, string(payload), channel.Key)
			if tc.expectedStatus != model.ModelProbeStatusError {
				assert.Equal(t, tc.answer, run.Answer)
				assert.EqualValues(t, 100, run.PromptTokens)
				assert.EqualValues(t, 10, run.CompletionTokens)
				var chargedUser model.User
				require.NoError(t, model.DB.First(&chargedUser, user.Id).Error)
				assert.Less(t, chargedUser.Quota, user.Quota, "probe must pay through normal relay billing")
				assert.Positive(t, chargedUser.UsedQuota)
			}
			finished, err := model.GetSystemTaskByTaskID(task.TaskID)
			require.NoError(t, err)
			assert.Equal(t, model.SystemTaskStatusSucceeded, finished.Status)
		})
	}
}

func TestModelProbeAPIAuthorizationAndGroupIsolation(t *testing.T) {
	engine := setupModelProbeRouterTest(t)
	previousGroups := setting.UserUsableGroups2JSONString()
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default"}`))
	t.Cleanup(func() { require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(previousGroups)) })
	common.OptionMapRWMutex.Lock()
	settings := config.GlobalConfig.Get("model_probe_setting").(*model_probe_setting.ModelProbeSetting)
	settings.Enabled, settings.PublicAccess = true, false
	common.OptionMapRWMutex.Unlock()
	credentials := map[string]string{}
	userIDs := map[string]int{}
	for name, role := range map[string]int{"user": common.RoleCommonUser, "admin": common.RoleAdminUser, "root": common.RoleRootUser} {
		user := model.User{Username: "probe-api-" + name, Role: role, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "probe-" + name}
		require.NoError(t, model.DB.Create(&user).Error)
		session := model.UserSession{
			SID: "probe-session-" + name, UserID: user.Id, Version: 1, UserAuthVersion: 1,
			Status: model.UserSessionStatusActive, RefreshHash: "test-refresh-hash-" + name,
			LoginMethod: "password", LastActiveAt: time.Now().Unix(), ExpiresAt: time.Now().Add(time.Hour).Unix(),
		}
		require.NoError(t, model.CreateUserSession(&session))
		token, _, err := service.IssueAccessToken(service.AuthIdentity{UserID: user.Id, SessionID: session.SID, UserAuthVersion: 1, SessionVersion: 1})
		require.NoError(t, err)
		credentials[name] = token
		userIDs[name] = user.Id
	}
	probeToken := model.Token{UserId: userIDs["user"], Key: "candidate-secret-must-stay-private", Name: "Probe candidate", Group: "default", Status: common.TokenStatusEnabled, ExpiredTime: -1, UnlimitedQuota: true}
	require.NoError(t, model.DB.Create(&probeToken).Error)
	common.OptionMapRWMutex.Lock()
	settings.ProbeUserID = userIDs["user"]
	settings.Targets = []model_probe_setting.Target{{Group: "default", Model: "gpt-4o-mini", Effort: "medium", TokenID: probeToken.Id, Kinds: []string{"math"}, Enabled: true}}
	common.OptionMapRWMutex.Unlock()
	runs := map[string]int64{}
	for _, group := range []string{"default", "svip"} {
		run := model.ModelProbeRun{
			RunKey: "api-run-" + group, TargetKey: "api-target-" + group, Group: group,
			Model: "gpt-4o-mini", Effort: "medium", Kind: "drawing", StartedAt: time.Now().Unix(), TimeoutSeconds: 30,
			ProbeUserID: 4321, TokenID: 9876, Instructions: "internal instructions",
			Prompt: "Draw a sheep", OutputText: "<svg></svg>", ArtifactHTML: "<svg></svg>",
			ErrorDetail: "private execution detail", Trigger: "manual",
		}
		claimed, err := model.ClaimModelProbeRun(&run)
		require.NoError(t, err)
		require.True(t, claimed)
		run.Status, run.FinishedAt = model.ModelProbeStatusPass, time.Now().Unix()
		finished, err := model.FinishModelProbeRun(&run)
		require.NoError(t, err)
		require.True(t, finished)
		runs[group] = run.ID
	}
	for _, tc := range []struct {
		name, method, path, credential, origin string
		status                                 int
	}{
		{name: "private overview needs login", method: "GET", path: "/api/model_probe/overview", status: http.StatusUnauthorized},
		{name: "private artifact needs login", method: "GET", path: fmt.Sprintf("/api/model_probe/artifact/%d", runs["default"]), status: http.StatusUnauthorized},
		{name: "allowed group detail", method: "GET", path: fmt.Sprintf("/api/model_probe/runs/%d", runs["default"]), credential: "user", status: http.StatusOK},
		{name: "allowed group artifact", method: "GET", path: fmt.Sprintf("/api/model_probe/artifact/%d", runs["default"]), credential: "user", status: http.StatusOK},
		{name: "other group detail hidden", method: "GET", path: fmt.Sprintf("/api/model_probe/runs/%d", runs["svip"]), credential: "user", status: http.StatusNotFound},
		{name: "other group artifact hidden", method: "GET", path: fmt.Sprintf("/api/model_probe/artifact/%d", runs["svip"]), credential: "user", status: http.StatusNotFound},
		{name: "user cannot run paid probes", method: "POST", path: "/api/model_probe/admin/run", credential: "user", origin: "http://example.com", status: http.StatusForbidden},
		{name: "user cannot rejudge", method: "POST", path: "/api/model_probe/admin/reevaluate", credential: "user", origin: "http://example.com", status: http.StatusForbidden},
		{name: "user cannot read admin detail", method: "GET", path: fmt.Sprintf("/api/model_probe/admin/runs/%d", runs["default"]), credential: "user", status: http.StatusForbidden},
		{name: "admin may read other groups", method: "GET", path: fmt.Sprintf("/api/model_probe/admin/runs/%d", runs["svip"]), credential: "admin", status: http.StatusOK},
		{name: "admin cannot enumerate credentials", method: "GET", path: "/api/model_probe/admin/candidates", credential: "admin", status: http.StatusForbidden},
		{name: "root may list candidates", method: "GET", path: "/api/model_probe/admin/candidates", credential: "root", status: http.StatusOK},
		{name: "admin cannot edit probe credentials", method: "PUT", path: "/api/option/bulk", credential: "admin", origin: "http://example.com", status: http.StatusForbidden},
		{name: "cross-site run blocked", method: "POST", path: "/api/model_probe/admin/run", credential: "admin", origin: "https://attacker.invalid", status: http.StatusForbidden},
		{name: "cross-site settings blocked", method: "PUT", path: "/api/option/bulk", credential: "root", origin: "https://attacker.invalid", status: http.StatusForbidden},
		{name: "missing origin run blocked", method: "POST", path: "/api/model_probe/admin/run", credential: "admin", status: http.StatusForbidden},
		{name: "null origin run blocked", method: "POST", path: "/api/model_probe/admin/run", credential: "admin", origin: "null", status: http.StatusForbidden},
		{name: "origin suffix run blocked", method: "POST", path: "/api/model_probe/admin/run", credential: "admin", origin: "http://example.com.attacker.invalid", status: http.StatusForbidden},
		{name: "same-origin admin may rejudge", method: "POST", path: "/api/model_probe/admin/reevaluate", credential: "admin", origin: "http://example.com", status: http.StatusOK},
		{name: "same-origin admin may enqueue", method: "POST", path: "/api/model_probe/admin/run", credential: "admin", origin: "http://example.com", status: http.StatusOK},
	} {
		t.Run(tc.name, func(t *testing.T) {
			request := httptest.NewRequest(tc.method, tc.path, strings.NewReader(`{}`))
			request.Header.Set("Content-Type", "application/json")
			if tc.credential != "" {
				request.Header.Set("Authorization", "Bearer "+credentials[tc.credential])
			}
			if tc.origin != "" {
				request.Header.Set("Origin", tc.origin)
			}
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			assert.Equal(t, tc.status, response.Code, response.Body.String())
			if tc.credential == "user" && response.Code == http.StatusOK {
				for _, internal := range []string{"token_id", "probe_user_id", "instructions", "error_detail", "private execution detail"} {
					assert.NotContains(t, response.Body.String(), internal)
				}
			}
			if tc.path == "/api/model_probe/admin/candidates" && response.Code == http.StatusOK {
				assert.Contains(t, response.Body.String(), probeToken.Name)
				assert.NotContains(t, response.Body.String(), probeToken.Key)
				assert.NotContains(t, response.Body.String(), `"key":`)
				assert.NotContains(t, response.Body.String(), `"password":`)
			}
		})
	}
	var taskCount int64
	require.NoError(t, model.DB.Model(&model.SystemTask{}).Where("type = ?", probe.TaskType).Count(&taskCount).Error)
	assert.EqualValues(t, 1, taskCount, "only the authenticated same-origin request may enqueue a probe")
	common.OptionMapRWMutex.Lock()
	settings.PublicAccess = true
	common.OptionMapRWMutex.Unlock()
	for group, id := range runs {
		for _, resource := range []string{"runs", "artifact"} {
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, httptest.NewRequest("GET", fmt.Sprintf("/api/model_probe/%s/%d", resource, id), nil))
			expected := http.StatusOK
			if group == "svip" {
				expected = http.StatusNotFound
			}
			assert.Equal(t, expected, response.Code, "public %s of group %s: %s", resource, group, response.Body.String())
		}
	}
	t.Run("root probe options are atomic and remain disableable after credential expiry", func(t *testing.T) {
		updateOptions := func(options map[string]any) *httptest.ResponseRecorder {
			t.Helper()
			body, err := common.Marshal(map[string]any{"options": options})
			require.NoError(t, err)
			request := httptest.NewRequest(http.MethodPut, "/api/option/bulk", strings.NewReader(string(body)))
			request.Header.Set("Content-Type", "application/json")
			request.Header.Set("Authorization", "Bearer "+credentials["root"])
			request.Header.Set("Origin", "http://example.com")
			response := httptest.NewRecorder()
			engine.ServeHTTP(response, request)
			return response
		}
		targets, err := common.Marshal(model_probe_setting.GetSetting().Targets)
		require.NoError(t, err)
		response := updateOptions(map[string]any{
			"model_probe_setting.enabled":          true,
			"model_probe_setting.probe_user_id":    userIDs["user"],
			"model_probe_setting.targets":          string(targets),
			"model_probe_setting.interval_minutes": 30,
			"model_probe_setting.timeout_seconds":  300,
		})
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		baseline := model_probe_setting.GetSetting()
		var savedOptions []model.Option
		require.NoError(t, model.DB.Order("key").Find(&savedOptions).Error)
		for _, invalid := range []map[string]any{
			{"model_probe_setting.interval_minutes": 60, "model_probe_setting.timeout_seconds": 5},
			{"model_probe_setting.interval_minutes": 60, "model_probe_setting.probe_user_id": userIDs["admin"]},
			{"model_probe_setting.interval_minutes": 60, "SystemName": "must-not-change"},
		} {
			response = updateOptions(invalid)
			require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
			assert.Equal(t, baseline, model_probe_setting.GetSetting())
			var after []model.Option
			require.NoError(t, model.DB.Order("key").Find(&after).Error)
			assert.Equal(t, savedOptions, after, "validation cannot persist a partial settings update")
		}

		// Fail the second option UPDATE, after the first one has reached the
		// database, to exercise transaction rollback rather than only validation.
		updates := 0
		callback := "test:model_probe_second_option_write"
		require.NoError(t, model.DB.Callback().Update().Before("gorm:update").Register(callback, func(tx *gorm.DB) {
			if tx.Statement.Table == "options" {
				updates++
				if updates == 2 {
					tx.AddError(errors.New("injected option persistence failure"))
				}
			}
		}))
		response = updateOptions(map[string]any{"model_probe_setting.interval_minutes": 45, "model_probe_setting.timeout_seconds": 90})
		require.NoError(t, model.DB.Callback().Update().Remove(callback))
		require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		require.Equal(t, 2, updates)
		assert.Equal(t, baseline, model_probe_setting.GetSetting())
		var rolledBack []model.Option
		require.NoError(t, model.DB.Order("key").Find(&rolledBack).Error)
		assert.Equal(t, savedOptions, rolledBack)
		common.OptionMapRWMutex.RLock()
		intervalOption, timeoutOption := common.OptionMap["model_probe_setting.interval_minutes"], common.OptionMap["model_probe_setting.timeout_seconds"]
		common.OptionMapRWMutex.RUnlock()
		assert.Equal(t, "30", intervalOption)
		assert.Equal(t, "300", timeoutOption)

		require.NoError(t, model.DB.Model(&model.Token{}).Where("id = ?", probeToken.Id).Update("expired_time", time.Now().Add(-time.Minute).Unix()).Error)
		response = updateOptions(map[string]any{"model_probe_setting.interval_minutes": 45})
		require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		assert.Equal(t, baseline, model_probe_setting.GetSetting())
		response = updateOptions(map[string]any{"model_probe_setting.enabled": false, "model_probe_setting.timeout_seconds": 120})
		require.Equal(t, http.StatusOK, response.Code, response.Body.String())
		disabled := model_probe_setting.GetSetting()
		assert.False(t, disabled.Enabled)
		assert.Equal(t, 120, disabled.TimeoutSeconds)
		response = updateOptions(map[string]any{"model_probe_setting.enabled": true})
		require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
		assert.Equal(t, disabled, model_probe_setting.GetSetting(), "expired credentials cannot be re-enabled")
	})
}
