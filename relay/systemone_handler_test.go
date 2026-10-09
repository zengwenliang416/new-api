package relay

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/jev"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSystemOneUpstreamURLJoinsTheEvaluationPath(t *testing.T) {
	adaptor := &jev.Adaptor{}
	for _, tc := range []struct {
		base string
		want string
	}{
		{base: "", want: "https://api.typesafe.ai/v1/systemone"},
		{base: "https://api.typesafe.ai/", want: "https://api.typesafe.ai/v1/systemone"},
		{base: "https://api.typesafe.ai/v1", want: "https://api.typesafe.ai/v1/systemone"},
		{base: "https://proxy.example/jev/v1/systemone/", want: "https://proxy.example/jev/v1/systemone"},
	} {
		t.Run(tc.base, func(t *testing.T) {
			got, err := adaptor.GetRequestURL(&relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: tc.base},
			})
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestSystemOneRequestBodyRewritesOnlyTheMappedModel(t *testing.T) {
	raw := []byte(`{"state":{"ticket":"payout failed"},"model":"jev-latest","questions":{"urgent":{"type":"noul","instructions":"Is this urgent?"}},"future_field":true}`)
	same, err := systemOneRequestBody(raw, "jev-latest", "jev-latest")
	require.NoError(t, err)
	assert.Equal(t, raw, same)

	mapped, err := systemOneRequestBody(raw, "jev-latest", "jev-1.13.0")
	require.NoError(t, err)
	var body map[string]any
	require.NoError(t, common.Unmarshal(mapped, &body))
	assert.Equal(t, "jev-1.13.0", body["model"])
	assert.Equal(t, true, body["future_field"])
	require.Contains(t, body, "state")
	require.Contains(t, body, "questions")
}

func TestSystemOneUsageReadsInputAndOutputTokens(t *testing.T) {
	usage, ok := systemOneUsage([]byte(`{"model":"jev-1.13.0","answers":{"urgent":{"type":"noul","noul":0.95}},"usage":{"input_tokens":474,"output_tokens":97}}`))
	require.True(t, ok)
	assert.Equal(t, 474, usage.PromptTokens)
	assert.Equal(t, 97, usage.CompletionTokens)
	assert.Equal(t, 474, usage.InputTokens)
	assert.Equal(t, 97, usage.OutputTokens)

	_, ok = systemOneUsage([]byte(`{"model":"jev-1.13.0","answers":{},"usage":{"input_tokens":-1,"output_tokens":2}}`))
	assert.False(t, ok)
	_, ok = systemOneUsage([]byte(`{"model":"jev-1.13.0","answers":{}}`))
	assert.False(t, ok)

	saturated, ok := systemOneUsage([]byte(`{"usage":{"input_tokens":3000000000,"output_tokens":0}}`))
	require.True(t, ok)
	assert.Equal(t, maxSystemOneTokens, saturated.PromptTokens)
	assert.Equal(t, 0, saturated.CompletionTokens)
}

func TestSystemOneRequestRequiresModelStateAndQuestions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	valid := `{"state":{"rows":1},"model":"jev-1.13.0","questions":{"pick":{"type":"choice","instructions":"Which component?","criteria":{"table":null}}},"trace":"keep"}`
	for _, tc := range []struct {
		name string
		body string
		ok   bool
	}{
		{name: "forwards unknown fields", body: valid, ok: true},
		{name: "model is required", body: `{"state":"x","questions":{"q":{"type":"noul","instructions":"y?"}}}`, ok: false},
		{name: "state is required", body: `{"model":"jev-latest","questions":{}}`, ok: false},
		{name: "null state is rejected", body: `{"state":null,"model":"jev-latest","questions":{}}`, ok: false},
		{name: "questions must be an object", body: `{"state":"x","model":"jev-latest","questions":[]}`, ok: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/systemone", strings.NewReader(tc.body))
			ctx.Request.Header.Set("Content-Type", "application/json")
			request, err := helper.GetAndValidateRequest(ctx, types.RelayFormatTypeSafeSystemOne)
			if !tc.ok {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			systemOne, ok := request.(*dto.SystemOneRequest)
			require.True(t, ok)
			assert.Equal(t, "jev-1.13.0", systemOne.Model)
			assert.JSONEq(t, tc.body, string(systemOne.RawBody))
		})
	}
}

func TestSystemOneHelperPassesUpstreamStatusAndBodyThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const raw = `{"state":"payouts failed","model":"jev-latest","questions":{"urgent":{"type":"noul","instructions":"Is this urgent?"}},"future_field":1}`
	const upstreamBody = `{"status":451,"title":"Typesafe is not available in your region."}`
	var seenPath, seenAuth, seenBody string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seenPath = r.URL.Path
		seenAuth = r.Header.Get("Authorization")
		payload, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		seenBody = string(payload)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnavailableForLegalReasons)
		_, _ = w.Write([]byte(upstreamBody))
	}))
	t.Cleanup(upstream.Close)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/systemone", strings.NewReader(raw))
	ctx.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeJev)
	common.SetContextKey(ctx, constant.ContextKeyChannelBaseUrl, upstream.URL)
	common.SetContextKey(ctx, constant.ContextKeyChannelKey, "channel-secret")
	common.SetContextKey(ctx, constant.ContextKeyOriginalModel, "jev-latest")
	common.SetContextKey(ctx, constant.ContextKeyChannelModelMapping, `{"jev-latest":"jev-1.13.0"}`)

	info := &relaycommon.RelayInfo{
		OriginModelName: "jev-latest",
		RelayMode:       0,
		Request: &dto.SystemOneRequest{
			Model:   "jev-latest",
			RawBody: []byte(raw),
		},
	}
	require.Nil(t, SystemOneHelper(ctx, info))
	assert.Equal(t, "/v1/systemone", seenPath)
	assert.Equal(t, "Bearer channel-secret", seenAuth)
	assert.Contains(t, seenBody, `"model":"jev-1.13.0"`)
	assert.Contains(t, seenBody, `"future_field":1`)
	assert.Contains(t, seenBody, `"state":"payouts failed"`)
	assert.Equal(t, http.StatusUnavailableForLegalReasons, recorder.Code)
	assert.Equal(t, upstreamBody, recorder.Body.String())
	assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
}

func TestSystemOneHelperRejectsANonJevChannel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/systemone", strings.NewReader(`{}`))
	common.SetContextKey(ctx, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	info := &relaycommon.RelayInfo{Request: &dto.SystemOneRequest{Model: "jev-latest", RawBody: []byte(`{}`)}}
	apiErr := SystemOneHelper(ctx, info)
	require.NotNil(t, apiErr)
	assert.Contains(t, apiErr.Error(), "does not support /v1/systemone")
	assert.Equal(t, http.StatusOK, recorder.Code)
}

type failBodyWriter struct {
	gin.ResponseWriter
}

func (w *failBodyWriter) Write([]byte) (int, error) {
	w.WriteHeaderNow()
	return 0, errors.New("client gone")
}

func TestRelaySystemOneResponseKeepsTheStatusWhenTheClientWriteFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, tc := range []struct {
		name        string
		status      int
		body        string
		passthrough bool
		prompt      int
	}{
		{
			name:        "non-2xx is not billed",
			status:      http.StatusUnavailableForLegalReasons,
			body:        `{"status":451,"title":"Typesafe is not available in your region."}`,
			passthrough: true,
		},
		{
			name:   "2xx still reports usage",
			status: http.StatusOK,
			body:   `{"model":"jev-1.13.0","usage":{"input_tokens":474,"output_tokens":97}}`,
			prompt: 474,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Writer = &failBodyWriter{ResponseWriter: ctx.Writer}
			upstream := &http.Response{
				StatusCode: tc.status,
				Header:     make(http.Header),
				Body:       io.NopCloser(strings.NewReader(tc.body)),
			}
			upstream.Header.Set("Content-Type", "application/json")
			usage, passthrough, err := relaySystemOneResponse(ctx, upstream)
			require.NoError(t, err)
			assert.Equal(t, tc.passthrough, passthrough)
			assert.Equal(t, tc.status, recorder.Code)
			assert.Empty(t, recorder.Body.String())
			if tc.passthrough {
				assert.Nil(t, usage)
				return
			}
			require.NotNil(t, usage)
			assert.Equal(t, tc.prompt, usage.PromptTokens)
			assert.Equal(t, 97, usage.CompletionTokens)
		})
	}
}
