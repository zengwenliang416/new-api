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

package supportworker

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SessionIssuer   = "new-api-support"
	SessionAudience = "support-worker"
	MaxImageBytes   = 8 * 1024 * 1024
	MaxBodyRunes    = 8000
)

type Claims struct {
	jwt.RegisteredClaims
	Site           string `json:"site"`
	SessionID      string `json:"sid"`
	UserVersion    *int64 `json:"uv"`
	SessionVersion *int64 `json:"sv"`
}

type Server struct {
	cfg        Config
	db         *gorm.DB
	siteID     string
	imageSlots chan struct{}
}

type identity struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     int    `json:"role"`
	Scope    string `json:"-"`
}

type apiError struct {
	status  int
	message string
}

func (e *apiError) Error() string { return e.message }

func fail(status int, message string) error { return &apiError{status, message} }

func NewServer(cfg Config, db *gorm.DB) (*Server, error) {
	if db == nil {
		return nil, errors.New("support database is required")
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	if err := Migrate(db); err != nil {
		return nil, errors.New("cannot migrate support database")
	}
	partition := sha256.Sum256([]byte(cfg.SiteID))
	return &Server{cfg: cfg, db: db, siteID: hex.EncodeToString(partition[:]), imageSlots: make(chan struct{}, 2)}, nil
}

func (s *Server) Handler() http.Handler { return http.HandlerFunc(s.ServeHTTP) }

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox")
	w.Header().Set("Referrer-Policy", "no-referrer")
	if origin := r.Header.Get("Origin"); origin != "" {
		w.Header().Add("Vary", "Origin")
		if !slices.Contains(s.cfg.AllowedOrigins, origin) {
			writeFailure(w, fail(http.StatusForbidden, "Origin is not allowed"))
			return
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	if r.Method == http.MethodOptions {
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Max-Age", "600")
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/healthz" && r.Method == http.MethodGet {
		writeSuccess(w, map[string]string{"status": "ok"})
		return
	}
	actor, err := s.authenticate(r)
	if err != nil {
		writeFailure(w, err)
		return
	}
	data, err := s.route(w, r, actor)
	if err != nil {
		writeFailure(w, err)
		return
	}
	if data != blobResponse {
		writeSuccess(w, data)
	}
}

// blobResponse is only an internal sentinel; byte streams are already written.
var blobResponse = &struct{}{}

func (s *Server) route(w http.ResponseWriter, r *http.Request, actor identity) (any, error) {
	path := strings.TrimPrefix(r.URL.Path, "/api/")
	if path == r.URL.Path || strings.Contains(path, "//") {
		return nil, fail(http.StatusNotFound, "Not found")
	}
	parts := strings.Split(path, "/")
	if path == "uploads/images" && r.Method == http.MethodPost {
		return s.uploadImage(w, r, actor)
	}
	if parts[0] != "tickets" {
		return nil, fail(http.StatusNotFound, "Not found")
	}
	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			return s.listTickets(r, actor)
		case http.MethodPost:
			return s.createTicket(w, r, actor)
		}
	}
	if len(parts) == 2 && parts[1] == "summary" && r.Method == http.MethodGet {
		return s.summary(r, actor)
	}
	if len(parts) < 2 {
		return nil, fail(http.StatusMethodNotAllowed, "Method not allowed")
	}
	id, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil || id <= 0 {
		return nil, fail(http.StatusNotFound, "Ticket not found")
	}
	if len(parts) == 2 {
		switch r.Method {
		case http.MethodGet:
			return s.getTicket(r, actor, id)
		case http.MethodPatch:
			return s.updateTicket(w, r, actor, id)
		case http.MethodDelete:
			return nil, s.deleteTicket(r, actor, id)
		}
	}
	if len(parts) == 3 && parts[2] == "messages" {
		switch r.Method {
		case http.MethodGet:
			return s.listMessages(r, actor, id)
		case http.MethodPost:
			return s.createMessage(w, r, actor, id)
		}
	}
	if len(parts) == 5 {
		childID, err := strconv.ParseInt(parts[3], 10, 64)
		if err != nil || childID <= 0 {
			return nil, fail(http.StatusNotFound, "Not found")
		}
		if parts[2] == "attachments" && parts[4] == "blob" && r.Method == http.MethodGet {
			return blobResponse, s.attachmentBlob(w, r, actor, id, childID)
		}
		if parts[2] == "messages" {
			if parts[4] == "translate" && r.Method == http.MethodPost {
				return s.translateMessage(w, r, actor, id, childID, false)
			}
			if parts[4] == "translation" && r.Method == http.MethodPut {
				return s.translateMessage(w, r, actor, id, childID, true)
			}
		}
	}
	return nil, fail(http.StatusMethodNotAllowed, "Method not allowed")
}

func (s *Server) authenticate(r *http.Request) (identity, error) {
	var actor identity
	scope := r.URL.Query().Get("scope")
	if scope == "" {
		scope = "user"
	}
	if scope != "user" && scope != "admin" {
		return actor, fail(http.StatusBadRequest, "Invalid support scope")
	}
	actor.Scope = scope
	encoded, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || encoded == "" {
		return actor, fail(http.StatusUnauthorized, "Missing support token")
	}
	if len(encoded) > 8192 {
		return actor, fail(http.StatusUnauthorized, "Invalid support token")
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(encoded, claims, func(token *jwt.Token) (any, error) {
		return []byte(s.cfg.JWTSecret), nil
	}, jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer(SessionIssuer),
		jwt.WithAudience(SessionAudience), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithTimeFunc(s.cfg.Now))
	if err != nil || !token.Valid {
		return actor, fail(http.StatusUnauthorized, "Invalid support token")
	}
	userID, err := strconv.Atoi(claims.Subject)
	if err != nil || userID <= 0 || strconv.Itoa(userID) != claims.Subject ||
		claims.Site != s.cfg.SiteID || strings.TrimSpace(claims.SessionID) == "" || len(claims.SessionID) > 256 ||
		claims.UserVersion == nil || *claims.UserVersion < 1 || claims.SessionVersion == nil || *claims.SessionVersion < 1 ||
		claims.IssuedAt == nil || claims.NotBefore == nil || claims.ExpiresAt == nil ||
		claims.ExpiresAt.Sub(claims.IssuedAt.Time) > 4*time.Hour ||
		!claims.ExpiresAt.After(claims.IssuedAt.Time) || claims.NotBefore.Before(claims.IssuedAt.Time) {
		return actor, fail(http.StatusUnauthorized, "Incomplete support token")
	}
	if err = s.rateLimit(r.Context(), userID, "request", 120, time.Minute); err != nil {
		return actor, err
	}
	request := struct {
		UserID         int    `json:"user_id"`
		Scope          string `json:"scope"`
		SessionID      string `json:"sid"`
		UserVersion    int64  `json:"uv"`
		SessionVersion int64  `json:"sv"`
	}{userID, scope, claims.SessionID, *claims.UserVersion, *claims.SessionVersion}
	var response struct {
		Success bool     `json:"success"`
		Data    identity `json:"data"`
	}
	status, err := s.gateway(r.Context(), "/api/support/worker/verify", request, &response)
	if status == http.StatusTooManyRequests {
		return actor, fail(http.StatusTooManyRequests, "Too many support requests, please try later")
	}
	if err != nil || status >= 500 {
		return actor, fail(http.StatusServiceUnavailable, "Support user verification is unavailable")
	}
	if status < 200 || status >= 300 || !response.Success || response.Data.ID != userID {
		return actor, fail(http.StatusUnauthorized, "Support user verification failed")
	}
	actor = response.Data
	actor.Scope = scope
	if scope == "admin" && actor.Role < 5 {
		return actor, fail(http.StatusForbidden, "Admin permission required")
	}
	return actor, nil
}

func (s *Server) gateway(ctx context.Context, path string, payload, response any) (int, error) {
	body, err := common.Marshal(payload)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.GatewayURL+path, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Support-Callback-Secret", s.cfg.CallbackSecret)
	res, err := s.cfg.HTTPClient.Do(req)
	if err != nil {
		return 0, errors.New("support gateway is unavailable")
	}
	defer res.Body.Close()
	data, err := io.ReadAll(io.LimitReader(res.Body, 64*1024+1))
	if err != nil || len(data) > 64*1024 {
		return res.StatusCode, errors.New("invalid support gateway response")
	}
	return res.StatusCode, common.Unmarshal(data, response)
}

// Fixed windows are enforced with an atomic conditional UPDATE in the database,
// so separate Worker processes cannot bypass a shared account limit.
func (s *Server) rateLimit(ctx context.Context, userID int, action string, limit int, period time.Duration) error {
	now := s.cfg.Now()
	window := now.Unix() / int64(period.Seconds())
	hash := sha256.Sum256(fmt.Appendf(nil, "%s\x00%d\x00%s\x00%d", s.cfg.SiteID, userID, action, window))
	row := rateWindow{ID: hex.EncodeToString(hash[:]), ExpiresAt: (window+1)*int64(period.Seconds()) + 86400}
	db := s.db.WithContext(ctx)
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
		return err
	}
	result := db.Model(&rateWindow{}).Where("id = ? AND count < ?", row.ID, limit).UpdateColumn("count", gorm.Expr("count + 1"))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return fail(http.StatusTooManyRequests, "Too many support requests, please try later")
	}
	return nil
}

func readJSON(w http.ResponseWriter, r *http.Request, value any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 64*1024)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return fail(http.StatusRequestEntityTooLarge, "JSON request body is too large")
	}
	if err = common.Unmarshal(body, value); err != nil {
		return fail(http.StatusBadRequest, "Invalid JSON body")
	}
	return nil
}

func writeSuccess(w http.ResponseWriter, data any) {
	writeJSON(w, http.StatusOK, map[string]any{"success": true, "data": data})
}

func writeFailure(w http.ResponseWriter, err error) {
	status, message := http.StatusInternalServerError, "Support worker request failed"
	var api *apiError
	if errors.As(err, &api) {
		status, message = api.status, api.message
	}
	if status == http.StatusTooManyRequests {
		w.Header().Set("Retry-After", "60")
	}
	writeJSON(w, status, map[string]any{"success": false, "message": message})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	encoded, err := common.Marshal(value)
	if err != nil {
		http.Error(w, "Support worker request failed", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write(encoded)
}

func randomKey() (string, error) {
	var data [32]byte
	if _, err := rand.Read(data[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(data[:]), nil
}
