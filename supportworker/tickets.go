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
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var (
	ticketStatuses      = []string{"open", "pending", "closed"}
	ticketCategories    = []string{"quota", "platform_error", "frontend_error", "api_error", "refund", "account", "other"}
	ticketPriorities    = []string{"low", "normal", "high", "urgent"}
	ticketVerifications = []string{"not_verified", "suspected", "reproducible", "confirmed"}
)

type ticketRequest struct {
	ClientRequestID   string       `json:"client_request_id"`
	Title             string       `json:"title"`
	Category          string       `json:"category"`
	VerificationLevel string       `json:"verification_level"`
	Body              string       `json:"body"`
	Attachments       []Attachment `json:"attachments"`
	Language          string       `json:"lang"`
}

type pageCursor struct {
	Binding string `json:"b"`
	Rank    int    `json:"r"`
	Updated int64  `json:"u"`
	ID      int64  `json:"i"`
}

func (s *Server) ticketQuery(db *gorm.DB, actor identity) *gorm.DB {
	query := db.Model(&Ticket{}).Where("site_id = ?", s.siteID)
	if actor.Scope != "admin" {
		query = query.Where("user_id = ?", actor.ID)
	}
	return query
}

func (s *Server) ticket(db *gorm.DB, actor identity, id int64) (Ticket, error) {
	var ticket Ticket
	err := s.ticketQuery(db, actor).Where("id = ?", id).First(&ticket).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ticket, fail(http.StatusNotFound, "Ticket not found")
	}
	return ticket, err
}

// Reserving the row with a conditional UPDATE gives all modifying transactions
// the same ordering on SQLite, MySQL and PostgreSQL without unsupported locks.
func (s *Server) reserveTicket(db *gorm.DB, actor identity, id int64) (Ticket, error) {
	ticket, err := s.ticket(db, actor, id)
	if err != nil {
		return ticket, err
	}
	res := s.ticketQuery(db, actor).Where("id = ? AND version = ?", id, ticket.Version).
		UpdateColumn("version", gorm.Expr("version + 1"))
	if res.Error != nil {
		return ticket, res.Error
	}
	if res.RowsAffected != 1 {
		return ticket, fail(http.StatusConflict, "Ticket changed, please retry")
	}
	ticket.Version++
	return ticket, nil
}

func (s *Server) createTicket(w http.ResponseWriter, r *http.Request, actor identity) (any, error) {
	if actor.Scope != "user" {
		return nil, fail(http.StatusForbidden, "Tickets must be created in user scope")
	}
	if strings.TrimSpace(actor.Email) == "" {
		return nil, fail(http.StatusBadRequest, "Bind an email before creating a support ticket")
	}
	var req ticketRequest
	if err := readJSON(w, r, &req); err != nil {
		return nil, err
	}
	req.Title = strings.TrimSpace(req.Title)
	req.Body = strings.TrimSpace(req.Body)
	if req.Title == "" || req.Body == "" || utf8.RuneCountInString(req.Title) > 120 || utf8.RuneCountInString(req.Body) > MaxBodyRunes ||
		strings.ContainsRune(req.Title, '\x00') || strings.ContainsRune(req.Body, '\x00') {
		return nil, fail(http.StatusBadRequest, "Title and message are required")
	}
	if !slices.Contains(ticketCategories, req.Category) {
		return nil, fail(http.StatusBadRequest, "Invalid ticket category")
	}
	if !slices.Contains(ticketVerifications, req.VerificationLevel) {
		return nil, fail(http.StatusBadRequest, "Invalid verification level")
	}
	lang, err := messageLanguage(req.Language)
	if err != nil {
		return nil, err
	}
	receipt, err := s.prepareMutation(actor, "create_ticket", req.ClientRequestID, map[string]any{
		"title": req.Title, "category": req.Category, "verification_level": req.VerificationLevel,
		"body": req.Body, "lang": lang, "attachments": attachmentKeys(req.Attachments),
	})
	if err != nil {
		return nil, err
	}
	if data, found, err := s.replayMutation(r, actor, receipt); found || err != nil {
		return data, err
	}
	if err = s.rateLimit(r.Context(), actor.ID, "create", 5, time.Hour); err != nil {
		return nil, err
	}
	now := s.cfg.Now().UnixMilli()
	ticket := Ticket{SiteID: s.siteID, UserID: actor.ID, Username: actor.Username,
		Title: req.Title, Status: "open", Category: req.Category, Priority: "normal", VerificationLevel: req.VerificationLevel,
		UnreadAdmin: true, LastMessagePreview: preview(req.Body), LastMessageSenderType: "user", CreatedAt: now, UpdatedAt: now, Version: 1}
	message := Message{SiteID: s.siteID, SenderID: actor.ID, SenderType: "user", SenderName: actor.Username,
		SenderLang: lang, Body: req.Body, CreatedAt: now}
	var replayID int64
	err = s.db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
		var err error
		replayID, err = s.claimMutation(tx, receipt)
		if err != nil || replayID != 0 {
			return err
		}
		if err := tx.Create(&ticket).Error; err != nil {
			return err
		}
		message.TicketID = ticket.ID
		if err := tx.Create(&message).Error; err != nil {
			return err
		}
		attachments, err := s.bindAttachments(tx, actor, ticket.ID, message.ID, req.Attachments)
		message.Attachments = attachments
		if err != nil {
			return err
		}
		return s.completeMutation(tx, receipt, ticket.ID, message.ID)
	})
	if err != nil {
		return nil, err
	}
	if replayID != 0 {
		return s.getTicket(r, actor, replayID)
	}
	return TicketDetail{Ticket: ticket, Messages: []Message{message}}, nil
}

func (s *Server) getTicket(r *http.Request, actor identity, id int64) (any, error) {
	lang, err := messageLanguage(r.URL.Query().Get("lang"))
	if err != nil {
		return nil, err
	}
	var detail TicketDetail
	err = s.db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
		ticket, err := s.reserveTicket(tx, actor, id)
		if err != nil {
			return err
		}
		column := "unread_user"
		if actor.Scope == "admin" {
			column = "unread_admin"
			ticket.UnreadAdmin = false
		} else {
			ticket.UnreadUser = false
		}
		if err = tx.Model(&Ticket{}).Where("id = ? AND site_id = ?", id, s.siteID).UpdateColumn(column, false).Error; err != nil {
			return err
		}
		page, err := s.messagePage(tx, actor, id, 50, "", lang)
		detail = TicketDetail{Ticket: ticket, Messages: page.Items, NextCursor: page.NextCursor, Translations: page.Translations}
		return err
	})
	return detail, err
}

func (s *Server) createMessage(w http.ResponseWriter, r *http.Request, actor identity, id int64) (any, error) {
	var req struct {
		ClientRequestID string       `json:"client_request_id"`
		SenderType      string       `json:"sender_type"`
		Body            string       `json:"body"`
		Attachments     []Attachment `json:"attachments"`
		Language        string       `json:"lang"`
	}
	if err := readJSON(w, r, &req); err != nil {
		return nil, err
	}
	if req.SenderType != actor.Scope {
		return nil, fail(http.StatusForbidden, "Invalid sender type")
	}
	req.Body = strings.TrimSpace(req.Body)
	if req.Body == "" && len(req.Attachments) == 0 || utf8.RuneCountInString(req.Body) > MaxBodyRunes || strings.ContainsRune(req.Body, '\x00') {
		return nil, fail(http.StatusBadRequest, "Message or image is required")
	}
	lang, err := messageLanguage(req.Language)
	if err != nil {
		return nil, err
	}
	receipt, err := s.prepareMutation(actor, "create_message", req.ClientRequestID, map[string]any{
		"ticket_id": id, "scope": actor.Scope, "body": req.Body, "lang": lang, "attachments": attachmentKeys(req.Attachments),
	})
	if err != nil {
		return nil, err
	}
	if data, found, err := s.replayMutation(r, actor, receipt); found || err != nil {
		return data, err
	}
	if err = s.rateLimit(r.Context(), actor.ID, "message", 30, time.Minute); err != nil {
		return nil, err
	}
	var detail TicketDetail
	var replayID int64
	err = s.db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
		var err error
		replayID, err = s.claimMutation(tx, receipt)
		if err != nil || replayID != 0 {
			return err
		}
		ticket, err := s.reserveTicket(tx, actor, id)
		if err != nil {
			return err
		}
		now := s.cfg.Now().UnixMilli()
		message := Message{SiteID: s.siteID, TicketID: id, SenderID: actor.ID, SenderType: actor.Scope,
			SenderName: actor.Username, SenderLang: lang, Body: req.Body, CreatedAt: now}
		if err = tx.Create(&message).Error; err != nil {
			return err
		}
		if _, err = s.bindAttachments(tx, actor, id, message.ID, req.Attachments); err != nil {
			return err
		}
		ticket.Status = "open"
		ticket.UnreadAdmin, ticket.UnreadUser = true, false
		if actor.Scope == "admin" {
			ticket.Status = "pending"
			ticket.UnreadAdmin, ticket.UnreadUser = false, true
			if err = s.enqueueNotification(tx, ticket, message.Body); err != nil {
				return err
			}
		}
		ticket.LastMessagePreview, ticket.LastMessageSenderType = preview(req.Body), actor.Scope
		ticket.UpdatedAt = now
		if err = tx.Model(&Ticket{}).Where("site_id = ? AND id = ?", s.siteID, id).Updates(map[string]any{
			"status": ticket.Status, "unread_admin": ticket.UnreadAdmin, "unread_user": ticket.UnreadUser,
			"last_message_preview": ticket.LastMessagePreview, "last_message_sender_type": actor.Scope, "updated_at": now,
		}).Error; err != nil {
			return err
		}
		page, err := s.messagePage(tx, actor, id, 50, "", lang)
		detail = TicketDetail{Ticket: ticket, Messages: page.Items, NextCursor: page.NextCursor, Translations: page.Translations}
		if err != nil {
			return err
		}
		return s.completeMutation(tx, receipt, id, message.ID)
	})
	if err == nil && replayID != 0 {
		return s.getTicket(r, actor, replayID)
	}
	return detail, err
}

func (s *Server) updateTicket(w http.ResponseWriter, r *http.Request, actor identity, id int64) (any, error) {
	var req struct {
		Status   *string `json:"status"`
		Priority *string `json:"priority"`
	}
	if err := readJSON(w, r, &req); err != nil {
		return nil, err
	}
	if req.Status == nil && req.Priority == nil {
		return nil, fail(http.StatusBadRequest, "No changes supplied")
	}
	if req.Status != nil && !slices.Contains(ticketStatuses, *req.Status) {
		return nil, fail(http.StatusBadRequest, "Invalid ticket status")
	}
	if req.Priority != nil && !slices.Contains(ticketPriorities, *req.Priority) {
		return nil, fail(http.StatusBadRequest, "Invalid ticket priority")
	}
	if actor.Scope != "admin" {
		if req.Priority != nil {
			return nil, fail(http.StatusForbidden, "Only admins can change priority")
		}
		if req.Status != nil && *req.Status == "pending" {
			return nil, fail(http.StatusForbidden, "Only admins can change ticket workflow status")
		}
	}
	if err := s.rateLimit(r.Context(), actor.ID, "update", 30, time.Minute); err != nil {
		return nil, err
	}
	var detail TicketDetail
	err := s.db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
		ticket, err := s.reserveTicket(tx, actor, id)
		if err != nil {
			return err
		}
		updates := map[string]any{"updated_at": s.cfg.Now().UnixMilli()}
		if req.Status != nil {
			ticket.Status = *req.Status
			updates["status"] = *req.Status
			if actor.Scope == "admin" {
				ticket.UnreadUser = true
				updates["unread_user"] = true
				if err = s.enqueueNotification(tx, ticket, "Ticket status: "+ticket.Status); err != nil {
					return err
				}
			}
		}
		if req.Priority != nil {
			ticket.Priority = *req.Priority
			updates["priority"] = *req.Priority
		}
		ticket.UpdatedAt = updates["updated_at"].(int64)
		if err = tx.Model(&Ticket{}).Where("id = ? AND site_id = ?", id, s.siteID).Updates(updates).Error; err != nil {
			return err
		}
		page, err := s.messagePage(tx, actor, id, 50, "", "")
		detail = TicketDetail{Ticket: ticket, Messages: page.Items, NextCursor: page.NextCursor}
		return err
	})
	return detail, err
}

func (s *Server) deleteTicket(r *http.Request, actor identity, id int64) error {
	return s.db.WithContext(r.Context()).Transaction(func(tx *gorm.DB) error {
		ticket, err := s.reserveTicket(tx, actor, id)
		if err != nil {
			return err
		}
		if ticket.Status != "closed" {
			return fail(http.StatusConflict, "Only resolved tickets can be deleted")
		}
		messages := tx.Model(&Message{}).Select("id").Where("site_id = ? AND ticket_id = ?", s.siteID, id)
		if err = tx.Where("site_id = ? AND message_id IN (?)", s.siteID, messages).Delete(&Translation{}).Error; err != nil {
			return err
		}
		if err = tx.Model(&Attachment{}).Where("site_id = ? AND ticket_id = ?", s.siteID, id).
			UpdateColumn("deleted_at", s.cfg.Now().UnixMilli()).Error; err != nil {
			return err
		}
		if err = tx.Where("site_id = ? AND ticket_id = ?", s.siteID, id).Delete(&Message{}).Error; err != nil {
			return err
		}
		if err = tx.Where("site_id = ? AND ticket_id = ?", s.siteID, id).Delete(&Notification{}).Error; err != nil {
			return err
		}
		return tx.Where("site_id = ? AND id = ?", s.siteID, id).Delete(&Ticket{}).Error
	})
}

func (s *Server) listMessages(r *http.Request, actor identity, id int64) (any, error) {
	lang, err := messageLanguage(r.URL.Query().Get("lang"))
	if err != nil {
		return nil, err
	}
	db := s.db.WithContext(r.Context())
	if _, err = s.ticket(db, actor, id); err != nil {
		return nil, err
	}
	limit, err := pageLimit(r, 50)
	if err != nil {
		return nil, err
	}
	return s.messagePage(db, actor, id, limit, r.URL.Query().Get("cursor"), lang)
}

func (s *Server) messagePage(db *gorm.DB, actor identity, id int64, limit int, cursor, lang string) (MessagePage, error) {
	page := MessagePage{Items: []Message{}}
	binding := fmt.Sprintf("messages:%s:%d:%s:%d", s.siteID, actor.ID, actor.Scope, id)
	query := db.Where("site_id = ? AND ticket_id = ?", s.siteID, id)
	if cursor != "" {
		position, err := s.decodeCursor(cursor, binding)
		if err != nil {
			return page, err
		}
		query = query.Where("id < ?", position.ID)
	}
	if err := query.Order("id DESC").Limit(limit + 1).Find(&page.Items).Error; err != nil {
		return page, err
	}
	if len(page.Items) > limit {
		page.Items = page.Items[:limit]
		encoded, err := s.encodeCursor(pageCursor{Binding: binding, ID: page.Items[len(page.Items)-1].ID})
		if err != nil {
			return page, err
		}
		page.NextCursor = &encoded
	}
	slices.Reverse(page.Items)
	ids := make([]int64, len(page.Items))
	byID := make(map[int64]int, len(page.Items))
	for i := range page.Items {
		ids[i] = page.Items[i].ID
		byID[ids[i]] = i
		page.Items[i].Attachments = []Attachment{}
	}
	if len(ids) == 0 {
		return page, nil
	}
	var attachments []Attachment
	if err := db.Where("site_id = ? AND ticket_id = ? AND message_id IN ? AND deleted_at = 0", s.siteID, id, ids).
		Order("id ASC").Find(&attachments).Error; err != nil {
		return page, err
	}
	for _, attachment := range attachments {
		idx := byID[attachment.MessageID]
		page.Items[idx].Attachments = append(page.Items[idx].Attachments, attachment)
	}
	if lang != "" {
		var translations []Translation
		if err := db.Where("site_id = ? AND message_id IN ? AND language = ?", s.siteID, ids, lang).Find(&translations).Error; err != nil {
			return page, err
		}
		page.Translations = make(map[int64]Translation, len(translations))
		for _, translation := range translations {
			page.Translations[translation.MessageID] = translation
		}
	}
	return page, nil
}

func (s *Server) listTickets(r *http.Request, actor identity) (any, error) {
	query := s.ticketQuery(s.db.WithContext(r.Context()), actor)
	params := r.URL.Query()
	for _, filter := range []struct {
		param, column, message string
		allowed                []string
	}{
		{"status", "status", "Invalid ticket status", ticketStatuses},
		{"category", "category", "Invalid ticket category", ticketCategories},
		{"priority", "priority", "Invalid ticket priority", ticketPriorities},
		{"verification", "verification_level", "Invalid verification level", ticketVerifications},
	} {
		value := params.Get(filter.param)
		if value == "" || value == "all" {
			continue
		}
		if !slices.Contains(filter.allowed, value) {
			return nil, fail(http.StatusBadRequest, filter.message)
		}
		query = query.Where(filter.column+" = ?", value)
	}
	if rawID := params.Get("user_id"); rawID != "" {
		if actor.Scope != "admin" {
			return nil, fail(http.StatusForbidden, "Only admins can filter by user")
		}
		id, err := strconv.Atoi(rawID)
		if err != nil || id <= 0 {
			return nil, fail(http.StatusBadRequest, "Invalid user id")
		}
		query = query.Where("user_id = ?", id)
	}
	unread := "unread_user"
	action := "pending"
	if actor.Scope == "admin" {
		unread, action = "unread_admin", "open"
	}
	if params.Get("unread") == "1" {
		query = query.Where(unread+" = ?", true)
	}
	q := strings.TrimSpace(params.Get("q"))
	if utf8.RuneCountInString(q) > 120 {
		return nil, fail(http.StatusBadRequest, "Search query is too long")
	}
	if q != "" {
		pattern := "%" + strings.ToLower(q) + "%"
		query = query.Where("LOWER(title) LIKE ? OR LOWER(username) LIKE ? OR LOWER(last_message_preview) LIKE ?", pattern, pattern, pattern)
	}
	rank := "0"
	switch params.Get("sort") {
	case "", "needs_action":
		rank = "CASE WHEN status = '" + action + "' THEN 2 WHEN status = 'closed' THEN 0 ELSE 1 END"
	case "unread":
		rank = "CASE WHEN " + unread + " THEN 1 ELSE 0 END"
	case "priority":
		rank = "CASE priority WHEN 'urgent' THEN 3 WHEN 'high' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END"
	case "updated":
	default:
		return nil, fail(http.StatusBadRequest, "Invalid ticket sort")
	}
	limit, err := pageLimit(r, 30)
	if err != nil {
		return nil, err
	}
	params.Del("cursor")
	params.Del("limit")
	hash := sha256.Sum256([]byte(params.Encode()))
	binding := fmt.Sprintf("tickets:%s:%d:%s:%x", s.siteID, actor.ID, actor.Scope, hash[:])
	if cursor := r.URL.Query().Get("cursor"); cursor != "" {
		position, err := s.decodeCursor(cursor, binding)
		if err != nil {
			return nil, err
		}
		query = query.Where("("+rank+") < ? OR (("+rank+") = ? AND (updated_at < ? OR (updated_at = ? AND id < ?)))",
			position.Rank, position.Rank, position.Updated, position.Updated, position.ID)
	}
	var rows []struct {
		Ticket
		OrderRank int
	}
	if err := query.Select("support_tickets.*, (" + rank + ") AS order_rank").Order("order_rank DESC, updated_at DESC, id DESC").Limit(limit + 1).Scan(&rows).Error; err != nil {
		return nil, err
	}
	page := TicketPage{Items: []Ticket{}}
	if len(rows) > limit {
		rows = rows[:limit]
		last := rows[len(rows)-1]
		encoded, err := s.encodeCursor(pageCursor{Binding: binding, Rank: last.OrderRank, Updated: last.UpdatedAt, ID: last.ID})
		if err != nil {
			return nil, err
		}
		page.NextCursor = &encoded
	}
	for _, row := range rows {
		page.Items = append(page.Items, row.Ticket)
	}
	return page, nil
}

func (s *Server) summary(r *http.Request, actor identity) (any, error) {
	query := s.ticketQuery(s.db.WithContext(r.Context()), actor)
	var groups []struct {
		Status string
		Count  int64
	}
	if err := query.Select("status, COUNT(*) AS count").Group("status").Scan(&groups).Error; err != nil {
		return nil, err
	}
	counts := map[string]int64{"open": 0, "pending": 0, "closed": 0}
	for _, group := range groups {
		counts[group.Status] = group.Count
	}
	unread, attention := "unread_user", "pending"
	if actor.Scope == "admin" {
		unread, attention = "unread_admin", "open"
	}
	var unreadCount int64
	if err := s.ticketQuery(s.db.WithContext(r.Context()), actor).Where(unread+" = ?", true).Count(&unreadCount).Error; err != nil {
		return nil, err
	}
	latestUnread, latestAttention := []Ticket{}, []Ticket{}
	if err := s.ticketQuery(s.db.WithContext(r.Context()), actor).Where(unread+" = ?", true).
		Order("updated_at DESC, id DESC").Limit(3).Find(&latestUnread).Error; err != nil {
		return nil, err
	}
	if err := s.ticketQuery(s.db.WithContext(r.Context()), actor).Where("status = ?", attention).
		Order("updated_at DESC, id DESC").Limit(3).Find(&latestAttention).Error; err != nil {
		return nil, err
	}
	return map[string]any{"unread_count": unreadCount, "pending_count": counts["pending"], "attention_count": counts[attention],
		"status_counts": counts, "latest_unread": latestUnread, "latest_attention": latestAttention}, nil
}

func pageLimit(r *http.Request, fallback int) (int, error) {
	if raw := r.URL.Query().Get("limit"); raw != "" {
		limit, err := strconv.Atoi(raw)
		if err != nil || limit < 1 || limit > 100 {
			return 0, fail(http.StatusBadRequest, "Invalid page limit")
		}
		return limit, nil
	}
	return fallback, nil
}

func preview(body string) string {
	runes := []rune(body)
	return string(runes[:min(len(runes), 200)])
}

func (s *Server) encodeCursor(position pageCursor) (string, error) {
	data, err := common.Marshal(position)
	if err != nil {
		return "", err
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	_, _ = mac.Write(append([]byte("support-cursor:"), data...))
	return base64.RawURLEncoding.EncodeToString(data) + "." + base64.RawURLEncoding.EncodeToString(mac.Sum(nil)), nil
}

func (s *Server) decodeCursor(encoded, binding string) (pageCursor, error) {
	var position pageCursor
	invalid := fail(http.StatusBadRequest, "Invalid cursor")
	if len(encoded) > 2048 {
		return position, invalid
	}
	dataPart, signaturePart, found := strings.Cut(encoded, ".")
	if !found {
		return position, invalid
	}
	data, err := base64.RawURLEncoding.DecodeString(dataPart)
	if err != nil {
		return position, invalid
	}
	signature, err := base64.RawURLEncoding.DecodeString(signaturePart)
	if err != nil {
		return position, invalid
	}
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	_, _ = mac.Write(append([]byte("support-cursor:"), data...))
	if !hmac.Equal(signature, mac.Sum(nil)) || common.Unmarshal(data, &position) != nil || position.Binding != binding || position.ID <= 0 {
		return position, invalid
	}
	return position, nil
}
