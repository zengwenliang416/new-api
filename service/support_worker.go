package service

import (
	"crypto/subtle"
	"html"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/support_setting"

	"github.com/golang-jwt/jwt/v5"
)

const (
	SupportSessionIssuer     = "new-api-support"
	SupportSessionAudience   = "support-worker"
	SupportNotifyType        = "support_ticket"
	SupportNotifyUnsupported = "unsupported notification method"

	SupportErrWorkerNotConfigured         = "support worker is not configured"
	SupportErrJwtSecretNotConfigured      = "support worker jwt secret is not configured"
	SupportErrCallbackSecretNotConfigured = "support worker callback secret is not configured"
	SupportErrUserDisabled                = "user is disabled"
	SupportErrUserVerificationFailed      = "Support user verification failed"
	SupportErrAdminVerificationFailed     = "Support admin verification failed"
	SupportErrInvalidUserId               = "Invalid user id"
)

type SupportSessionUser struct {
	Id    int    `json:"id"`
	Email string `json:"email"`
}

type SupportNotifyInfo struct {
	Configured bool   `json:"configured"`
	Label      string `json:"label"`
	Target     string `json:"target"`
}

type SupportSession struct {
	WorkerUrl string             `json:"worker_url"`
	Token     string             `json:"token"`
	User      SupportSessionUser `json:"user"`
	Notify    SupportNotifyInfo  `json:"notify"`
}

// BuildSupportSession issues the browser-facing support worker credentials.
// The second return value is a raw message surfaced verbatim by the support UI.
func BuildSupportSession(user *model.User, identity AuthIdentity) (*SupportSession, string) {
	if identity.UserID != user.Id || identity.SessionID == "" || identity.UserAuthVersion < 1 || identity.SessionVersion < 1 || identity.UserAuthVersion != user.AuthVersion {
		return nil, SupportErrUserVerificationFailed
	}
	if user.Status != common.UserStatusEnabled {
		return nil, SupportErrUserDisabled
	}
	if !support_setting.IsWorkerConfigured() {
		return nil, SupportErrWorkerNotConfigured
	}
	if len(strings.TrimSpace(support_setting.JwtSecret)) < support_setting.MinSecretLength {
		return nil, SupportErrJwtSecretNotConfigured
	}
	now := time.Now()
	ttl := time.Duration(support_setting.SessionTTLMinutes) * time.Minute
	claims := jwt.MapClaims{
		"iss":   SupportSessionIssuer,
		"aud":   SupportSessionAudience,
		"sub":   strconv.Itoa(user.Id),
		"sid":   identity.SessionID,
		"uv":    identity.UserAuthVersion,
		"sv":    identity.SessionVersion,
		"iat":   now.Unix(),
		"nbf":   now.Unix(),
		"exp":   now.Add(ttl).Unix(),
		"site":  support_setting.SiteID,
		"name":  user.Username,
		"email": user.Email,
		"role":  user.Role,
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(support_setting.JwtSecret))
	if err != nil {
		return nil, "failed to issue support session"
	}
	return &SupportSession{
		WorkerUrl: strings.TrimRight(support_setting.WorkerUrl, "/"),
		Token:     token,
		User: SupportSessionUser{
			Id:    user.Id,
			Email: user.Email,
		},
		Notify: ResolveSupportNotify(user.GetSetting(), user.Email),
	}, ""
}

func ResolveSupportNotify(setting dto.UserSetting, fallbackEmail string) SupportNotifyInfo {
	notifyType := strings.ToLower(strings.TrimSpace(setting.NotifyType))
	if notifyType == "" {
		notifyType = dto.NotifyTypeEmail
	}
	switch notifyType {
	case dto.NotifyTypeEmail:
		target := strings.TrimSpace(setting.NotificationEmail)
		if target == "" {
			target = strings.TrimSpace(fallbackEmail)
		}
		return SupportNotifyInfo{Configured: target != "", Label: dto.NotifyTypeEmail, Target: target}
	case dto.NotifyTypeWebhook:
		return SupportNotifyInfo{Configured: setting.WebhookUrl != "", Label: dto.NotifyTypeWebhook, Target: setting.WebhookUrl}
	case dto.NotifyTypeBark:
		return SupportNotifyInfo{Configured: setting.BarkUrl != "", Label: dto.NotifyTypeBark, Target: setting.BarkUrl}
	case dto.NotifyTypeGotify:
		return SupportNotifyInfo{
			Configured: setting.GotifyUrl != "" && setting.GotifyToken != "",
			Label:      dto.NotifyTypeGotify,
			Target:     setting.GotifyUrl,
		}
	default:
		return SupportNotifyInfo{Configured: false, Label: SupportNotifyUnsupported, Target: ""}
	}
}

func SupportCallbackSecretMatches(provided string) bool {
	expected := support_setting.CallbackSecret
	if expected == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func SupportCallbackSecretConfigured() bool {
	return support_setting.CallbackSecret != ""
}

func SupportVerifyWorkerUser(userId int, requireStaff bool) (*model.User, string) {
	if userId <= 0 {
		return nil, SupportErrInvalidUserId
	}
	user, err := model.GetUserById(userId, false)
	if err != nil || user.Id == 0 {
		return nil, SupportErrUserVerificationFailed
	}
	if user.Status != common.UserStatusEnabled {
		return nil, SupportErrUserDisabled
	}
	if requireStaff && user.Role < common.RoleSupportUser {
		return nil, SupportErrAdminVerificationFailed
	}
	return user, ""
}

func NotifySupportTicket(userId int, title string, content string) error {
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return err
	}
	if user.Status != common.UserStatusEnabled {
		return nil
	}
	settings := user.GetSetting()
	if settings.NotifyType == "" || settings.NotifyType == dto.NotifyTypeEmail {
		content = strings.ReplaceAll(html.EscapeString(content), "\n", "<br>")
	}
	return NotifyUser(user.Id, user.Email, settings, dto.NewNotify(SupportNotifyType, title, content, nil))
}
