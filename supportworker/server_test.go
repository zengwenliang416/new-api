/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package supportworker_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"maps"
	"mime/multipart"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/supportworker"
	"github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// These are HTTP integration tests of the real Worker, database, and attachment
// store. Only the separate gateway callbacks and translation provider are test
// servers. SQLite is the default; run the same suite against a disposable local
// MySQL/PostgreSQL database with TEST_SUPPORT_WORKER_DIALECT and
// TEST_SUPPORT_WORKER_DSN. External DSNs must name a supportworker_test* database
// on a literal loopback IP. Fixtures use separate sites and never drop tables.
const testJWTSecret = "support-worker-test-signing-secret-32-bytes"
const testCallbackSecret = "support-worker-test-callback-secret-32-bytes"
const testBrowserOrigin = "https://support.example.test"

type testTicket struct {
	ID                    int64  `json:"id"`
	UserID                int64  `json:"user_id"`
	Title                 string `json:"title"`
	Status                string `json:"status"`
	Category              string `json:"category"`
	Priority              string `json:"priority"`
	Verification          string `json:"verification_level"`
	UnreadUser            bool   `json:"unread_user"`
	UnreadAdmin           bool   `json:"unread_admin"`
	LastMessagePreview    string `json:"last_message_preview"`
	LastMessageSenderType string `json:"last_message_sender_type"`
}

type testAttachment struct {
	ID   int64  `json:"id"`
	Key  string `json:"key"`
	Name string `json:"name"`
	Size int64  `json:"size"`
}

type testMessage struct {
	ID          int64            `json:"id"`
	Body        string           `json:"body"`
	SenderType  string           `json:"sender_type"`
	Attachments []testAttachment `json:"attachments"`
}

type testTranslation struct {
	Body   string `json:"body"`
	Status string `json:"status"`
}

type testDetail struct {
	Ticket       testTicket                `json:"ticket"`
	Messages     []testMessage             `json:"messages"`
	NextCursor   *string                   `json:"next_cursor"`
	Translations map[int64]testTranslation `json:"translations"`
}

type testPage struct {
	Items      []testTicket `json:"items"`
	NextCursor *string      `json:"next_cursor"`
}

type testMessagePage struct {
	Items      []testMessage `json:"items"`
	NextCursor *string       `json:"next_cursor"`
}

type testSummary struct {
	UnreadCount  int            `json:"unread_count"`
	PendingCount int            `json:"pending_count"`
	StatusCounts map[string]int `json:"status_counts"`
}

type testResponse struct {
	Header  http.Header
	Message string
}

type testVerifyRequest struct {
	UserID         int64  `json:"user_id"`
	Scope          string `json:"scope"`
	SessionID      string `json:"sid"`
	UserVersion    int64  `json:"uv"`
	SessionVersion int64  `json:"sv"`
}

type testNotification struct {
	EventID string `json:"event_id"`
	UserID  int64  `json:"user_id"`
	Title   string `json:"title"`
	Content string `json:"content"`
}

type testGateway struct {
	t               *testing.T
	mu              sync.Mutex
	roles           map[int64]int
	revoked         map[int64]bool
	wrongIdentity   bool
	unavailable     bool
	verifyRequests  []testVerifyRequest
	notifications   []testNotification
	acceptedEvents  map[string]int
	loseNotifyReply bool
}

func (g *testGateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	g.mu.Lock()
	defer g.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	if !assert.Equal(g.t, http.MethodPost, r.Method) || !assert.Equal(g.t, testCallbackSecret, r.Header.Get("X-Support-Callback-Secret")) {
		w.WriteHeader(http.StatusForbidden)
		return
	}
	switch r.URL.Path {
	case "/api/support/worker/verify":
		var req testVerifyRequest
		if !assert.NoError(g.t, common.DecodeJson(r.Body, &req)) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		g.verifyRequests = append(g.verifyRequests, req)
		if g.unavailable {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = io.WriteString(w, `{"success":false,"message":"gateway unavailable"}`)
			return
		}
		role, exists := g.roles[req.UserID]
		valid := exists && !g.revoked[req.UserID] && req.SessionID == fmt.Sprintf("session-%d", req.UserID) && req.UserVersion == 1 && req.SessionVersion == 1
		if !valid {
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = io.WriteString(w, `{"success":false,"message":"Support user verification failed"}`)
			return
		}
		id := req.UserID
		if g.wrongIdentity {
			id++
		}
		body, err := common.Marshal(map[string]any{"success": true, "data": map[string]any{
			"id": id, "username": fmt.Sprintf("user-%d", id), "email": fmt.Sprintf("user-%d@example.test", id), "role": role,
		}})
		if assert.NoError(g.t, err) {
			_, _ = w.Write(body)
		}
	case "/api/support/worker/notify":
		var req testNotification
		if !assert.NoError(g.t, common.DecodeJson(r.Body, &req)) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		g.notifications = append(g.notifications, req)
		assert.NotEmpty(g.t, req.EventID)
		if _, exists := g.acceptedEvents[req.EventID]; !exists {
			g.acceptedEvents[req.EventID] = 1
		}
		if g.loseNotifyReply {
			g.loseNotifyReply = false
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = io.WriteString(w, `{"success":false,"message":"delivery acknowledgement lost"}`)
			return
		}
		_, _ = io.WriteString(w, `{"success":true}`)
	default:
		g.t.Errorf("unexpected gateway callback path %q", r.URL.Path)
		w.WriteHeader(http.StatusNotFound)
	}
}

type workerFixture struct {
	t       *testing.T
	now     atomic.Int64
	db      *gorm.DB
	cfg     supportworker.Config
	worker  *supportworker.Server
	server  *httptest.Server
	gateway *testGateway
}

func newWorkerFixture(t *testing.T, translation supportworker.TranslationConfig, client *http.Client) *workerFixture {
	t.Helper()
	f := &workerFixture{t: t}
	f.now.Store(time.Date(2026, time.October, 17, 4, 0, 0, 0, time.UTC).UnixNano())
	f.gateway = &testGateway{t: t, roles: map[int64]int{1: 1, 2: 1, 5: 5, 10: 10}, revoked: make(map[int64]bool), acceptedEvents: make(map[string]int)}
	gateway := httptest.NewServer(f.gateway)
	t.Cleanup(gateway.Close)
	dialect := os.Getenv("TEST_SUPPORT_WORKER_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	dsn := filepath.Join(t.TempDir(), "worker.sqlite")
	if dialect != "sqlite" {
		dsn = os.Getenv("TEST_SUPPORT_WORKER_DSN")
		require.NotEmpty(t, dsn, "external database tests require an explicit disposable database DSN")
		var host, database string
		switch dialect {
		case "mysql":
			parsed, err := mysql.ParseDSN(dsn)
			require.NoError(t, err)
			require.Equal(t, "tcp", parsed.Net)
			host, _, err = net.SplitHostPort(parsed.Addr)
			require.NoError(t, err)
			database = parsed.DBName
		case "postgres":
			parsed, err := url.Parse(dsn)
			require.NoError(t, err)
			require.Contains(t, []string{"postgres", "postgresql"}, parsed.Scheme)
			host = parsed.Hostname()
			database = strings.TrimPrefix(parsed.Path, "/")
		default:
			t.Fatalf("unsupported TEST_SUPPORT_WORKER_DIALECT %q", dialect)
		}
		require.True(t, net.ParseIP(host).IsLoopback(), "external database tests require a literal loopback IP")
		require.True(t, strings.HasPrefix(database, "supportworker_test"), "external database name must start with supportworker_test")
	}
	var err error
	f.db, err = supportworker.OpenDatabase(dialect, dsn)
	require.NoError(t, err)
	versionQuery := "SELECT sqlite_version()"
	if dialect == "mysql" {
		versionQuery = "SELECT VERSION()"
	} else if dialect == "postgres" {
		versionQuery = "SHOW server_version"
	}
	var databaseVersion string
	require.NoError(t, f.db.Raw(versionQuery).Scan(&databaseVersion).Error)
	t.Logf("integration database: %s %s", dialect, databaseVersion)
	sqlDB, err := f.db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, sqlDB.Close()) })
	f.cfg = supportworker.Config{
		SiteID:     fmt.Sprintf("test-%d-%d", os.Getpid(), time.Now().UnixNano()),
		GatewayURL: gateway.URL, JWTSecret: testJWTSecret, CallbackSecret: testCallbackSecret,
		AllowedOrigins: []string{testBrowserOrigin}, UploadDir: t.TempDir(), HTTPClient: client,
		Now: f.clock, Translation: translation,
	}
	f.worker, err = supportworker.NewServer(f.cfg, f.db)
	require.NoError(t, err)
	f.server = httptest.NewServer(f.worker.Handler())
	t.Cleanup(func() { f.server.Close() })
	return f
}

func (f *workerFixture) clock() time.Time {
	return time.Unix(0, f.now.Load())
}

func (f *workerFixture) advance(d time.Duration) {
	f.now.Add(int64(d))
}

func (f *workerFixture) restart() {
	f.t.Helper()
	f.server.Close()
	var err error
	f.worker, err = supportworker.NewServer(f.cfg, f.db)
	require.NoError(f.t, err)
	f.server = httptest.NewServer(f.worker.Handler())
}

func (f *workerFixture) claims(id int64) jwt.MapClaims {
	return jwt.MapClaims{
		"iss": "new-api-support", "aud": "support-worker", "sub": strconv.FormatInt(id, 10),
		"site": f.cfg.SiteID, "sid": fmt.Sprintf("session-%d", id), "uv": int64(1), "sv": int64(1),
		"iat": f.clock().Unix(), "nbf": f.clock().Unix(), "exp": f.clock().Add(time.Hour).Unix(),
	}
}

func (f *workerFixture) sign(claims jwt.MapClaims, method jwt.SigningMethod, key any) string {
	f.t.Helper()
	token, err := jwt.NewWithClaims(method, claims).SignedString(key)
	require.NoError(f.t, err)
	return token
}

func (f *workerFixture) token(id int64) string {
	f.t.Helper()
	return f.sign(f.claims(id), jwt.SigningMethodHS256, []byte(testJWTSecret))
}

func (f *workerFixture) request(token, method, path string, body any, status int, result any) testResponse {
	f.t.Helper()
	var input io.Reader
	if body != nil {
		encoded, err := common.Marshal(body)
		require.NoError(f.t, err)
		input = bytes.NewReader(encoded)
	}
	req, err := http.NewRequest(method, f.server.URL+path, input)
	require.NoError(f.t, err)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", testBrowserOrigin)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := f.server.Client().Do(req)
	require.NoError(f.t, err)
	defer resp.Body.Close()
	encoded, err := io.ReadAll(resp.Body)
	require.NoError(f.t, err)
	if status == 0 {
		require.True(f.t, resp.StatusCode >= 200 && resp.StatusCode < 300, "HTTP %s %s returned %d: %s", method, path, resp.StatusCode, encoded)
	} else if status == -1 {
		require.True(f.t, resp.StatusCode >= 400, "HTTP %s %s unexpectedly returned %d", method, path, resp.StatusCode)
	} else {
		require.Equal(f.t, status, resp.StatusCode, "HTTP %s %s: %s", method, path, encoded)
	}
	var envelope struct {
		Success bool            `json:"success"`
		Message string          `json:"message"`
		Data    json.RawMessage `json:"data"`
	}
	require.NoError(f.t, common.Unmarshal(encoded, &envelope), "HTTP %s %s: %s", method, path, encoded)
	if status == 0 {
		require.True(f.t, envelope.Success, "HTTP %s %s: %s", method, path, envelope.Message)
		if result != nil {
			require.NoError(f.t, common.Unmarshal(envelope.Data, result))
		}
	} else {
		assert.False(f.t, envelope.Success)
		assert.NotEmpty(f.t, envelope.Message)
	}
	return testResponse{Header: resp.Header, Message: envelope.Message}
}

func (f *workerFixture) create(id int64, title, category, verification string, attachments []testAttachment) testDetail {
	f.t.Helper()
	var detail testDetail
	f.request(f.token(id), http.MethodPost, "/api/tickets", map[string]any{
		"title": title, "category": category, "verification_level": verification,
		"body": "First message: " + title, "attachments": attachments, "lang": "en",
	}, 0, &detail)
	require.Positive(f.t, detail.Ticket.ID)
	require.Len(f.t, detail.Messages, 1)
	f.advance(time.Second)
	return detail
}

func TestSupportWorkerAuthenticationAndAuthorization(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	f.request(f.token(1), http.MethodGet, "/api/tickets", nil, 0, &testPage{})
	f.request("", http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)
	f.request("invalid.jwt", http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)

	cases := []struct {
		name  string
		claim string
		value any
	}{
		{"wrong audience", "aud", "another-service"}, {"wrong issuer", "iss", "another-issuer"},
		{"wrong site", "site", "another-site"}, {"missing site", "site", nil},
		{"expired", "exp", f.clock().Add(-time.Second).Unix()}, {"future not before", "nbf", f.clock().Add(time.Hour).Unix()},
		{"future issued at", "iat", f.clock().Add(time.Hour).Unix()}, {"excessive lifetime", "exp", f.clock().Add(5 * time.Hour).Unix()},
		{"missing expiry", "exp", nil}, {"missing issued at", "iat", nil}, {"missing not before", "nbf", nil},
		{"missing session", "sid", nil}, {"empty session", "sid", ""},
		{"missing user version", "uv", nil}, {"missing session version", "sv", nil},
		{"zero user version", "uv", int64(0)}, {"zero session version", "sv", int64(0)},
		{"invalid subject", "sub", "not-a-user"}, {"nonpositive subject", "sub", "0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			parent := f.t
			f.t = t
			t.Cleanup(func() { f.t = parent })
			claims := f.claims(1)
			if tc.value == nil {
				delete(claims, tc.claim)
			} else {
				claims[tc.claim] = tc.value
			}
			f.request(f.sign(claims, jwt.SigningMethodHS256, []byte(testJWTSecret)), http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)
		})
	}
	f.request(f.sign(f.claims(1), jwt.SigningMethodHS256, []byte("incorrect-signing-secret-32-bytes")), http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)
	f.request(f.sign(f.claims(1), jwt.SigningMethodHS384, []byte(testJWTSecret)), http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)
	f.request(f.sign(f.claims(1), jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType), http.MethodGet, "/api/tickets", nil, http.StatusUnauthorized, nil)
	f.gateway.mu.Lock()
	assert.Len(t, f.gateway.verifyRequests, 1, "invalid tokens must be rejected before gateway verification")
	f.gateway.mu.Unlock()

	token := f.token(1)
	f.gateway.mu.Lock()
	f.gateway.revoked[1] = true
	f.gateway.mu.Unlock()
	f.request(token, http.MethodGet, "/api/tickets", nil, -1, nil)
	f.gateway.mu.Lock()
	f.gateway.revoked[1] = false
	f.gateway.wrongIdentity = true
	f.gateway.mu.Unlock()
	f.request(token, http.MethodGet, "/api/tickets", nil, -1, nil)
	f.gateway.mu.Lock()
	f.gateway.wrongIdentity = false
	f.gateway.unavailable = true
	f.gateway.mu.Unlock()
	f.request(token, http.MethodGet, "/api/tickets", nil, -1, nil)
	f.gateway.mu.Lock()
	f.gateway.unavailable = false
	f.gateway.mu.Unlock()

	for _, field := range []string{"uv", "sv", "sid"} {
		claims := f.claims(1)
		claims[field] = int64(2)
		if field == "sid" {
			claims[field] = "revoked-session"
		}
		f.request(f.sign(claims, jwt.SigningMethodHS256, []byte(testJWTSecret)), http.MethodGet, "/api/tickets", nil, -1, nil)
	}
	claims := f.claims(1)
	claims["role"] = 100
	f.request(f.sign(claims, jwt.SigningMethodHS256, []byte(testJWTSecret)), http.MethodGet, "/api/tickets?scope=admin", nil, http.StatusForbidden, nil)
	staffToken := f.token(5)
	f.request(staffToken, http.MethodGet, "/api/tickets?scope=admin", nil, 0, &testPage{})
	f.gateway.mu.Lock()
	last := f.gateway.verifyRequests[len(f.gateway.verifyRequests)-1]
	assert.Equal(t, testVerifyRequest{UserID: 5, Scope: "admin", SessionID: "session-5", UserVersion: 1, SessionVersion: 1}, last)
	f.gateway.roles[5] = 1
	f.gateway.mu.Unlock()
	f.request(staffToken, http.MethodGet, "/api/tickets?scope=admin", nil, http.StatusForbidden, nil)
	f.request(f.token(1), http.MethodGet, "/api/tickets?scope=unknown", nil, -1, nil)
}

func TestSupportWorkerCORSAndConfiguration(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	for _, origin := range []string{testBrowserOrigin, testBrowserOrigin + ".attacker.test", "null"} {
		req, err := http.NewRequest(http.MethodOptions, f.server.URL+"/api/tickets", nil)
		require.NoError(t, err)
		req.Header.Set("Origin", origin)
		req.Header.Set("Access-Control-Request-Method", http.MethodPost)
		req.Header.Set("Access-Control-Request-Headers", "authorization,content-type")
		resp, err := f.server.Client().Do(req)
		require.NoError(t, err)
		_, err = io.Copy(io.Discard, resp.Body)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		if origin == testBrowserOrigin {
			assert.True(t, resp.StatusCode >= 200 && resp.StatusCode < 300)
			assert.Equal(t, origin, resp.Header.Get("Access-Control-Allow-Origin"))
			assert.Contains(t, strings.ToLower(resp.Header.Get("Access-Control-Allow-Headers")), "authorization")
		} else {
			assert.Equal(t, http.StatusForbidden, resp.StatusCode)
			assert.Empty(t, resp.Header.Get("Access-Control-Allow-Origin"))
		}
		assert.NotEqual(t, "true", resp.Header.Get("Access-Control-Allow-Credentials"))
	}
	for _, tc := range []struct {
		name   string
		change func(*supportworker.Config)
	}{
		{"short JWT secret", func(c *supportworker.Config) { c.JWTSecret = "short" }},
		{"short callback secret", func(c *supportworker.Config) { c.CallbackSecret = "short" }},
		{"shared secrets", func(c *supportworker.Config) { c.CallbackSecret = c.JWTSecret }},
		{"insecure remote callback", func(c *supportworker.Config) { c.GatewayURL = "http://gateway.example.test" }},
		{"credentials in callback URL", func(c *supportworker.Config) { c.GatewayURL = "https://user:pass@gateway.example.test" }},
		{"wildcard CORS", func(c *supportworker.Config) { c.AllowedOrigins = []string{"*"} }},
		{"missing CORS", func(c *supportworker.Config) { c.AllowedOrigins = nil }},
		{"path in CORS origin", func(c *supportworker.Config) { c.AllowedOrigins = []string{testBrowserOrigin + "/path"} }},
		{"incomplete translator", func(c *supportworker.Config) {
			c.Translation = supportworker.TranslationConfig{URL: "https://translate.example.test"}
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg := f.cfg
			tc.change(&cfg)
			_, err := supportworker.NewServer(cfg, f.db)
			require.Error(t, err)
		})
	}
}

func TestSupportWorkerTicketLifecycleAndIsolation(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	created := f.create(1, "A reproducible failure", "api_error", "reproducible", nil)
	assert.Equal(t, int64(1), created.Ticket.UserID)
	assert.Equal(t, "open", created.Ticket.Status)
	assert.Equal(t, "normal", created.Ticket.Priority)
	assert.True(t, created.Ticket.UnreadAdmin)
	assert.False(t, created.Ticket.UnreadUser)
	assert.Equal(t, "user", created.Messages[0].SenderType)
	path := fmt.Sprintf("/api/tickets/%d", created.Ticket.ID)
	otherConfig := f.cfg
	otherConfig.SiteID += "-other"
	otherWorker, err := supportworker.NewServer(otherConfig, f.db)
	require.NoError(t, err)
	otherServer := httptest.NewServer(otherWorker.Handler())
	t.Cleanup(otherServer.Close)
	otherSite := &workerFixture{t: t, cfg: otherConfig, server: otherServer}
	otherSite.now.Store(f.now.Load())
	otherSite.request(otherSite.token(1), http.MethodGet, path, nil, http.StatusNotFound, nil)
	var otherSitePage testPage
	otherSite.request(otherSite.token(5), http.MethodGet, "/api/tickets?scope=admin", nil, 0, &otherSitePage)
	assert.Empty(t, otherSitePage.Items, "staff access must remain restricted to the configured site")
	var page testPage
	f.request(f.token(2), http.MethodGet, "/api/tickets", nil, 0, &page)
	assert.Empty(t, page.Items)
	for _, method := range []string{http.MethodGet, http.MethodPatch, http.MethodDelete} {
		f.request(f.token(2), method, path, map[string]any{"status": "closed"}, http.StatusNotFound, nil)
	}
	f.request(f.token(2), http.MethodGet, path+"/messages", nil, http.StatusNotFound, nil)
	f.request(f.token(2), http.MethodPost, path+"/messages", map[string]any{"sender_type": "user", "body": "intrusion"}, http.StatusNotFound, nil)
	f.request(f.token(1), http.MethodDelete, path, nil, -1, nil)
	f.request(f.token(1), http.MethodPatch, path, map[string]any{"priority": "urgent"}, http.StatusForbidden, nil)
	f.request(f.token(1), http.MethodPatch, path, map[string]any{"status": "pending"}, http.StatusForbidden, nil)
	f.request(f.token(1), http.MethodPost, path+"/messages", map[string]any{"sender_type": "admin", "body": "forged staff response"}, http.StatusForbidden, nil)
	f.request(f.token(5), http.MethodPost, path+"/messages?scope=admin", map[string]any{"sender_type": "user", "body": "forged user response"}, http.StatusForbidden, nil)

	var summary testSummary
	f.request(f.token(5), http.MethodGet, "/api/tickets/summary?scope=admin", nil, 0, &summary)
	assert.Equal(t, 1, summary.UnreadCount)
	var detail testDetail
	f.request(f.token(5), http.MethodGet, path+"?scope=admin", nil, 0, &detail)
	assert.False(t, detail.Ticket.UnreadAdmin)
	f.request(f.token(5), http.MethodPost, path+"/messages?scope=admin", map[string]any{"sender_type": "admin", "body": "Please send your request ID", "lang": "en"}, 0, &detail)
	assert.Equal(t, "pending", detail.Ticket.Status)
	assert.True(t, detail.Ticket.UnreadUser)
	assert.False(t, detail.Ticket.UnreadAdmin)
	require.Len(t, detail.Messages, 2)
	assert.Equal(t, "admin", detail.Messages[1].SenderType)
	f.request(f.token(1), http.MethodGet, "/api/tickets/summary", nil, 0, &summary)
	assert.Equal(t, 1, summary.UnreadCount)
	assert.Equal(t, 1, summary.StatusCounts["pending"])
	f.request(f.token(1), http.MethodGet, path, nil, 0, &detail)
	assert.False(t, detail.Ticket.UnreadUser)
	f.request(f.token(1), http.MethodPost, path+"/messages", map[string]any{"sender_type": "user", "body": "Request ID is test-request-123"}, 0, &detail)
	assert.Equal(t, "open", detail.Ticket.Status)
	assert.True(t, detail.Ticket.UnreadAdmin)
	assert.False(t, detail.Ticket.UnreadUser)

	f.request(f.token(1), http.MethodPatch, path, map[string]any{"status": "closed"}, 0, &detail)
	assert.Equal(t, "closed", detail.Ticket.Status)
	f.request(f.token(1), http.MethodPatch, path, map[string]any{"status": "open"}, 0, &detail)
	assert.Equal(t, "open", detail.Ticket.Status)
	f.request(f.token(5), http.MethodPatch, path+"?scope=admin", map[string]any{"status": "closed", "priority": "high"}, 0, &detail)
	assert.Equal(t, "high", detail.Ticket.Priority)
	f.request(f.token(1), http.MethodPost, path+"/messages", map[string]any{"sender_type": "user", "body": "The error returned"}, 0, &detail)
	assert.Equal(t, "open", detail.Ticket.Status)

	// Re-run startup migrations against populated tables, then reconstruct the
	// server: the ticket and all replies must survive without duplicated data.
	require.NoError(t, supportworker.Migrate(f.db))
	require.NoError(t, supportworker.Migrate(f.db))
	f.restart()
	f.request(f.token(1), http.MethodGet, path, nil, 0, &detail)
	assert.Equal(t, created.Ticket.ID, detail.Ticket.ID)
	assert.Len(t, detail.Messages, 4)
	f.request(f.token(1), http.MethodPatch, path, map[string]any{"status": "closed"}, 0, &detail)
	f.request(f.token(1), http.MethodDelete, path, nil, 0, nil)
	f.request(f.token(1), http.MethodGet, path, nil, http.StatusNotFound, nil)
	f.request(f.token(5), http.MethodGet, path+"?scope=admin", nil, http.StatusNotFound, nil)
	f.request(f.token(1), http.MethodGet, "/api/tickets/summary", nil, 0, &summary)
	assert.Equal(t, 0, summary.UnreadCount)
	assert.Equal(t, 0, summary.StatusCounts["closed"])
}

func TestSupportWorkerCaseSensitiveSiteIsolation(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	ticket := f.create(1, "Private tenant report", "account", "not_verified", nil)
	for _, siteID := range []string{strings.ToUpper(f.cfg.SiteID), strings.Replace(f.cfg.SiteID, "test-", "tést-", 1)} {
		t.Run(siteID, func(t *testing.T) {
			cfg := f.cfg
			cfg.SiteID = siteID
			worker, err := supportworker.NewServer(cfg, f.db)
			require.NoError(t, err)
			server := httptest.NewServer(worker.Handler())
			t.Cleanup(server.Close)
			other := &workerFixture{t: t, cfg: cfg, server: server}
			other.now.Store(f.now.Load())
			var page testPage
			other.request(other.token(1), http.MethodGet, "/api/tickets", nil, 0, &page)
			assert.Empty(t, page.Items, "database collation must not merge distinct site identities")
			var summary testSummary
			other.request(other.token(5), http.MethodGet, "/api/tickets/summary?scope=admin", nil, 0, &summary)
			assert.Zero(t, summary.StatusCounts["open"], "staff summaries must remain within the exact site")
			other.request(other.token(1), http.MethodGet, fmt.Sprintf("/api/tickets/%d", ticket.Ticket.ID), nil, http.StatusNotFound, nil)
		})
	}
}

func TestSupportWorkerFilteringAndPagination(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	alpha := f.create(1, "Alpha outage", "api_error", "confirmed", nil)
	beta := f.create(1, "Beta account", "account", "suspected", nil)
	gamma := f.create(1, "Gamma balance", "quota", "not_verified", nil)
	delta := f.create(1, "Delta retry", "api_error", "reproducible", nil)
	other := f.create(2, "Other owner", "refund", "confirmed", nil)
	f.request(f.token(5), http.MethodPatch, fmt.Sprintf("/api/tickets/%d?scope=admin", alpha.Ticket.ID), map[string]any{"priority": "urgent", "status": "closed"}, 0, &testDetail{})
	for _, tc := range []struct {
		query string
		ids   []int64
	}{
		{"status=closed", []int64{alpha.Ticket.ID}},
		{"category=account", []int64{beta.Ticket.ID}},
		{"priority=urgent", []int64{alpha.Ticket.ID}},
		{"verification=not_verified", []int64{gamma.Ticket.ID}},
		{"q=Delta", []int64{delta.Ticket.ID}},
		{"user_id=2", []int64{other.Ticket.ID}},
		{"category=api_error&verification=reproducible&status=open", []int64{delta.Ticket.ID}},
	} {
		t.Run(tc.query, func(t *testing.T) {
			parent := f.t
			f.t = t
			t.Cleanup(func() { f.t = parent })
			var page testPage
			f.request(f.token(5), http.MethodGet, "/api/tickets?scope=admin&"+tc.query, nil, 0, &page)
			ids := make([]int64, 0, len(page.Items))
			for _, ticket := range page.Items {
				ids = append(ids, ticket.ID)
			}
			assert.ElementsMatch(t, tc.ids, ids)
		})
	}
	f.request(f.token(1), http.MethodGet, "/api/tickets?user_id=2", nil, http.StatusForbidden, nil)
	for _, query := range []string{"status=invalid", "category=invalid", "priority=invalid", "verification=invalid", "sort=invalid", "cursor=invalid", "user_id=not-a-number"} {
		f.request(f.token(5), http.MethodGet, "/api/tickets?scope=admin&"+query, nil, http.StatusBadRequest, nil)
	}
	var page testPage
	f.request(f.token(1), http.MethodGet, "/api/tickets?limit=2&sort=updated", nil, 0, &page)
	require.Len(t, page.Items, 2)
	require.NotNil(t, page.NextCursor)
	seen := []int64{page.Items[0].ID, page.Items[1].ID}
	f.request(f.token(1), http.MethodGet, "/api/tickets?limit=2&sort=updated&cursor="+url.QueryEscape(*page.NextCursor), nil, 0, &page)
	require.Len(t, page.Items, 2)
	seen = append(seen, page.Items[0].ID, page.Items[1].ID)
	assert.ElementsMatch(t, []int64{alpha.Ticket.ID, beta.Ticket.ID, gamma.Ticket.ID, delta.Ticket.ID}, seen)
	assert.Nil(t, page.NextCursor)
	f.request(f.token(1), http.MethodGet, "/api/tickets?unread=1", nil, 0, &page)
	require.Len(t, page.Items, 1)
	assert.Equal(t, alpha.Ticket.ID, page.Items[0].ID)
	for _, query := range []string{"Other", "user-2"} {
		f.request(f.token(1), http.MethodGet, "/api/tickets?q="+query, nil, 0, &page)
		assert.Empty(t, page.Items, "search must not escape the user's ownership restriction")
	}
	f.request(f.token(5), http.MethodGet, fmt.Sprintf("/api/tickets/%d?scope=admin", alpha.Ticket.ID), nil, 0, &testDetail{})
	for _, tc := range []struct {
		sort  string
		first int64
	}{
		{"needs_action", other.Ticket.ID}, {"unread", other.Ticket.ID},
		{"priority", alpha.Ticket.ID}, {"updated", alpha.Ticket.ID},
	} {
		f.request(f.token(5), http.MethodGet, "/api/tickets?scope=admin&sort="+tc.sort, nil, 0, &page)
		require.Len(t, page.Items, 5)
		assert.Equal(t, tc.first, page.Items[0].ID, "sort=%s", tc.sort)
	}

	path := fmt.Sprintf("/api/tickets/%d/messages", beta.Ticket.ID)
	for _, text := range []string{"Second message", "Third message"} {
		f.request(f.token(1), http.MethodPost, path, map[string]any{"sender_type": "user", "body": text}, 0, &testDetail{})
		f.advance(time.Second)
	}
	var messages testMessagePage
	f.request(f.token(1), http.MethodGet, path+"?limit=2", nil, 0, &messages)
	require.Len(t, messages.Items, 2)
	assert.Equal(t, "Second message", messages.Items[0].Body)
	assert.Equal(t, "Third message", messages.Items[1].Body)
	require.NotNil(t, messages.NextCursor)
	f.request(f.token(1), http.MethodGet, path+"?limit=2&cursor="+url.QueryEscape(*messages.NextCursor), nil, 0, &messages)
	require.Len(t, messages.Items, 1)
	assert.Equal(t, beta.Messages[0].ID, messages.Items[0].ID)
	assert.Nil(t, messages.NextCursor)
}

func (f *workerFixture) upload(id int64, filename, contentType string, content []byte, success bool) testAttachment {
	f.t.Helper()
	var input bytes.Buffer
	form := multipart.NewWriter(&input)
	header := make(textproto.MIMEHeader)
	header.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	header.Set("Content-Type", contentType)
	part, err := form.CreatePart(header)
	require.NoError(f.t, err)
	_, err = part.Write(content)
	require.NoError(f.t, err)
	require.NoError(f.t, form.Close())
	req, err := http.NewRequest(http.MethodPost, f.server.URL+"/api/uploads/images", &input)
	require.NoError(f.t, err)
	req.Header.Set("Content-Type", form.FormDataContentType())
	req.Header.Set("Authorization", "Bearer "+f.token(id))
	resp, err := f.server.Client().Do(req)
	require.NoError(f.t, err)
	defer resp.Body.Close()
	var envelope struct {
		Success bool           `json:"success"`
		Message string         `json:"message"`
		Data    testAttachment `json:"data"`
	}
	require.NoError(f.t, common.DecodeJson(resp.Body, &envelope))
	if success {
		require.True(f.t, resp.StatusCode >= 200 && resp.StatusCode < 300, "upload %s returned %d: %s", filename, resp.StatusCode, envelope.Message)
		require.True(f.t, envelope.Success, envelope.Message)
		require.NotEmpty(f.t, envelope.Data.Key)
	} else {
		assert.True(f.t, resp.StatusCode >= 400, "upload %s returned %d", filename, resp.StatusCode)
		assert.False(f.t, envelope.Success)
	}
	return envelope.Data
}

func (f *workerFixture) blob(id, ticketID, attachmentID int64, scope string, status int) []byte {
	f.t.Helper()
	path := fmt.Sprintf("/api/tickets/%d/attachments/%d/blob", ticketID, attachmentID)
	if scope == "admin" {
		path += "?scope=admin"
	}
	req, err := http.NewRequest(http.MethodGet, f.server.URL+path, nil)
	require.NoError(f.t, err)
	req.Header.Set("Authorization", "Bearer "+f.token(id))
	resp, err := f.server.Client().Do(req)
	require.NoError(f.t, err)
	defer resp.Body.Close()
	content, err := io.ReadAll(resp.Body)
	require.NoError(f.t, err)
	require.Equal(f.t, status, resp.StatusCode)
	if status == http.StatusOK {
		assert.Equal(f.t, "image/png", resp.Header.Get("Content-Type"))
		assert.Equal(f.t, "nosniff", resp.Header.Get("X-Content-Type-Options"))
		assert.Contains(f.t, resp.Header.Get("Cache-Control"), "no-store")
	}
	return content
}

func TestSupportWorkerAttachmentAuthorizationAndValidation(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	var pngData, jpegData, gifData bytes.Buffer
	require.NoError(t, png.Encode(&pngData, img))
	require.NoError(t, jpeg.Encode(&jpegData, img, nil))
	require.NoError(t, gif.Encode(&gifData, img, nil))
	webpData, err := base64.StdEncoding.DecodeString("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=")
	require.NoError(t, err)
	_, _, err = image.Decode(bytes.NewReader(webpData))
	require.NoError(t, err, "the WebP fixture must be a complete decodable image")
	imageFile := f.upload(1, "evidence.png", "image/png", pngData.Bytes(), true)
	f.upload(1, "evidence.jpg", "image/jpeg", jpegData.Bytes(), true)
	f.upload(1, "evidence.gif", "image/gif", gifData.Bytes(), true)
	f.upload(1, "evidence.webp", "image/webp", webpData, true)
	for _, tc := range []struct {
		name, mime string
		body       []byte
	}{
		{"empty.png", "image/png", nil},
		{"script.svg", "image/svg+xml", []byte(`<svg onload="alert(1)"></svg>`)},
		{"spoof.png", "image/png", []byte("<html>not an image</html>")},
		{"truncated.png", "image/png", pngData.Bytes()[:33]},
		{"wrong.jpg", "image/jpeg", pngData.Bytes()},
		{"double.png.html", "image/png", pngData.Bytes()},
		{"oversize.png", "image/png", append(append([]byte{}, pngData.Bytes()...), make([]byte, 8*1024*1024)...)},
	} {
		t.Run(tc.name, func(t *testing.T) {
			parent := f.t
			f.t = t
			t.Cleanup(func() { f.t = parent })
			f.upload(1, tc.name, tc.mime, tc.body, false)
		})
	}
	payload := map[string]any{"title": "Image proof", "category": "other", "verification_level": "confirmed", "body": "See attachment", "attachments": []testAttachment{imageFile}}
	f.request(f.token(2), http.MethodPost, "/api/tickets", payload, http.StatusBadRequest, nil)
	payload["attachments"] = []testAttachment{{Key: "../../outside.png", Name: "forged.png"}}
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, http.StatusBadRequest, nil)
	forgedMetadata := imageFile
	forgedMetadata.ID, forgedMetadata.Size, forgedMetadata.Name = 999999, 1, "forged.svg"
	attached := f.create(1, "Image proof", "other", "confirmed", []testAttachment{forgedMetadata})
	require.Len(t, attached.Messages[0].Attachments, 1)
	attachmentID := attached.Messages[0].Attachments[0].ID
	require.Positive(t, attachmentID)
	assert.NotEqual(t, int64(999999), attachmentID)
	assert.Equal(t, "evidence.png", attached.Messages[0].Attachments[0].Name)
	assert.Equal(t, int64(pngData.Len()), attached.Messages[0].Attachments[0].Size)
	assert.Equal(t, pngData.Bytes(), f.blob(1, attached.Ticket.ID, attachmentID, "user", http.StatusOK))
	assert.Equal(t, pngData.Bytes(), f.blob(5, attached.Ticket.ID, attachmentID, "admin", http.StatusOK))
	f.blob(2, attached.Ticket.ID, attachmentID, "user", http.StatusNotFound)
	other := f.create(1, "Another ticket", "other", "not_verified", nil)
	f.blob(1, other.Ticket.ID, attachmentID, "user", http.StatusNotFound)
	payload["attachments"] = []testAttachment{imageFile}
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, http.StatusBadRequest, nil)
	f.request(f.token(1), http.MethodPost, fmt.Sprintf("/api/tickets/%d/messages", other.Ticket.ID), map[string]any{"sender_type": "user", "body": "reuse", "attachments": []testAttachment{imageFile}}, http.StatusBadRequest, nil)

	files := make([]testAttachment, 0, 6)
	for i := range 6 {
		files = append(files, f.upload(1, fmt.Sprintf("evidence-%d.png", i), "image/png", pngData.Bytes(), true))
	}
	payload["attachments"] = files
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, http.StatusBadRequest, nil)
	f.advance(time.Hour)
	f.create(1, "Five allowed images", "other", "confirmed", files[:5])
	path := fmt.Sprintf("/api/tickets/%d", attached.Ticket.ID)
	f.request(f.token(1), http.MethodPatch, path, map[string]any{"status": "closed"}, 0, &testDetail{})
	f.request(f.token(1), http.MethodDelete, path, nil, 0, nil)
	f.blob(1, attached.Ticket.ID, attachmentID, "user", http.StatusNotFound)
	cleaned, err := f.worker.CleanupUploads(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 1, cleaned, "deleting a ticket should remove its attachment")
	staged := f.upload(1, "expired.png", "image/png", pngData.Bytes(), true)
	f.advance(25 * time.Hour)
	payload["attachments"] = []testAttachment{staged}
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, http.StatusBadRequest, nil)
	cleaned, err = f.worker.CleanupUploads(context.Background())
	require.NoError(t, err)
	assert.Equal(t, 5, cleaned, "unclaimed uploads must expire without deleting attachments on live tickets")
}

func TestSupportWorkerNotificationsRetryTheSameEvent(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	ticket := f.create(1, "Notification retry", "other", "not_verified", nil)
	path := fmt.Sprintf("/api/tickets/%d/messages?scope=admin", ticket.Ticket.ID)
	f.request(f.token(5), http.MethodPost, path, map[string]any{"sender_type": "admin", "body": "Your issue is resolved"}, 0, &testDetail{})
	f.gateway.mu.Lock()
	f.gateway.loseNotifyReply = true
	f.gateway.mu.Unlock()
	_, _ = f.worker.DeliverNotifications(context.Background())
	f.gateway.mu.Lock()
	require.Len(t, f.gateway.notifications, 1)
	first := f.gateway.notifications[0]
	assert.Equal(t, int64(1), first.UserID)
	assert.Contains(t, first.Content, "Your issue is resolved")
	f.gateway.mu.Unlock()
	_, _ = f.worker.DeliverNotifications(context.Background())
	f.gateway.mu.Lock()
	assert.Len(t, f.gateway.notifications, 1, "failed callbacks should wait for their retry window")
	f.gateway.mu.Unlock()
	// A process restart must preserve both the pending event and its retry key.
	f.restart()
	f.advance(2 * time.Hour)
	_, err := f.worker.DeliverNotifications(context.Background())
	require.NoError(t, err)
	f.gateway.mu.Lock()
	require.Len(t, f.gateway.notifications, 2)
	assert.Equal(t, first, f.gateway.notifications[1], "a retry must retain the same idempotency key and payload")
	assert.Len(t, f.gateway.acceptedEvents, 1, "the gateway accepts an event once even when the acknowledgement was lost")
	f.gateway.mu.Unlock()
	_, err = f.worker.DeliverNotifications(context.Background())
	require.NoError(t, err)
	f.gateway.mu.Lock()
	assert.Len(t, f.gateway.notifications, 2, "successful delivery must not be replayed")
	f.gateway.mu.Unlock()
	f.request(f.token(5), http.MethodPost, path, map[string]any{"sender_type": "admin", "body": "A separate follow-up"}, 0, &testDetail{})
	_, err = f.worker.DeliverNotifications(context.Background())
	require.NoError(t, err)
	f.gateway.mu.Lock()
	require.Len(t, f.gateway.notifications, 3)
	assert.NotEqual(t, first.EventID, f.gateway.notifications[2].EventID, "different replies need different notification events")
	assert.Len(t, f.gateway.acceptedEvents, 2)
	f.gateway.mu.Unlock()
}

func TestSupportWorkerCreateLimitSurvivesRestart(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	for i := range 5 {
		f.create(1, fmt.Sprintf("Allowed ticket %d", i), "other", "not_verified", nil)
	}
	f.restart()
	response := f.request(f.token(1), http.MethodPost, "/api/tickets", map[string]any{
		"title": "Rate limited", "category": "other", "verification_level": "not_verified", "body": "A sixth ticket in the same hour",
	}, http.StatusTooManyRequests, nil)
	assert.NotEmpty(t, response.Header.Get("Retry-After"))
	f.create(2, "Another user's quota", "other", "not_verified", nil)
	f.advance(time.Hour)
	f.create(1, "Next window", "other", "not_verified", nil)
}

func TestSupportWorkerRequestReplayDoesNotDuplicateTicketsMessagesOrNotifications(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	requestID := "create_ticket-request_01"
	payload := map[string]any{
		"client_request_id": requestID, "title": "A retried ticket", "category": "api_error",
		"verification_level": "confirmed", "body": "The connection was lost after saving",
	}
	var created, replay testDetail
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, 0, &created)
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, 0, &replay)
	assert.Equal(t, created.Ticket.ID, replay.Ticket.ID)
	require.Len(t, replay.Messages, 1)
	assert.Equal(t, created.Messages[0].ID, replay.Messages[0].ID)
	f.restart()
	f.request(f.token(1), http.MethodPost, "/api/tickets", payload, 0, &replay)
	assert.Equal(t, created.Ticket.ID, replay.Ticket.ID)
	var page testPage
	f.request(f.token(1), http.MethodGet, "/api/tickets", nil, 0, &page)
	require.Len(t, page.Items, 1)
	changed := maps.Clone(payload)
	changed["body"] = "A different operation must not overwrite the original"
	f.request(f.token(1), http.MethodPost, "/api/tickets", changed, http.StatusConflict, nil)
	for _, id := range []string{strings.Repeat("x", 129), "line\nbreak"} {
		invalid := maps.Clone(payload)
		invalid["client_request_id"] = id
		f.request(f.token(1), http.MethodPost, "/api/tickets", invalid, http.StatusBadRequest, nil)
	}
	var otherUser testDetail
	f.request(f.token(2), http.MethodPost, "/api/tickets", payload, 0, &otherUser)
	assert.NotEqual(t, created.Ticket.ID, otherUser.Ticket.ID, "request IDs must be scoped to their authenticated actor")
	assert.Equal(t, int64(2), otherUser.Ticket.UserID)
	boundary := maps.Clone(payload)
	boundary["client_request_id"] = strings.Repeat("x", 128)
	f.request(f.token(2), http.MethodPost, "/api/tickets", boundary, 0, &testDetail{})

	path := fmt.Sprintf("/api/tickets/%d/messages", created.Ticket.ID)
	userReply := map[string]any{"client_request_id": requestID, "sender_type": "user", "body": "Additional context"}
	f.request(f.token(1), http.MethodPost, path, userReply, 0, &replay)
	require.Len(t, replay.Messages, 2, "a new operation may reuse an ID from ticket creation")
	f.request(f.token(1), http.MethodPost, path, userReply, 0, &replay)
	assert.Len(t, replay.Messages, 2)
	var imageData bytes.Buffer
	require.NoError(t, png.Encode(&imageData, image.NewRGBA(image.Rect(0, 0, 1, 1))))
	attachment := f.upload(5, "reply.png", "image/png", imageData.Bytes(), true)
	staffReply := map[string]any{
		"client_request_id": requestID, "sender_type": "admin", "body": "Reply with image",
		"attachments": []testAttachment{attachment},
	}
	f.request(f.token(5), http.MethodPost, path+"?scope=admin", staffReply, 0, &replay)
	require.Len(t, replay.Messages, 3)
	messageID := replay.Messages[2].ID
	f.restart()
	f.request(f.token(5), http.MethodPost, path+"?scope=admin", staffReply, 0, &replay)
	require.Len(t, replay.Messages, 3)
	assert.Equal(t, messageID, replay.Messages[2].ID)
	require.Len(t, replay.Messages[2].Attachments, 1, "retrying an already bound image must reuse the saved message")
	changedReply := maps.Clone(staffReply)
	changedReply["body"] = "This must conflict"
	f.request(f.token(5), http.MethodPost, path+"?scope=admin", changedReply, http.StatusConflict, nil)
	_, err := f.worker.DeliverNotifications(context.Background())
	require.NoError(t, err)
	f.gateway.mu.Lock()
	assert.Len(t, f.gateway.notifications, 1, "replayed replies must not enqueue another notification")
	f.gateway.mu.Unlock()
}

func (f *workerFixture) concurrentRequests(addresses []string, token, path string, payload any) []testDetail {
	f.t.Helper()
	encoded, err := common.Marshal(payload)
	require.NoError(f.t, err)
	type replyResult struct {
		status int
		err    error
		body   struct {
			Success bool       `json:"success"`
			Message string     `json:"message"`
			Data    testDetail `json:"data"`
		}
	}
	results := make(chan replyResult, len(addresses))
	start := make(chan struct{})
	var requests sync.WaitGroup
	for _, address := range addresses {
		requests.Go(func() {
			<-start
			var result replyResult
			req, err := http.NewRequest(http.MethodPost, address+path, bytes.NewReader(encoded))
			if err != nil {
				result.err = err
				results <- result
				return
			}
			req.Header.Set("Authorization", "Bearer "+token)
			req.Header.Set("Content-Type", "application/json")
			resp, err := f.server.Client().Do(req)
			if err != nil {
				result.err = err
				results <- result
				return
			}
			defer resp.Body.Close()
			result.status = resp.StatusCode
			result.err = common.DecodeJson(resp.Body, &result.body)
			results <- result
		})
	}
	close(start)
	requests.Wait()
	close(results)
	details := make([]testDetail, 0, len(addresses))
	for result := range results {
		require.NoError(f.t, result.err)
		require.Equal(f.t, http.StatusOK, result.status, result.body.Message)
		require.True(f.t, result.body.Success, result.body.Message)
		details = append(details, result.body.Data)
	}
	return details
}

func TestSupportWorkerConcurrentRequestReplayCreatesOneOperation(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	secondWorker, err := supportworker.NewServer(f.cfg, f.db)
	require.NoError(t, err)
	secondServer := httptest.NewServer(secondWorker.Handler())
	t.Cleanup(secondServer.Close)
	addresses := []string{f.server.URL, secondServer.URL}
	created := f.concurrentRequests(addresses, f.token(1), "/api/tickets", map[string]string{
		"client_request_id": "parallel-create_01", "title": "Concurrent retry", "category": "api_error",
		"verification_level": "confirmed", "body": "One logical ticket",
	})
	require.Len(t, created, 2)
	assert.Equal(t, created[0].Ticket.ID, created[1].Ticket.ID)
	require.Len(t, created[0].Messages, 1)
	require.Len(t, created[1].Messages, 1)
	assert.Equal(t, created[0].Messages[0].ID, created[1].Messages[0].ID)
	ticketID := created[0].Ticket.ID
	path := fmt.Sprintf("/api/tickets/%d/messages?scope=admin", ticketID)
	replies := f.concurrentRequests(addresses, f.token(5), path, map[string]string{
		"client_request_id": "parallel-reply_01", "sender_type": "admin", "body": "One logical reply",
	})
	require.Len(t, replies, 2)
	require.Len(t, replies[0].Messages, 2)
	require.Len(t, replies[1].Messages, 2)
	assert.Equal(t, replies[0].Messages[1].ID, replies[1].Messages[1].ID)
	var page testPage
	f.request(f.token(1), http.MethodGet, "/api/tickets", nil, 0, &page)
	assert.Len(t, page.Items, 1)
	var detail testDetail
	f.request(f.token(1), http.MethodGet, fmt.Sprintf("/api/tickets/%d", ticketID), nil, 0, &detail)
	assert.Len(t, detail.Messages, 2)
	_, err = f.worker.DeliverNotifications(context.Background())
	require.NoError(t, err)
	f.gateway.mu.Lock()
	assert.Len(t, f.gateway.notifications, 1)
	f.gateway.mu.Unlock()
}

func TestSupportWorkerTranslationsRespectAccessAndReview(t *testing.T) {
	f := newWorkerFixture(t, supportworker.TranslationConfig{}, nil)
	ticket := f.create(1, "English report", "other", "not_verified", nil)
	path := fmt.Sprintf("/api/tickets/%d/messages/%d", ticket.Ticket.ID, ticket.Messages[0].ID)
	disabled := f.request(f.token(5), http.MethodPost, path+"/translate?scope=admin", map[string]string{"lang": "zh"}, -1, nil)
	assert.Equal(t, "Message translation is not enabled", disabled.Message)

	var calls atomic.Int32
	translator := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, http.MethodPost, r.Method)
		assert.Equal(t, "Bearer translation-test-key", r.Header.Get("Authorization"))
		var body struct {
			Model    string `json:"model"`
			Messages []struct {
				Content string `json:"content"`
			} `json:"messages"`
		}
		if !assert.NoError(t, common.DecodeJson(r.Body, &body)) {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		assert.Equal(t, "translation-test-model", body.Model)
		assert.NotEmpty(t, body.Messages)
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(w, `{"choices":[{"message":{"content":"机器翻译内容"}}]}`)
	}))
	t.Cleanup(translator.Close)
	f = newWorkerFixture(t, supportworker.TranslationConfig{URL: translator.URL, APIKey: "translation-test-key", Model: "translation-test-model"}, translator.Client())
	ticket = f.create(1, "English report", "other", "not_verified", nil)
	path = fmt.Sprintf("/api/tickets/%d/messages/%d", ticket.Ticket.ID, ticket.Messages[0].ID)
	var translation testTranslation
	f.request(f.token(5), http.MethodPost, path+"/translate?scope=admin", map[string]string{"lang": "zh"}, 0, &translation)
	assert.Equal(t, testTranslation{Body: "机器翻译内容", Status: "machine"}, translation)
	f.request(f.token(5), http.MethodPut, path+"/translation?scope=admin", map[string]string{"lang": "zh", "body": "人工校对内容"}, 0, &translation)
	assert.Equal(t, testTranslation{Body: "人工校对内容", Status: "reviewed"}, translation)
	f.request(f.token(5), http.MethodPost, path+"/translate?scope=admin", map[string]string{"lang": "zh"}, 0, &translation)
	assert.Equal(t, "人工校对内容", translation.Body)
	assert.Equal(t, "reviewed", translation.Status)
	assert.Equal(t, int32(1), calls.Load(), "a cached reviewed translation must not be regenerated")
	var detail testDetail
	f.request(f.token(1), http.MethodGet, fmt.Sprintf("/api/tickets/%d?lang=zh", ticket.Ticket.ID), nil, 0, &detail)
	assert.Equal(t, "人工校对内容", detail.Translations[ticket.Messages[0].ID].Body)
	f.request(f.token(2), http.MethodPost, path+"/translate", map[string]string{"lang": "fr"}, http.StatusNotFound, nil)
	f.request(f.token(1), http.MethodPut, path+"/translation", map[string]string{"lang": "zh", "body": "unauthorized review"}, http.StatusForbidden, nil)
	f.request(f.token(5), http.MethodPost, path+"/translate?scope=admin", map[string]string{"lang": "../../invalid"}, http.StatusBadRequest, nil)
	other := f.create(1, "Other English report", "other", "not_verified", nil)
	wrongPath := fmt.Sprintf("/api/tickets/%d/messages/%d/translate?scope=admin", other.Ticket.ID, ticket.Messages[0].ID)
	f.request(f.token(5), http.MethodPost, wrongPath, map[string]string{"lang": "fr"}, http.StatusNotFound, nil)
}
