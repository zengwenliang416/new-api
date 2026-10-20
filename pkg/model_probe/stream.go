package model_probe

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	maxResponseBytes = 2 * 1024 * 1024  // Persisted assistant text / SVG.
	maxStreamBytes   = 32 * 1024 * 1024 // Includes SSE framing and reasoning events.
	maxEventBytes    = 8 * 1024 * 1024  // Bounds an unfinished SSE event or JSON frame.
)

type responseResult struct {
	Text         string
	UsageSource  string
	Quota        *int64
	RequestID    string
	FirstTokenMs int64
	InputTokens  int64
	OutputTokens int64
	ErrorKind    string
	ErrorDetail  string
	Retryable    bool
}

type responseDocument struct {
	Status string `json:"status"`
	Output []struct {
		Type    string `json:"type"`
		Role    string `json:"role"`
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
	} `json:"output"`
	Usage *struct {
		InputTokens  int64 `json:"input_tokens"`
		OutputTokens int64 `json:"output_tokens"`
	} `json:"usage"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

type streamEvent struct {
	Type     string           `json:"type"`
	Code     string           `json:"code"`
	Delta    string           `json:"delta"`
	Response responseDocument `json:"response"`
	Error    *struct {
		Code string `json:"code"`
	} `json:"error"`
}

// responseCapture parses SSE boundaries incrementally. Only assistant
// output_text deltas are judged; reasoning/summary events are never answers.
// Limits apply to total network bytes as well as the persisted answer.
type responseCapture struct {
	mu         sync.Mutex
	closeOnce  sync.Once
	closed     chan bool
	ctx        context.Context
	cancel     context.CancelFunc
	header     http.Header
	status     int
	started    time.Time
	firstToken bool
	total      int
	pending    []byte
	data       []byte
	body       bytes.Buffer
	output     strings.Builder
	completed  bool
	failed     bool
	parseErr   bool
	tooLarge   bool
	response   responseResult
}

func newResponseCapture(ctx context.Context) *responseCapture {
	ctx, cancel := context.WithCancel(ctx)
	return &responseCapture{ctx: ctx, cancel: cancel, header: make(http.Header), started: time.Now(), closed: make(chan bool, 1)}
}
func (w *responseCapture) Header() http.Header { return w.header }
func (w *responseCapture) CloseNotify() <-chan bool {
	w.closeOnce.Do(func() { go func() { <-w.ctx.Done(); w.closed <- true }() })
	return w.closed
}
func (w *responseCapture) WriteHeader(status int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status == 0 {
		w.status = status
	}
}
func (w *responseCapture) Flush() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.status == 0 {
		w.status = http.StatusOK
	}
}
func (w *responseCapture) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.ctx.Err(); err != nil {
		return 0, err
	}
	if w.status == 0 {
		w.status = http.StatusOK
	}
	w.total += len(p)
	if w.total > maxStreamBytes {
		return 0, w.rejectLimit("Probe stream exceeded the transport size limit")
	}
	if !strings.Contains(w.header.Get("Content-Type"), "text/event-stream") {
		if w.body.Len()+len(p) > maxResponseBytes {
			return 0, w.rejectLimit("Probe response exceeded the answer size limit")
		}
		return w.body.Write(p)
	}
	w.pending = append(w.pending, p...)
	for {
		line, rest, found := bytes.Cut(w.pending, []byte{'\n'})
		if !found {
			break
		}
		w.pending = rest
		if len(line)+len(w.data) > maxEventBytes {
			return 0, w.rejectLimit("Probe stream event exceeded its size limit")
		}
		line = bytes.TrimSuffix(line, []byte{'\r'})
		if len(line) == 0 {
			w.consumeEvent()
			continue
		}
		if value, ok := bytes.CutPrefix(line, []byte("data:")); ok {
			value = bytes.TrimPrefix(value, []byte{' '})
			if len(w.data) > 0 {
				w.data = append(w.data, '\n')
			}
			w.data = append(w.data, value...)
		}
	}
	if len(w.pending)+len(w.data) > maxEventBytes {
		return 0, w.rejectLimit("Probe stream event exceeded its size limit")
	}
	if w.tooLarge {
		return 0, fmt.Errorf("probe output exceeded its size limit")
	}
	return len(p), nil
}

// Stop the upstream request immediately, retaining the original limit cause.
func (w *responseCapture) rejectLimit(detail string) error {
	w.tooLarge = true
	w.response.ErrorDetail = detail
	w.cancel()
	return fmt.Errorf("probe output exceeded its size limit")
}

func (w *responseCapture) consumeEvent() {
	if w.tooLarge || len(w.data) == 0 {
		return
	}
	data := w.data
	w.data = nil
	if bytes.Equal(data, []byte("[DONE]")) {
		return
	}
	var event streamEvent
	if common.Unmarshal(data, &event) != nil {
		w.parseErr = true
		return
	}
	if event.Type == "" && event.Error != nil {
		event.Type = "error"
	}
	if w.failed {
		return
	}
	switch event.Type {
	case "response.output_text.delta":
		if w.completed {
			return
		}
		if !w.firstToken && event.Delta != "" {
			w.firstToken = true
			w.response.FirstTokenMs = time.Since(w.started).Milliseconds()
		}
		if w.output.Len()+len(event.Delta) > maxResponseBytes {
			_ = w.rejectLimit("Probe response exceeded the answer size limit")
			return
		}
		w.output.WriteString(event.Delta)
	case "response.completed", "response.done":
		if w.completed {
			return
		}
		if event.Response.Status != "" && event.Response.Status != "completed" {
			w.failed = true
			return
		}
		w.completed = true
		w.applyDocument(event.Response)
	case "response.failed", "response.incomplete", "response.error", "response.cancelled", "response.canceled", "error":
		w.failed = true
		w.applyDocument(event.Response)
		w.response.ErrorKind = "response_failed"
		code := event.Response.Error.Code
		if code == "" && event.Error != nil {
			code = event.Error.Code
		}
		if code == "" {
			code = event.Code
		}
		w.response.Retryable = code == "server_error" || code == "rate_limit_exceeded" || code == "timeout"
		// Upstream error messages may contain request credentials. Keep the
		// normalized category and HTTP status, not arbitrary error text.
		w.response.ErrorDetail = "The relay reported an unsuccessful response"
	}
}

func (w *responseCapture) applyDocument(document responseDocument) {
	var text strings.Builder
	for _, output := range document.Output {
		if output.Type != "message" || (output.Role != "" && output.Role != "assistant") {
			continue
		}
		for _, content := range output.Content {
			if content.Type == "output_text" {
				if text.Len() > 0 {
					text.WriteByte('\n')
				}
				if text.Len()+len(content.Text) > maxResponseBytes {
					_ = w.rejectLimit("Probe response exceeded the answer size limit")
					return
				}
				text.WriteString(content.Text)
			}
		}
	}
	if text.Len() > 0 {
		w.output.Reset()
		w.output.WriteString(text.String())
	}
	if document.Usage != nil {
		w.response.InputTokens = max(document.Usage.InputTokens, 0)
		w.response.OutputTokens = max(document.Usage.OutputTokens, 0)
		w.response.UsageSource = "upstream"
	}
}

func (w *responseCapture) result() responseResult {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.pending) > 0 {
		line := bytes.TrimSuffix(w.pending, []byte{'\r'})
		if value, ok := bytes.CutPrefix(line, []byte("data:")); ok {
			if len(w.data) > 0 {
				w.data = append(w.data, '\n')
			}
			w.data = append(w.data, bytes.TrimPrefix(value, []byte{' '})...)
		}
	}
	w.consumeEvent()
	if w.body.Len() > 0 && w.status >= 200 && w.status < 300 {
		var document responseDocument
		if common.Unmarshal(w.body.Bytes(), &document) != nil {
			w.parseErr = true
		} else if document.Status == "completed" {
			w.completed = true
			w.applyDocument(document)
		} else {
			w.failed = true
		}
	}
	w.response.Text = w.output.String()
	switch {
	case w.tooLarge:
		w.response.ErrorKind, w.response.Retryable = "output_limit", false
	case w.ctx.Err() != nil:
		w.response.ErrorKind, w.response.Retryable = "timeout", false
	case w.status < 200 || w.status >= 300:
		w.response.ErrorKind = "http_error"
		w.response.ErrorDetail = fmt.Sprintf("Relay returned HTTP %d", w.status)
		w.response.Retryable = w.status == http.StatusTooManyRequests || w.status >= 500
		var failure struct {
			Error struct {
				Code string `json:"code"`
			} `json:"error"`
		}
		if common.Unmarshal(w.body.Bytes(), &failure) == nil && failure.Error.Code == "insufficient_user_quota" {
			w.response.ErrorKind = "account_quota"
			w.response.ErrorDetail = "Probe account has insufficient balance or subscription quota."
			w.response.Retryable = false
		}
	case w.parseErr:
		w.response.ErrorKind, w.response.Retryable = "invalid_response", false
	case w.failed:
		if w.response.ErrorKind == "" {
			w.response.ErrorKind = "response_failed"
		}
	case !w.completed:
		w.response.ErrorKind, w.response.Retryable = "incomplete_stream", true
	}
	return w.response
}
