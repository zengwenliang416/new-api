package relay

import (
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// maxSystemOneTokens keeps an upstream usage count inside the quota int32 boundary.
const maxSystemOneTokens = math.MaxInt32 / 2

func SystemOneHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	if info.ChannelType != constant.ChannelTypeJev {
		return types.NewError(
			errors.New("channel does not support /v1/systemone"),
			types.ErrorCodeInvalidRequest,
		)
	}

	request, ok := info.Request.(*dto.SystemOneRequest)
	if !ok {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected *dto.SystemOneRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	err := helper.ModelMappedHelper(c, info, request)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	jsonData, err := systemOneRequestBody(request.RawBody, info.OriginModelName, info.UpstreamModelName)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return newAPIErrorFromParamOverride(err)
		}
	}

	body, closer, err := relaycommon.NewOutboundJSONBody(jsonData)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	resp, err := adaptor.DoRequest(c, info, body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewOpenAIError(errors.New("invalid http response"), types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	defer httpResp.Body.Close()

	usage, passthrough, err := relaySystemOneResponse(c, httpResp)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	// Clients branch on the upstream status and body. A non-2xx answer is
	// already written, so returning an error here would replace it with an
	// OpenAI error envelope. Refund the reservation instead of billing it.
	if passthrough {
		if info.Billing != nil {
			info.Billing.Refund(c)
		}
		return nil
	}

	service.PostTextConsumeQuota(c, info, usage, nil)
	return nil
}

// relaySystemOneResponse copies the upstream status and body unchanged.
// The returned usage is nil when a 2xx body has no usable token counts;
// settlement then keeps the reserved estimate. passthrough is true for any
// non-2xx response that was written to the client.
func relaySystemOneResponse(c *gin.Context, upstream *http.Response) (*dto.Usage, bool, error) {
	body, err := io.ReadAll(upstream.Body)
	if err != nil {
		return nil, false, err
	}
	if contentType := upstream.Header.Get("Content-Type"); contentType != "" {
		c.Writer.Header().Set("Content-Type", contentType)
	}
	c.Writer.WriteHeader(upstream.StatusCode)
	if _, err = c.Writer.Write(body); err != nil {
		// The status line is already committed. Returning an error would append
		// an OpenAI envelope after the upstream bytes.
		logger.LogError(c, fmt.Sprintf("system one response write failed: %s", err.Error()))
		if upstream.StatusCode < http.StatusOK || upstream.StatusCode >= 300 {
			return nil, true, nil
		}
	}
	if upstream.StatusCode < http.StatusOK || upstream.StatusCode >= 300 {
		return nil, true, nil
	}
	usage, ok := systemOneUsage(body)
	if !ok {
		return nil, false, nil
	}
	return usage, false, nil
}

// systemOneRequestBody returns rawBody unchanged unless the model was mapped.
// Only the model field is rewritten, so unknown fields stay intact.
func systemOneRequestBody(rawBody []byte, originModel, upstreamModel string) ([]byte, error) {
	if len(rawBody) == 0 {
		return nil, errors.New("empty system one request body")
	}
	if upstreamModel == "" || upstreamModel == originModel {
		return rawBody, nil
	}
	var body map[string]any
	if err := common.Unmarshal(rawBody, &body); err != nil {
		return nil, err
	}
	body["model"] = upstreamModel
	return common.Marshal(body)
}

// systemOneUsage reads usage.input_tokens and usage.output_tokens.
// Output tokens are recorded and priced by the model expression; the published
// Jev price leaves them free. Missing, negative, or non-integer counts are
// rejected so settlement keeps the reserved estimate. Oversized counts saturate.
func systemOneUsage(body []byte) (*dto.Usage, bool) {
	var response struct {
		Usage *struct {
			InputTokens  *int `json:"input_tokens"`
			OutputTokens *int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := common.Unmarshal(body, &response); err != nil || response.Usage == nil {
		return nil, false
	}
	if response.Usage.InputTokens == nil || response.Usage.OutputTokens == nil {
		return nil, false
	}
	input, inputOK := boundSystemOneTokens(*response.Usage.InputTokens)
	output, outputOK := boundSystemOneTokens(*response.Usage.OutputTokens)
	if !inputOK || !outputOK {
		return nil, false
	}
	return &dto.Usage{
		PromptTokens:     input,
		CompletionTokens: output,
		TotalTokens:      input + output,
		InputTokens:      input,
		OutputTokens:     output,
	}, true
}

func boundSystemOneTokens(n int) (int, bool) {
	if n < 0 {
		return 0, false
	}
	if n > maxSystemOneTokens {
		common.SysError(fmt.Sprintf("system one usage token count %d saturated to %d", n, maxSystemOneTokens))
		return maxSystemOneTokens, true
	}
	return n, true
}
