package controller

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

func GetSupportSession(c *gin.Context) {
	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil || user.Id == 0 {
		common.ApiErrorMsg(c, service.SupportErrUserVerificationFailed)
		return
	}
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": service.SupportErrUserVerificationFailed})
		return
	}
	session, message := service.BuildSupportSession(user, identity)
	if message != "" {
		common.ApiErrorMsg(c, message)
		return
	}
	common.ApiSuccess(c, session)
}

func getSupportCallbackSecret(c *gin.Context) string {
	if secret := strings.TrimSpace(c.GetHeader("X-Support-Callback-Secret")); secret != "" {
		return secret
	}
	authorization := strings.TrimSpace(c.GetHeader("Authorization"))
	if secret, ok := strings.CutPrefix(authorization, "Bearer "); ok {
		return strings.TrimSpace(secret)
	}
	return ""
}

func authorizeSupportWorkerCallback(c *gin.Context) bool {
	if !service.SupportCallbackSecretConfigured() {
		common.ApiErrorMsg(c, service.SupportErrCallbackSecretNotConfigured)
		return false
	}
	if !service.SupportCallbackSecretMatches(getSupportCallbackSecret(c)) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "Unauthorized",
		})
		return false
	}
	return true
}

// SupportWorkerVerify lets the support worker confirm that a ticket owner still
// exists, is enabled, and (for admin scope) still holds support staff rights.
func SupportWorkerVerify(c *gin.Context) {
	if !authorizeSupportWorkerCallback(c) {
		return
	}
	var request struct {
		UserId          int    `json:"user_id"`
		Scope           string `json:"scope"`
		SessionID       string `json:"sid"`
		UserAuthVersion int64  `json:"uv"`
		SessionVersion  int64  `json:"sv"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid JSON body")
		return
	}
	if request.Scope != "user" && request.Scope != "admin" {
		common.ApiErrorMsg(c, "Invalid scope")
		return
	}
	if request.UserId <= 0 {
		common.ApiErrorMsg(c, service.SupportErrInvalidUserId)
		return
	}
	c.Set("id", request.UserId)
	middleware.SupportWorkerUserRateLimit()(c)
	if c.IsAborted() {
		return
	}
	identity := service.AuthIdentity{UserID: request.UserId, SessionID: request.SessionID, UserAuthVersion: request.UserAuthVersion, SessionVersion: request.SessionVersion}
	if identity.SessionID == "" || identity.UserAuthVersion < 1 || identity.SessionVersion < 1 {
		common.ApiErrorMsg(c, service.SupportErrUserVerificationFailed)
		return
	}
	if _, _, err := service.ValidateLoginSession(identity); err != nil {
		common.ApiErrorMsg(c, service.SupportErrUserVerificationFailed)
		return
	}
	user, message := service.SupportVerifyWorkerUser(request.UserId, request.Scope == "admin")
	if message != "" {
		common.ApiErrorMsg(c, message)
		return
	}
	common.ApiSuccess(c, gin.H{
		"id":       user.Id,
		"username": user.Username,
		"email":    user.Email,
		"role":     user.Role,
	})
}

// SupportWorkerNotify delivers a support ticket notification to the ticket
// owner through their configured notification channel.
func SupportWorkerNotify(c *gin.Context) {
	if !authorizeSupportWorkerCallback(c) {
		return
	}
	var request struct {
		EventID  string `json:"event_id"`
		UserId   int    `json:"user_id"`
		TicketId string `json:"ticket_id"`
		Title    string `json:"title"`
		Content  string `json:"content"`
		Url      string `json:"url"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		common.ApiErrorMsg(c, "Invalid JSON body")
		return
	}
	if request.UserId <= 0 || strings.TrimSpace(request.EventID) == "" || len(request.EventID) > 255 || len([]rune(request.Title)) > 200 || len([]rune(request.Content)) > 12000 {
		common.ApiErrorMsg(c, service.SupportErrInvalidUserId)
		return
	}
	title := strings.TrimSpace(request.Title)
	if title == "" {
		title = "Support ticket reply"
	}
	content := strings.TrimSpace(request.Content)
	if url := strings.TrimSpace(request.Url); url != "" {
		content = strings.TrimSpace(content + "\n\n" + url)
	}
	encoded, err := common.Marshal(request)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid notification")
		return
	}
	digest := sha256.Sum256(encoded)
	err = model.DeliverSupportNotification(request.EventID, request.UserId, fmt.Sprintf("%x", digest), func() error {
		return service.NotifySupportTicket(request.UserId, title, content)
	})
	if err != nil {
		status, message := http.StatusServiceUnavailable, "Support notification delivery failed"
		switch {
		case errors.Is(err, model.ErrSupportNotificationConflict):
			status, message = http.StatusConflict, "Notification event conflict"
		case errors.Is(err, model.ErrInvalidSupportNotification):
			status, message = http.StatusBadRequest, "Invalid notification"
		case errors.Is(err, model.ErrSupportNotificationPending):
			var pending *model.SupportNotificationPendingError
			if errors.As(err, &pending) {
				c.Header("Retry-After", strconv.Itoa(max(1, int(pending.RetryAfter.Seconds()))))
			}
		}
		c.JSON(status, gin.H{"success": false, "message": message})
		return
	}
	common.ApiSuccess(c, nil)
}
