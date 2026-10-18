package controller

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/service/authz"
	"github.com/QuantumNous/new-api/setting/support_setting"
	"github.com/QuantumNous/new-api/supportworker"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func supportTestRequest(t *testing.T, router http.Handler, method, path, token string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body := ""
	if payload != nil {
		encoded, err := common.Marshal(payload)
		require.NoError(t, err)
		body = string(encoded)
	}
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestSupportUserLookupExcludesPrivateFields(t *testing.T) {
	actor, _ := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.Model(actor).Update("role", common.RoleSupportUser).Error)
	require.NoError(t, model.PublishUserAuthCache(actor.Id))
	bundle, err := service.CreateLoginSession(actor.Id, "password", "127.0.0.1", "support-test")
	require.NoError(t, err)
	settings, err := common.Marshal(map[string]string{"webhook_secret": "fixture-webhook", "gotify_token": "fixture-gotify"})
	require.NoError(t, err)
	target := model.User{Username: "support-customer", Password: "fixture-password", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, Email: "customer@example.com", Group: "default", AffCode: "support-customer-aff", Setting: string(settings), Remark: "administrator-only", GitHubId: "private-binding", StripeCustomer: "private-customer", AuthVersion: 1}
	require.NoError(t, model.DB.Create(&target).Error)
	router := gin.New()
	router.GET("/api/user/", middleware.SupportAuth(), GetAllUsers)
	router.GET("/api/user/search", middleware.SupportAuth(), SearchUsers)
	router.GET("/api/user/:id", middleware.SupportAuth(), GetUser)
	router.POST("/api/user/manage", middleware.AdminAuth(), ManageUser)
	for _, path := range []string{"/api/user/", "/api/user/search?keyword=support-customer", fmt.Sprintf("/api/user/%d", target.Id)} {
		t.Run(path, func(t *testing.T) {
			response := supportTestRequest(t, router, http.MethodGet, path, bundle.AccessToken, nil)
			require.Equal(t, http.StatusOK, response.Code)
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			require.Equal(t, true, result["success"])
			data := result["data"].(map[string]any)
			rows := []any{data}
			if items, ok := data["items"].([]any); ok {
				rows = items
			}
			require.NotEmpty(t, rows)
			for _, row := range rows {
				fields := row.(map[string]any)
				assert.Contains(t, fields, "id")
				assert.Contains(t, fields, "username")
				assert.Contains(t, fields, "status")
				for _, key := range []string{"setting", "password", "original_password", "remark", "stripe_customer", "github_id", "admin_permissions", "access_token"} {
					assert.NotContains(t, fields, key)
				}
			}
			assert.NotContains(t, response.Body.String(), "fixture-webhook")
			assert.NotContains(t, response.Body.String(), "fixture-gotify")
		})
	}
	response := supportTestRequest(t, router, http.MethodPost, "/api/user/manage", bundle.AccessToken, map[string]any{"id": target.Id, "action": "disable"})
	assert.Equal(t, http.StatusForbidden, response.Code)
	require.NoError(t, model.DB.Model(actor).Update("role", common.RoleCommonUser).Error)
	require.NoError(t, model.PublishUserAuthCache(actor.Id))
	response = supportTestRequest(t, router, http.MethodGet, "/api/user/", bundle.AccessToken, nil)
	assert.Equal(t, http.StatusForbidden, response.Code)
}

func TestSupportWorkerVerificationChecksRoleAndLiveSession(t *testing.T) {
	actor, _ := setupSecurityEnrollmentTest(t)
	oldSecret := support_setting.CallbackSecret
	support_setting.CallbackSecret = "test-callback-secret-at-least-32-characters"
	t.Cleanup(func() { support_setting.CallbackSecret = oldSecret })
	router := gin.New()
	router.POST("/verify", SupportWorkerVerify)
	for _, tc := range []struct {
		name                                       string
		role                                       int
		scope                                      string
		disabled, revoked, wrongBinding, badSecret bool
		want                                       bool
	}{
		{name: "customer user scope", role: common.RoleCommonUser, scope: "user", want: true},
		{name: "customer denied staff scope", role: common.RoleCommonUser, scope: "admin"},
		{name: "support allowed staff scope", role: common.RoleSupportUser, scope: "admin", want: true},
		{name: "administrator allowed", role: common.RoleAdminUser, scope: "admin", want: true},
		{name: "disabled support denied", role: common.RoleSupportUser, scope: "admin", disabled: true},
		{name: "revoked session denied", role: common.RoleSupportUser, scope: "admin", revoked: true},
		{name: "wrong session version denied", role: common.RoleSupportUser, scope: "admin", wrongBinding: true},
		{name: "unknown scope denied", role: common.RoleCommonUser, scope: "administratr"},
		{name: "missing scope denied", role: common.RoleCommonUser, scope: ""},
		{name: "incorrect callback credential denied", role: common.RoleSupportUser, scope: "admin", badSecret: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			require.NoError(t, model.DB.Model(actor).Updates(map[string]any{"role": tc.role, "status": common.UserStatusEnabled}).Error)
			require.NoError(t, model.PublishUserAuthCache(actor.Id))
			bundle, err := service.CreateLoginSession(actor.Id, "password", "127.0.0.1", "support-verify-test")
			require.NoError(t, err)
			identity, err := service.ParseAccessToken(bundle.AccessToken)
			require.NoError(t, err)
			if tc.disabled {
				require.NoError(t, model.DB.Model(actor).Update("status", common.UserStatusDisabled).Error)
				require.NoError(t, model.PublishUserAuthCache(actor.Id))
			}
			if tc.revoked {
				_, err = model.RevokeUserSession(actor.Id, identity.SessionID, "test")
				require.NoError(t, err)
			}
			if tc.wrongBinding {
				identity.SessionVersion++
			}
			secret := support_setting.CallbackSecret
			if tc.badSecret {
				secret = "incorrect-callback-secret"
			}
			response := supportTestRequest(t, router, http.MethodPost, "/verify", secret, map[string]any{"user_id": actor.Id, "scope": tc.scope, "sid": identity.SessionID, "uv": identity.UserAuthVersion, "sv": identity.SessionVersion})
			var result map[string]any
			require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
			assert.Equal(t, tc.want, result["success"])
			assert.NotContains(t, response.Body.String(), support_setting.CallbackSecret)
		})
	}
}

func TestCreateSupportUserRequiresBoundSingleUseProof(t *testing.T) {
	_, identity, _ := setupAdminUserTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.CasbinRule{}, &model.AuthzRole{}))
	require.NoError(t, authz.Init(model.DB))
	body := fmt.Sprintf(`{"username":"new-support","password":"support-password-1","role":%d}`, common.RoleSupportUser)
	response := adminUserRequest(http.MethodPost, "/api/user/", body, "", identity, common.RoleRootUser, nil, CreateUser)
	result := decodeSecurityEnrollmentResponse(t, response)
	assert.False(t, result.Success)
	var count int64
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "new-support").Count(&count).Error)
	assert.Zero(t, count)
	operation := service.VerificationOperation{Scope: service.VerificationScopeAdminUserCreate, Context: []byte(fmt.Sprintf(`{"role":%d}`, common.RoleSupportUser))}
	proof := issueSecurityEnrollmentProof(t, identity, operation, service.VerificationMethodPassword)
	response = adminUserRequest(http.MethodPost, "/api/user/", body, proof, identity, common.RoleRootUser, nil, CreateUser)
	result = decodeSecurityEnrollmentResponse(t, response)
	require.True(t, result.Success, result.Message)
	var created model.User
	require.NoError(t, model.DB.Where("username = ?", "new-support").First(&created).Error)
	assert.Equal(t, common.RoleSupportUser, created.Role)
	replayBody := strings.ReplaceAll(body, "new-support", "replayed-support")
	response = adminUserRequest(http.MethodPost, "/api/user/", replayBody, proof, identity, common.RoleRootUser, nil, CreateUser)
	assert.False(t, decodeSecurityEnrollmentResponse(t, response).Success)
	require.NoError(t, model.DB.Model(&model.User{}).Where("username = ?", "replayed-support").Count(&count).Error)
	assert.Zero(t, count)
}

func TestSupportNotificationDeliveryIsBoundAndRetryable(t *testing.T) {
	setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SupportNotification{}))
	calls := 0
	deliver := func() error { calls++; return nil }
	require.NoError(t, model.DeliverSupportNotification("event-1", 7, "payload-1", deliver))
	require.NoError(t, model.DeliverSupportNotification("event-1", 7, "payload-1", deliver))
	assert.Equal(t, 1, calls)
	assert.ErrorIs(t, model.DeliverSupportNotification("event-1", 8, "payload-1", deliver), model.ErrSupportNotificationConflict)
	assert.ErrorIs(t, model.DeliverSupportNotification("event-1", 7, "payload-2", deliver), model.ErrSupportNotificationConflict)
	failed := errors.New("temporary delivery failure")
	assert.ErrorIs(t, model.DeliverSupportNotification("event-2", 7, "payload-1", func() error { return failed }), failed)
	require.NoError(t, model.DeliverSupportNotification("event-2", 7, "payload-1", deliver))
	assert.Equal(t, 2, calls)
	// Repeated migration preserves successful receipts and their suppression.
	require.NoError(t, model.DB.AutoMigrate(&model.SupportNotification{}))
	require.NoError(t, model.DB.AutoMigrate(&model.SupportNotification{}))
	require.NoError(t, model.DeliverSupportNotification("event-1", 7, "payload-1", deliver))
	assert.Equal(t, 2, calls)
}

func TestSupportNotificationConcurrentRetryDoesNotDeliverTwice(t *testing.T) {
	setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SupportNotification{}))
	started, release := make(chan struct{}), make(chan struct{})
	completed := make(chan error, 1)
	var calls atomic.Int32
	go func() {
		completed <- model.DeliverSupportNotification("concurrent-event", 7, "payload", func() error { calls.Add(1); close(started); <-release; return nil })
	}()
	<-started
	err := model.DeliverSupportNotification("concurrent-event", 7, "payload", func() error { calls.Add(1); return nil })
	assert.ErrorIs(t, err, model.ErrSupportNotificationPending)
	close(release)
	require.NoError(t, <-completed)
	require.NoError(t, model.DeliverSupportNotification("concurrent-event", 7, "payload", func() error { calls.Add(1); return nil }))
	assert.EqualValues(t, 1, calls.Load())
}

// The sink implements only the SMTP commands used by the real mail sender. It
// binds exclusively to loopback and never forwards messages to another server.
func newSupportSMTPSink(t *testing.T) (string, int, <-chan string, *atomic.Int32) {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	host, portText, err := net.SplitHostPort(listener.Addr().String())
	require.NoError(t, err)
	port, err := strconv.Atoi(portText)
	require.NoError(t, err)
	messages := make(chan string, 4)
	var deliveries atomic.Int32
	stopped := make(chan struct{})
	go func() {
		defer close(stopped)
		for {
			connection, err := listener.Accept()
			if err != nil {
				return
			}
			func() {
				defer connection.Close()
				if !assert.NoError(t, connection.SetDeadline(time.Now().Add(5*time.Second))) {
					return
				}
				protocol := textproto.NewConn(connection)
				if !assert.NoError(t, protocol.PrintfLine("220 support.test ESMTP")) {
					return
				}
				for {
					line, err := protocol.ReadLine()
					if err != nil {
						assert.ErrorIs(t, err, io.EOF)
						return
					}
					command, _, _ := strings.Cut(line, " ")
					switch command {
					case "EHLO", "HELO", "MAIL", "RCPT", "RSET", "NOOP":
						err = protocol.PrintfLine("250 OK")
					case "DATA":
						if !assert.NoError(t, protocol.PrintfLine("354 End data with <CR><LF>.<CR><LF>")) {
							return
						}
						data, readErr := protocol.ReadDotBytes()
						if !assert.NoError(t, readErr) {
							return
						}
						deliveries.Add(1)
						select {
						case messages <- string(data):
						default:
							t.Error("unexpected repeated SMTP deliveries")
						}
						err = protocol.PrintfLine("250 Accepted")
					case "QUIT":
						assert.NoError(t, protocol.PrintfLine("221 Bye"))
						return
					default:
						t.Errorf("unexpected SMTP command %q", command)
						err = protocol.PrintfLine("502 Unsupported command")
					}
					if !assert.NoError(t, err) {
						return
					}
				}
			}()
		}
	}()
	t.Cleanup(func() {
		assert.NoError(t, listener.Close())
		<-stopped
	})
	return host, port, messages, &deliveries
}

func supportHTTPTestRequest(t *testing.T, client *http.Client, method, endpoint, token string, payload, result any) int {
	t.Helper()
	var body []byte
	var err error
	if payload != nil {
		body, err = common.Marshal(payload)
		require.NoError(t, err)
	}
	request, err := http.NewRequestWithContext(t.Context(), method, endpoint, bytes.NewReader(body))
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+token)
	response, err := client.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	require.NoError(t, common.DecodeJson(response.Body, result))
	return response.StatusCode
}

func TestSupportGatewayWorkerRoundTrip(t *testing.T) {
	owner, _ := setupSecurityEnrollmentTest(t)
	require.NoError(t, model.DB.AutoMigrate(&model.SupportNotification{}))
	require.NoError(t, model.DB.Model(owner).Update("email", "customer@example.invalid").Error)
	require.NoError(t, model.PublishUserAuthCache(owner.Id))
	staff := model.User{
		Username: "roundtrip-support", Password: owner.Password, Email: "staff@example.invalid",
		Role: common.RoleSupportUser, Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1,
		AffCode: "roundtrip-support-aff",
	}
	require.NoError(t, model.DB.Create(&staff).Error)
	require.NoError(t, model.PublishUserAuthCache(staff.Id))
	ownerLogin, err := service.CreateLoginSession(owner.Id, "password", "127.0.0.1", "support-customer")
	require.NoError(t, err)
	staffLogin, err := service.CreateLoginSession(staff.Id, "password", "127.0.0.1", "support-staff")
	require.NoError(t, err)

	oldWorkerURL, oldJWT, oldCallback, oldSite := support_setting.WorkerUrl, support_setting.JwtSecret, support_setting.CallbackSecret, support_setting.SiteID
	oldTTL := support_setting.SessionTTLMinutes
	oldSMTPServer, oldSMTPPort, oldSMTPFrom := common.SMTPServer, common.SMTPPort, common.SMTPFrom
	oldSMTPAccount, oldSMTPToken := common.SMTPAccount, common.SMTPToken
	oldSMTPSSL, oldSMTPStartTLS := common.SMTPSSLEnabled, common.SMTPStartTLSEnabled
	oldNotifyLimit, oldNotifyWindow := constant.NotifyLimitCount, constant.NotificationLimitDurationMinute
	t.Cleanup(func() {
		support_setting.WorkerUrl, support_setting.JwtSecret, support_setting.CallbackSecret, support_setting.SiteID = oldWorkerURL, oldJWT, oldCallback, oldSite
		support_setting.SessionTTLMinutes = oldTTL
		common.SMTPServer, common.SMTPPort, common.SMTPFrom = oldSMTPServer, oldSMTPPort, oldSMTPFrom
		common.SMTPAccount, common.SMTPToken = oldSMTPAccount, oldSMTPToken
		common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = oldSMTPSSL, oldSMTPStartTLS
		constant.NotifyLimitCount, constant.NotificationLimitDurationMinute = oldNotifyLimit, oldNotifyWindow
	})
	var mail <-chan string
	var deliveries *atomic.Int32
	common.SMTPServer, common.SMTPPort, mail, deliveries = newSupportSMTPSink(t)
	common.SMTPFrom = "support@example.invalid"
	common.SMTPAccount, common.SMTPToken = "", ""
	common.SMTPSSLEnabled, common.SMTPStartTLSEnabled = false, false
	// Expire prior test-process notification counters; deduplication must come
	// from the persisted event receipt, not from the unrelated notification limit.
	constant.NotifyLimitCount, constant.NotificationLimitDurationMinute = 10, 0
	support_setting.JwtSecret = "gateway-worker-roundtrip-signing-secret-32"
	support_setting.CallbackSecret = "gateway-worker-roundtrip-callback-secret-32"
	support_setting.SiteID, support_setting.SessionTTLMinutes = "roundtrip-site", 30

	var verifyCalls atomic.Int32
	gatewayRouter := gin.New()
	gatewayRouter.GET("/api/support/session", middleware.UserAuth(), middleware.DisableCache(), GetSupportSession)
	gatewayRouter.POST("/api/support/worker/verify", func(c *gin.Context) { verifyCalls.Add(1) }, SupportWorkerVerify)
	gatewayRouter.POST("/api/support/worker/notify", SupportWorkerNotify)
	gatewayRouter.POST("/api/user/auth/logout", AuthLogout)
	gateway := httptest.NewServer(gatewayRouter)
	t.Cleanup(gateway.Close)

	dialect := os.Getenv("TEST_SECURITY_DIALECT")
	if dialect == "" {
		dialect = "sqlite"
	}
	seedDB, workerDSN := newAuditTestDatabase(t, dialect, os.Getenv("TEST_"+strings.ToUpper(dialect)+"_DSN"))
	seedConnection, err := seedDB.DB()
	require.NoError(t, err)
	require.NoError(t, seedConnection.Close())
	workerDB, err := supportworker.OpenDatabase(dialect, workerDSN)
	require.NoError(t, err)
	workerConnection, err := workerDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() { assert.NoError(t, workerConnection.Close()) })
	worker, err := supportworker.NewServer(supportworker.Config{
		SiteID: support_setting.SiteID, GatewayURL: gateway.URL,
		JWTSecret: support_setting.JwtSecret, CallbackSecret: support_setting.CallbackSecret,
		AllowedOrigins: []string{gateway.URL}, UploadDir: t.TempDir(),
	}, workerDB)
	require.NoError(t, err)
	workerHTTP := httptest.NewServer(worker.Handler())
	t.Cleanup(workerHTTP.Close)
	support_setting.WorkerUrl = workerHTTP.URL
	client := &http.Client{Timeout: 10 * time.Second}
	var ownerSession, staffSession struct {
		Success bool                   `json:"success"`
		Message string                 `json:"message"`
		Data    service.SupportSession `json:"data"`
	}
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodGet, gateway.URL+"/api/support/session", ownerLogin.AccessToken, nil, &ownerSession))
	require.True(t, ownerSession.Success, ownerSession.Message)
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodGet, gateway.URL+"/api/support/session", staffLogin.AccessToken, nil, &staffSession))
	require.True(t, staffSession.Success, staffSession.Message)
	assert.Equal(t, workerHTTP.URL, ownerSession.Data.WorkerUrl)
	assert.Equal(t, owner.Id, ownerSession.Data.User.Id)
	assert.True(t, ownerSession.Data.Notify.Configured)

	var detail struct {
		Success bool                       `json:"success"`
		Message string                     `json:"message"`
		Data    supportworker.TicketDetail `json:"data"`
	}
	create := map[string]any{"title": "Gateway round trip", "category": "other", "verification_level": "not_verified", "body": "Customer needs help", "lang": "en", "attachments": []any{}}
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodPost, workerHTTP.URL+"/api/tickets", ownerSession.Data.Token, create, &detail))
	require.True(t, detail.Success, detail.Message)
	ticketID := detail.Data.Ticket.ID
	assert.Equal(t, owner.Id, detail.Data.Ticket.UserID)
	assert.Equal(t, "open", detail.Data.Ticket.Status)
	require.Len(t, detail.Data.Messages, 1)
	assert.Equal(t, "user", detail.Data.Messages[0].SenderType)
	reply := map[string]any{"sender_type": "admin", "body": "Support reply <b>ready</b>", "lang": "en", "attachments": []any{}}
	ticketURL := fmt.Sprintf("%s/api/tickets/%d", workerHTTP.URL, ticketID)
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodPost, ticketURL+"/messages?scope=admin", staffSession.Data.Token, reply, &detail))
	require.True(t, detail.Success, detail.Message)
	assert.Equal(t, "pending", detail.Data.Ticket.Status)
	require.Len(t, detail.Data.Messages, 2)
	assert.Equal(t, "admin", detail.Data.Messages[1].SenderType)
	assert.Equal(t, staff.Username, detail.Data.Messages[1].SenderName)
	assert.EqualValues(t, 2, verifyCalls.Load(), "each Worker request must validate the live gateway session")
	assert.False(t, model.DB.Migrator().HasTable(&supportworker.Ticket{}))
	assert.False(t, workerDB.Migrator().HasTable(&model.User{}))

	var queued supportworker.Notification
	require.NoError(t, workerDB.Where("ticket_id = ?", ticketID).First(&queued).Error)
	var callback map[string]any
	require.NoError(t, common.UnmarshalJsonStr(queued.Payload, &callback))
	require.NotEmpty(t, queued.EventID)
	assert.Equal(t, queued.EventID, callback["event_id"])
	delivered, err := worker.DeliverNotifications(t.Context())
	require.NoError(t, err)
	require.Equal(t, 1, delivered)
	require.EqualValues(t, 1, deliveries.Load())
	select {
	case sent := <-mail:
		assert.Contains(t, sent, "To: customer@example.invalid")
		assert.Contains(t, sent, "Support reply &lt;b&gt;ready&lt;/b&gt;")
	default:
		t.Fatal("SMTP accepted no support notification")
	}
	var receipt model.SupportNotification
	require.NoError(t, model.DB.Where("event_id = ?", queued.EventID).First(&receipt).Error)
	assert.Equal(t, owner.Id, receipt.UserID)
	assert.Positive(t, receipt.DeliveredAt)
	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	// Replaying the same actual Worker payload exercises the gateway receipt,
	// not merely the Worker's decision to skip an already acknowledged outbox row.
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodPost, gateway.URL+"/api/support/worker/notify", support_setting.CallbackSecret, callback, &result))
	require.True(t, result.Success, result.Message)
	assert.EqualValues(t, 1, deliveries.Load())
	delivered, err = worker.DeliverNotifications(t.Context())
	require.NoError(t, err)
	assert.Zero(t, delivered)
	assert.EqualValues(t, 1, deliveries.Load())

	require.NoError(t, model.DB.Model(&staff).Update("status", common.UserStatusDisabled).Error)
	require.NoError(t, model.PublishUserAuthCache(staff.Id))
	assert.Equal(t, http.StatusUnauthorized, supportHTTPTestRequest(t, client, http.MethodGet, ticketURL+"?scope=admin", staffSession.Data.Token, nil, &result))
	assert.False(t, result.Success)
	assert.Equal(t, http.StatusUnauthorized, supportHTTPTestRequest(t, client, http.MethodGet, gateway.URL+"/api/support/session", staffLogin.AccessToken, nil, &result))
	require.Equal(t, http.StatusOK, supportHTTPTestRequest(t, client, http.MethodPost, gateway.URL+"/api/user/auth/logout", ownerLogin.AccessToken, nil, &result))
	require.True(t, result.Success, result.Message)
	assert.Equal(t, http.StatusUnauthorized, supportHTTPTestRequest(t, client, http.MethodGet, ticketURL, ownerSession.Data.Token, nil, &result))
	assert.False(t, result.Success)
	assert.Equal(t, http.StatusUnauthorized, supportHTTPTestRequest(t, client, http.MethodGet, gateway.URL+"/api/support/session", ownerLogin.AccessToken, nil, &result))
	assert.EqualValues(t, 4, verifyCalls.Load())
}
