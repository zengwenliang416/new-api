package model

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const supportNotificationLease = 2 * time.Minute

var (
	ErrSupportNotificationConflict = errors.New("support notification event conflicts with its original delivery")
	ErrSupportNotificationPending  = errors.New("support notification delivery is already in progress")
	ErrInvalidSupportNotification  = errors.New("invalid support notification delivery")
)

type SupportNotificationConflictError struct {
	EventID string
}

func (e *SupportNotificationConflictError) Error() string {
	return ErrSupportNotificationConflict.Error()
}

func (e *SupportNotificationConflictError) Unwrap() error {
	return ErrSupportNotificationConflict
}

type SupportNotificationPendingError struct {
	RetryAfter time.Duration
}

func (e *SupportNotificationPendingError) Error() string {
	return ErrSupportNotificationPending.Error()
}

func (e *SupportNotificationPendingError) Unwrap() error {
	return ErrSupportNotificationPending
}

// SupportNotification binds a worker outbox event to its recipient and payload.
// ID hashes the exact event ID so case-insensitive MySQL collations cannot merge
// different events. Delivered receipts must be retained while a worker can retry.
type SupportNotification struct {
	ID             string `gorm:"type:char(64);primaryKey"`
	EventID        string `gorm:"type:varchar(255);not null"`
	UserID         int    `gorm:"not null"`
	PayloadHash    string `gorm:"type:varchar(128);not null"`
	ClaimToken     string `gorm:"type:varchar(32);not null"`
	LeaseExpiresAt int64  `gorm:"not null"`
	DeliveredAt    int64  `gorm:"not null"`
	CreatedAt      int64  `gorm:"not null;autoCreateTime:false"`
	UpdatedAt      int64  `gorm:"not null;autoUpdateTime:false"`
}

// DeliverSupportNotification suppresses retries after a successful delivery has
// been recorded. Database claims coordinate replicas without a transaction over
// the network call. A crash or an ambiguous external delivery result can still
// cause a later retry to deliver again; this is not an exactly-once guarantee.
func DeliverSupportNotification(eventID string, userID int, payloadHash string, deliver func() error) error {
	if strings.TrimSpace(eventID) == "" || len(eventID) > 255 || userID <= 0 ||
		strings.TrimSpace(payloadHash) == "" || len(payloadHash) > 128 || deliver == nil {
		return ErrInvalidSupportNotification
	}
	db := DB
	if db == nil {
		return errors.New("support notification database is unavailable")
	}
	now, err := supportNotificationTimestamp(db)
	if err != nil {
		return err
	}
	digest := sha256.Sum256([]byte(eventID))
	id := hex.EncodeToString(digest[:])
	receipt := SupportNotification{
		ID: id, EventID: eventID, UserID: userID, PayloadHash: payloadHash,
		CreatedAt: now, UpdatedAt: now,
	}
	if err := db.Clauses(clause.OnConflict{DoNothing: true}).Create(&receipt).Error; err != nil {
		return err
	}
	// Read the binding back: MySQL and PostgreSQL report duplicate-insert row
	// counts differently, so RowsAffected cannot establish ownership here.
	if err := db.Where("id = ?", id).First(&receipt).Error; err != nil {
		return err
	}
	if receipt.EventID != eventID || receipt.UserID != userID || receipt.PayloadHash != payloadHash {
		return &SupportNotificationConflictError{EventID: eventID}
	}
	if receipt.DeliveredAt != 0 {
		return nil
	}
	claimBytes := make([]byte, 16)
	if _, err := rand.Read(claimBytes); err != nil {
		return err
	}
	claim := hex.EncodeToString(claimBytes)
	now, err = supportNotificationTimestamp(db)
	if err != nil {
		return err
	}
	result := db.Model(&SupportNotification{}).
		Where("id = ? AND delivered_at = 0 AND (claim_token = ? OR lease_expires_at <= ?)", id, "", now).
		Updates(map[string]any{
			"claim_token": claim, "lease_expires_at": now + int64(supportNotificationLease/time.Second), "updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		if err := db.Where("id = ?", id).First(&receipt).Error; err != nil {
			return err
		}
		if receipt.DeliveredAt != 0 {
			return nil
		}
		return &SupportNotificationPendingError{RetryAfter: time.Duration(max(1, receipt.LeaseExpiresAt-now)) * time.Second}
	}

	stop := make(chan struct{})
	stopped := make(chan struct{})
	go renewSupportNotificationClaim(db, id, claim, stop, stopped)
	defer func() {
		close(stop)
		<-stopped
	}()
	if err := deliver(); err != nil {
		// Only the owning claimant may release the event. Never clear a claim
		// acquired by another replica after this one's lease expired.
		released := db.Model(&SupportNotification{}).
			Where("id = ? AND claim_token = ? AND delivered_at = 0", id, claim).
			Updates(map[string]any{"claim_token": "", "lease_expires_at": 0})
		return errors.Join(err, released.Error)
	}

	now, err = supportNotificationTimestamp(db)
	if err != nil {
		return err
	}
	result = db.Model(&SupportNotification{}).
		Where("id = ? AND claim_token = ? AND delivered_at = 0", id, claim).
		Updates(map[string]any{
			"delivered_at": now, "claim_token": "", "lease_expires_at": 0, "updated_at": now,
		})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 0 {
		return nil
	}
	if err := db.Where("id = ?", id).First(&receipt).Error; err != nil {
		return err
	}
	if receipt.DeliveredAt != 0 {
		return nil
	}
	return &SupportNotificationPendingError{RetryAfter: time.Duration(max(1, receipt.LeaseExpiresAt-now)) * time.Second}
}

// Use the shared database clock for leases across replicas. Unlike the general
// GetDBTimestamp helper, a clock-query failure must not fall back to a skewed
// application clock and accidentally steal an active notification claim.
func supportNotificationTimestamp(db *gorm.DB) (int64, error) {
	var query string
	switch db.Dialector.Name() {
	case "sqlite":
		query = "SELECT CAST(strftime('%s', 'now') AS INTEGER)"
	case "mysql":
		query = "SELECT UNIX_TIMESTAMP()"
	case "postgres":
		query = "SELECT FLOOR(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP))::bigint"
	default:
		return 0, errors.New("unsupported support notification database")
	}
	var now int64
	if err := db.Raw(query).Scan(&now).Error; err != nil {
		return 0, err
	}
	if now <= 0 {
		return 0, errors.New("invalid support notification database time")
	}
	return now, nil
}

func renewSupportNotificationClaim(db *gorm.DB, id, claim string, stop <-chan struct{}, stopped chan<- struct{}) {
	defer close(stopped)
	ticker := time.NewTicker(supportNotificationLease / 3)
	defer ticker.Stop()
	for {
		select {
		case <-stop:
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			leaseDB := db.WithContext(ctx)
			now, err := supportNotificationTimestamp(leaseDB)
			if err != nil {
				cancel()
				return
			}
			result := leaseDB.Model(&SupportNotification{}).
				Where("id = ? AND claim_token = ? AND delivered_at = 0 AND lease_expires_at > ?", id, claim, now).
				Updates(map[string]any{"lease_expires_at": now + int64(supportNotificationLease/time.Second), "updated_at": now})
			cancel()
			if result.Error != nil || result.RowsAffected == 0 {
				return
			}
		}
	}
}
