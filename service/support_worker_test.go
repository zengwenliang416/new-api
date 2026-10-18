package service

import (
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/support_setting"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func useTestSupportSettings(t *testing.T) {
	t.Helper()
	previousUrl := support_setting.WorkerUrl
	previousJwtSecret := support_setting.JwtSecret
	previousSiteID := support_setting.SiteID
	previousTTL := support_setting.SessionTTLMinutes
	t.Cleanup(func() {
		support_setting.WorkerUrl = previousUrl
		support_setting.JwtSecret = previousJwtSecret
		support_setting.SiteID = previousSiteID
		support_setting.SessionTTLMinutes = previousTTL
	})
}

func TestResolveSupportNotifyContract(t *testing.T) {
	cases := []struct {
		name          string
		setting       dto.UserSetting
		fallbackEmail string
		want          SupportNotifyInfo
	}{
		{
			name:          "empty type falls back to email",
			setting:       dto.UserSetting{},
			fallbackEmail: "user@example.com",
			want:          SupportNotifyInfo{Configured: true, Label: "email", Target: "user@example.com"},
		},
		{
			name:          "email uses notification email over account email",
			setting:       dto.UserSetting{NotificationEmail: "notify@example.com"},
			fallbackEmail: "user@example.com",
			want:          SupportNotifyInfo{Configured: true, Label: "email", Target: "notify@example.com"},
		},
		{
			name:    "email without any address is not configured",
			setting: dto.UserSetting{},
			want:    SupportNotifyInfo{Configured: false, Label: "email", Target: ""},
		},
		{
			name:    "webhook",
			setting: dto.UserSetting{NotifyType: "webhook", WebhookUrl: "https://example.com/hook"},
			want:    SupportNotifyInfo{Configured: true, Label: "webhook", Target: "https://example.com/hook"},
		},
		{
			name:    "webhook without url is not configured",
			setting: dto.UserSetting{NotifyType: "webhook"},
			want:    SupportNotifyInfo{Configured: false, Label: "webhook", Target: ""},
		},
		{
			name:    "bark",
			setting: dto.UserSetting{NotifyType: "bark", BarkUrl: "https://bark.example.com/push"},
			want:    SupportNotifyInfo{Configured: true, Label: "bark", Target: "https://bark.example.com/push"},
		},
		{
			name:    "gotify needs url and token",
			setting: dto.UserSetting{NotifyType: "gotify", GotifyUrl: "https://gotify.example.com", GotifyToken: "token"},
			want:    SupportNotifyInfo{Configured: true, Label: "gotify", Target: "https://gotify.example.com"},
		},
		{
			name:    "gotify without token is not configured",
			setting: dto.UserSetting{NotifyType: "gotify", GotifyUrl: "https://gotify.example.com"},
			want:    SupportNotifyInfo{Configured: false, Label: "gotify", Target: "https://gotify.example.com"},
		},
		{
			name:    "unsupported channel is labeled for the support UI",
			setting: dto.UserSetting{NotifyType: "telegram"},
			want:    SupportNotifyInfo{Configured: false, Label: "unsupported notification method", Target: ""},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, ResolveSupportNotify(tc.setting, tc.fallbackEmail))
		})
	}
}

func TestBuildSupportSessionContract(t *testing.T) {
	useTestSupportSettings(t)
	support_setting.WorkerUrl = ""
	support_setting.JwtSecret = ""
	support_setting.SiteID = "default"
	support_setting.SessionTTLMinutes = 30

	enabledUser := &model.User{Id: 7, Username: "alice", Email: "alice@example.com", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, AuthVersion: 1}
	disabledUser := &model.User{Id: 8, Username: "bob", Status: common.UserStatusDisabled, AuthVersion: 1}

	_, message := BuildSupportSession(disabledUser, AuthIdentity{UserID: 8, SessionID: "support-session", UserAuthVersion: 1, SessionVersion: 1})
	assert.Equal(t, SupportErrUserDisabled, message)

	_, message = BuildSupportSession(enabledUser, AuthIdentity{UserID: 7, SessionID: "support-session", UserAuthVersion: 1, SessionVersion: 1})
	assert.Equal(t, SupportErrWorkerNotConfigured, message)

	support_setting.WorkerUrl = "https://support.example.com"
	_, message = BuildSupportSession(enabledUser, AuthIdentity{UserID: 7, SessionID: "support-session", UserAuthVersion: 1, SessionVersion: 1})
	assert.Equal(t, SupportErrJwtSecretNotConfigured, message)

	support_setting.WorkerUrl = "https://support.example.com/"
	support_setting.JwtSecret = "test-support-jwt-secret-with-enough-entropy"
	session, message := BuildSupportSession(enabledUser, AuthIdentity{UserID: 7, SessionID: "support-session", UserAuthVersion: 1, SessionVersion: 1})
	require.Empty(t, message)
	require.NotNil(t, session)

	assert.Equal(t, "https://support.example.com", session.WorkerUrl)
	assert.Equal(t, SupportSessionUser{Id: 7, Email: "alice@example.com"}, session.User)
	assert.Equal(t, "email", session.Notify.Label)
	assert.Equal(t, "alice@example.com", session.Notify.Target)
	assert.True(t, session.Notify.Configured)

	parsed, err := jwt.Parse(session.Token, func(token *jwt.Token) (any, error) {
		return []byte(support_setting.JwtSecret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}), jwt.WithAudience(SupportSessionAudience), jwt.WithIssuer(SupportSessionIssuer))
	require.NoError(t, err)

	claims, ok := parsed.Claims.(jwt.MapClaims)
	require.True(t, ok)
	assert.Equal(t, strconv.Itoa(7), claims["sub"])
	assert.Equal(t, "default", claims["site"])
	assert.Equal(t, "support-session", claims["sid"])
	assert.Equal(t, float64(1), claims["uv"])
	assert.Equal(t, float64(1), claims["sv"])
	assert.Equal(t, "alice", claims["name"])
	assert.Equal(t, "alice@example.com", claims["email"])
	assert.Equal(t, float64(common.RoleCommonUser), claims["role"])

	issuedAt, err := claims.GetIssuedAt()
	require.NoError(t, err)
	expiresAt, err := claims.GetExpirationTime()
	require.NoError(t, err)
	notBefore, err := claims.GetNotBefore()
	require.NoError(t, err)
	assert.Equal(t, issuedAt.Unix(), notBefore.Unix())
	assert.Equal(t, int64(30*60), expiresAt.Unix()-issuedAt.Unix())
}
