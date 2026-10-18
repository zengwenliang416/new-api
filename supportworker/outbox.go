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
	"context"
	"errors"
	"log"
	"net/url"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type notificationPayload struct {
	EventID  string `json:"event_id"`
	UserID   int    `json:"user_id"`
	TicketID string `json:"ticket_id"`
	Title    string `json:"title"`
	Content  string `json:"content"`
	URL      string `json:"url"`
}

func (s *Server) enqueueNotification(tx *gorm.DB, ticket Ticket, body string) error {
	eventID, err := randomKey()
	if err != nil {
		return err
	}
	payload := notificationPayload{EventID: eventID, UserID: ticket.UserID, TicketID: strconv.FormatInt(ticket.ID, 10),
		Title: "Support ticket reply: " + ticket.Title, Content: body,
		URL: s.cfg.GatewayURL + "/support?ticket=" + url.QueryEscape(strconv.FormatInt(ticket.ID, 10))}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	row := Notification{SiteID: s.siteID, EventID: eventID, TicketID: ticket.ID, Payload: string(encoded), RetryAt: s.cfg.Now().UnixMilli()}
	return tx.Create(&row).Error
}

// DeliverNotifications makes one bounded delivery pass. The lease is stored in
// the database and every retry preserves EventID, including a lost HTTP reply.
// The gateway callback must deduplicate EventID before sending a notification.
func (s *Server) DeliverNotifications(ctx context.Context) (int, error) {
	now := s.cfg.Now()
	db := s.db.WithContext(ctx)
	var rows []Notification
	if err := db.Where("site_id = ? AND delivered_at = 0 AND retry_at <= ? AND lease_until <= ?", s.siteID, now.UnixMilli(), now.UnixMilli()).
		Order("id ASC").Limit(20).Find(&rows).Error; err != nil {
		return 0, err
	}
	count := 0
	var deliveryErr error
	for _, row := range rows {
		now = s.cfg.Now()
		owner, err := randomKey()
		if err != nil {
			return count, err
		}
		claimed := db.Model(&Notification{}).Where("site_id = ? AND id = ? AND delivered_at = 0 AND lease_until <= ? AND retry_at <= ?",
			s.siteID, row.ID, now.UnixMilli(), now.UnixMilli()).Updates(map[string]any{
			"lease_until": now.Add(time.Minute).UnixMilli(), "lease_owner": owner, "attempts": gorm.Expr("attempts + 1"),
		})
		if claimed.Error != nil {
			return count, claimed.Error
		}
		if claimed.RowsAffected != 1 {
			continue
		}
		var payload notificationPayload
		var response struct {
			Success bool `json:"success"`
		}
		err = common.UnmarshalJsonStr(row.Payload, &payload)
		status := 0
		if err == nil {
			status, err = s.gateway(ctx, "/api/support/worker/notify", payload, &response)
		}
		updates := map[string]any{"lease_until": int64(0), "lease_owner": ""}
		if err == nil && status >= 200 && status < 300 && response.Success {
			updates["delivered_at"] = s.cfg.Now().UnixMilli()
			updates["payload"] = ""
			count++
		} else {
			deliveryErr = errors.New("support notification delivery failed; retry scheduled")
			backoff := min(time.Duration(1<<min(row.Attempts+1, 10))*5*time.Second, time.Hour)
			updates["retry_at"] = s.cfg.Now().Add(backoff).UnixMilli()
		}
		if err := db.Model(&Notification{}).Where("site_id = ? AND id = ? AND lease_owner = ?", s.siteID, row.ID, owner).Updates(updates).Error; err != nil {
			return count, err
		}
	}
	return count, deliveryErr
}

// RunMaintenance keeps durable notifications moving and removes abandoned
// uploads. Callers own the context and lifecycle; NewServer starts no goroutines.
func (s *Server) RunMaintenance(ctx context.Context) error {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		if _, err := s.DeliverNotifications(ctx); err != nil && ctx.Err() == nil {
			log.Print("support notification delivery deferred")
		}
		if _, err := s.CleanupUploads(ctx); err != nil && ctx.Err() == nil {
			log.Print("support attachment cleanup deferred")
		}
		db := s.db.WithContext(ctx)
		if err := db.Where("expires_at < ?", s.cfg.Now().Unix()).Delete(&rateWindow{}).Error; err != nil && ctx.Err() == nil {
			log.Print("support rate window cleanup deferred")
		}
		if err := db.Where("site_id = ? AND delivered_at > 0 AND delivered_at < ?", s.siteID, s.cfg.Now().Add(-30*24*time.Hour).UnixMilli()).
			Delete(&Notification{}).Error; err != nil && ctx.Err() == nil {
			log.Print("support notification history cleanup deferred")
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}
