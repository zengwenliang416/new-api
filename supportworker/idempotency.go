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
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s *Server) prepareMutation(actor identity, action, requestID string, payload any) (*mutationReceipt, error) {
	if requestID == "" {
		return nil, nil
	}
	if len(requestID) > 128 {
		return nil, fail(http.StatusBadRequest, "Invalid client request id")
	}
	for _, char := range requestID {
		if char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char >= '0' && char <= '9' || char == '-' || char == '_' || char == '.' || char == ':' {
			continue
		}
		return nil, fail(http.StatusBadRequest, "Invalid client request id")
	}
	key, err := common.Marshal([]any{s.siteID, actor.ID, action, requestID})
	if err != nil {
		return nil, err
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}
	id, digest := sha256.Sum256(key), sha256.Sum256(encoded)
	owner, err := randomKey()
	if err != nil {
		return nil, err
	}
	return &mutationReceipt{ID: hex.EncodeToString(id[:]), SiteID: s.siteID, UserID: actor.ID, Action: action,
		RequestID: requestID, PayloadHash: hex.EncodeToString(digest[:]), Owner: owner}, nil
}

func (s *Server) replayMutation(r *http.Request, actor identity, receipt *mutationReceipt) (any, bool, error) {
	if receipt == nil {
		return nil, false, nil
	}
	var stored mutationReceipt
	err := s.db.WithContext(r.Context()).Where("site_id = ? AND user_id = ? AND id = ?", s.siteID, actor.ID, receipt.ID).First(&stored).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if stored.PayloadHash != receipt.PayloadHash {
		return nil, true, fail(http.StatusConflict, "Client request id was already used with different content")
	}
	data, err := s.getTicket(r, actor, stored.TicketID)
	return data, true, err
}

// The unique insert waits for a concurrent owner's transaction to commit. A
// random owner marker avoids relying on dialect-dependent RowsAffected values.
func (s *Server) claimMutation(tx *gorm.DB, receipt *mutationReceipt) (int64, error) {
	if receipt == nil {
		return 0, nil
	}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(receipt).Error; err != nil {
		return 0, err
	}
	var stored mutationReceipt
	if err := tx.Where("site_id = ? AND user_id = ? AND id = ?", s.siteID, receipt.UserID, receipt.ID).First(&stored).Error; err != nil {
		return 0, err
	}
	if stored.PayloadHash != receipt.PayloadHash {
		return 0, fail(http.StatusConflict, "Client request id was already used with different content")
	}
	if stored.Owner == receipt.Owner {
		return 0, nil
	}
	if stored.TicketID <= 0 {
		return 0, fail(http.StatusConflict, "Support request is still processing")
	}
	return stored.TicketID, nil
}

func (s *Server) completeMutation(tx *gorm.DB, receipt *mutationReceipt, ticketID, messageID int64) error {
	if receipt == nil {
		return nil
	}
	return tx.Model(&mutationReceipt{}).Where("site_id = ? AND id = ? AND owner = ?", s.siteID, receipt.ID, receipt.Owner).
		Updates(map[string]any{"ticket_id": ticketID, "message_id": messageID}).Error
}

func attachmentKeys(attachments []Attachment) []string {
	keys := make([]string, len(attachments))
	for i := range attachments {
		keys[i] = attachments[i].Key
	}
	return keys
}
