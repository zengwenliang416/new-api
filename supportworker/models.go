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

import "gorm.io/gorm"

type Ticket struct {
	ID                    int64  `json:"id" gorm:"primaryKey"`
	SiteID                string `json:"-" gorm:"size:120;not null;index:idx_support_ticket_owner,priority:1"`
	UserID                int    `json:"user_id" gorm:"not null;index:idx_support_ticket_owner,priority:2"`
	Username              string `json:"username" gorm:"size:255"`
	Title                 string `json:"title" gorm:"size:480;not null"`
	Status                string `json:"status" gorm:"size:16;not null"`
	Category              string `json:"category" gorm:"size:32;not null"`
	Priority              string `json:"priority" gorm:"size:16;not null"`
	VerificationLevel     string `json:"verification_level" gorm:"size:32;not null"`
	UnreadUser            bool   `json:"unread_user"`
	UnreadAdmin           bool   `json:"unread_admin"`
	LastMessagePreview    string `json:"last_message_preview" gorm:"size:800"`
	LastMessageSenderType string `json:"last_message_sender_type" gorm:"size:16"`
	CreatedAt             int64  `json:"created_at" gorm:"autoCreateTime:false"`
	UpdatedAt             int64  `json:"updated_at" gorm:"autoUpdateTime:false;index"`
	Version               int64  `json:"-" gorm:"not null"`
}

func (Ticket) TableName() string { return "support_tickets" }

type Message struct {
	ID          int64        `json:"id" gorm:"primaryKey"`
	SiteID      string       `json:"-" gorm:"size:120;not null;index:idx_support_message_ticket,priority:1"`
	TicketID    int64        `json:"-" gorm:"not null;index:idx_support_message_ticket,priority:2"`
	SenderID    int          `json:"-" gorm:"not null"`
	SenderType  string       `json:"sender_type" gorm:"size:16;not null"`
	SenderName  string       `json:"sender_name" gorm:"size:255"`
	SenderLang  string       `json:"sender_lang" gorm:"size:16"`
	Body        string       `json:"body" gorm:"type:text;not null"`
	CreatedAt   int64        `json:"created_at" gorm:"autoCreateTime:false"`
	Attachments []Attachment `json:"attachments" gorm:"-"`
}

func (Message) TableName() string { return "support_messages" }

type Attachment struct {
	ID        int64  `json:"id" gorm:"primaryKey"`
	SiteID    string `json:"-" gorm:"size:120;not null;index:idx_support_attachment_owner,priority:1"`
	UserID    int    `json:"-" gorm:"not null;index:idx_support_attachment_owner,priority:2"`
	TicketID  int64  `json:"-" gorm:"not null;index"`
	MessageID int64  `json:"-" gorm:"not null;index"`
	Key       string `json:"key" gorm:"column:storage_key;size:64;not null;uniqueIndex"`
	Name      string `json:"name" gorm:"size:255;not null"`
	Size      int64  `json:"size" gorm:"not null"`
	MIME      string `json:"-" gorm:"size:32;not null"`
	CreatedAt int64  `json:"-" gorm:"autoCreateTime:false;index"`
	DeletedAt int64  `json:"-" gorm:"not null"`
}

func (Attachment) TableName() string { return "support_attachments" }

type Translation struct {
	ID        int64  `json:"-" gorm:"primaryKey"`
	SiteID    string `json:"-" gorm:"size:120;not null;uniqueIndex:idx_support_translation,priority:1"`
	MessageID int64  `json:"-" gorm:"not null;uniqueIndex:idx_support_translation,priority:2"`
	Language  string `json:"-" gorm:"size:16;not null;uniqueIndex:idx_support_translation,priority:3"`
	Body      string `json:"body" gorm:"type:text;not null"`
	Status    string `json:"status" gorm:"size:16;not null"`
}

func (Translation) TableName() string { return "support_translations" }

// Notification records are created in the same transaction as the reply. A
// leased delivery can be retried after process failure using the same EventID.
type Notification struct {
	ID          int64  `gorm:"primaryKey"`
	SiteID      string `gorm:"size:120;not null;index"`
	EventID     string `gorm:"size:64;not null;uniqueIndex"`
	TicketID    int64  `gorm:"not null;index"`
	Payload     string `gorm:"type:text;not null"`
	Attempts    int
	RetryAt     int64 `gorm:"index"`
	LeaseUntil  int64
	LeaseOwner  string `gorm:"size:64"`
	DeliveredAt int64
}

func (Notification) TableName() string { return "support_notifications" }

type rateWindow struct {
	ID        string `gorm:"primaryKey;size:64"`
	Count     int
	ExpiresAt int64 `gorm:"index"`
}

func (rateWindow) TableName() string { return "support_rate_windows" }

// The digest primary key enforces (site, actor, operation, client_request_id)
// uniqueness without exceeding older MySQL utf8mb4 composite-index limits.
type mutationReceipt struct {
	ID          string `gorm:"primaryKey;size:64"`
	SiteID      string `gorm:"size:64;not null;index"`
	UserID      int    `gorm:"not null"`
	Action      string `gorm:"size:32;not null"`
	RequestID   string `gorm:"size:128;not null"`
	PayloadHash string `gorm:"size:64;not null"`
	Owner       string `gorm:"size:64;not null"`
	TicketID    int64
	MessageID   int64
}

func (mutationReceipt) TableName() string { return "support_mutation_receipts" }

type TicketDetail struct {
	Ticket       Ticket                `json:"ticket"`
	Messages     []Message             `json:"messages"`
	Translations map[int64]Translation `json:"translations,omitempty"`
	NextCursor   *string               `json:"next_cursor"`
}

type TicketPage struct {
	Items      []Ticket `json:"items"`
	NextCursor *string  `json:"next_cursor"`
}

type MessagePage struct {
	Items        []Message             `json:"items"`
	NextCursor   *string               `json:"next_cursor"`
	Translations map[int64]Translation `json:"translations,omitempty"`
}

// Migrate is idempotent and uses only portable GORM field and index definitions.
func Migrate(db *gorm.DB) error {
	return db.AutoMigrate(&Ticket{}, &Message{}, &Attachment{}, &Translation{}, &Notification{}, &rateWindow{}, &mutationReceipt{})
}
