package model

import (
	"context"
	"errors"
	"slices"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrVideoInputUnavailable = errors.New("reference image is unavailable or expired")
var ErrVideoInputStorageFull = errors.New("temporary reference image storage budget exceeded")

// VideoInput describes an immutable, temporary reference image. Image bytes
// and signed URLs never enter the application database.
type VideoInput struct {
	ID          string `json:"id" gorm:"size:64;primaryKey"`
	UserID      int    `json:"-" gorm:"index"`
	TokenID     int    `json:"-"`
	ObjectKey   string `json:"-" gorm:"size:191;uniqueIndex"`
	Size        int64  `json:"bytes"`
	SHA256      string `json:"sha256" gorm:"size:64"`
	ContentType string `json:"content_type" gorm:"size:64"`
	Width       int    `json:"width"`
	Height      int    `json:"height"`
	Status      string `json:"status" gorm:"size:16"`
	CreatedAt   int64  `json:"created_at"`
	ExpiresAt   int64  `json:"expires_at" gorm:"index"`
}

// VideoInputUse binds a reference to the gateway's task ID before submission.
// A failed submission has no task row and expires normally. An unfinished
// durable task prevents cleanup, including after an API process restart.
type VideoInputUse struct {
	InputID   string `gorm:"size:64;primaryKey"`
	TaskID    string `gorm:"size:191;primaryKey;index"`
	CreatedAt int64
}

func ReserveVideoInput(ctx context.Context, input *VideoInput, budget int64) error {
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var owner User
		if err := lockForUpdate(tx).Select("id").First(&owner, input.UserID).Error; err != nil {
			return err
		}
		var existing VideoInput
		err := lockForUpdate(tx).Where("user_id = ? AND sha256 = ? AND size = ? AND content_type = ? AND status = ? AND expires_at > ?", input.UserID, input.SHA256, input.Size, input.ContentType, "ready", input.CreatedAt).First(&existing).Error
		if err == nil {
			existing.ExpiresAt = max(existing.ExpiresAt, input.ExpiresAt)
			if err := tx.Model(&VideoInput{}).Where("id = ?", existing.ID).Update("expires_at", existing.ExpiresAt).Error; err != nil {
				return err
			}
			*input = existing
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		var used int64
		if err := tx.Model(&VideoInput{}).Where("user_id = ?", input.UserID).Select("COALESCE(SUM(size), 0)").Scan(&used).Error; err != nil {
			return err
		}
		if input.Size > budget || used > budget-input.Size {
			return ErrVideoInputStorageFull
		}
		return tx.Create(input).Error
	})
}

func GetVideoInput(ctx context.Context, id string, userID int) (*VideoInput, error) {
	var input VideoInput
	query := DB.WithContext(ctx).Where("id = ?", id)
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}
	if err := query.First(&input).Error; err != nil {
		return nil, ErrVideoInputUnavailable
	}
	return &input, nil
}

func BeginVideoInputUpload(ctx context.Context, id string, userID int, now int64) error {
	result := DB.WithContext(ctx).Model(&VideoInput{}).
		Where("id = ? AND user_id = ? AND status = ? AND expires_at > ?", id, userID, "pending", now).
		Update("status", "uploading")
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrVideoInputUnavailable
	}
	return nil
}

func CompleteVideoInputUpload(ctx context.Context, input *VideoInput) error {
	result := DB.WithContext(ctx).Model(&VideoInput{}).
		Where("id = ? AND user_id = ? AND status = ?", input.ID, input.UserID, "uploading").
		Updates(map[string]any{"status": "ready", "width": input.Width, "height": input.Height, "expires_at": input.ExpiresAt})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrVideoInputUnavailable
	}
	input.Status = "ready"
	return nil
}

func FailVideoInputUpload(ctx context.Context, id string) error {
	return DB.WithContext(ctx).Model(&VideoInput{}).Where("id = ? AND status = ?", id, "uploading").Update("status", "pending").Error
}

func ClaimVideoInputs(ctx context.Context, ids []string, userID int, taskID string, now, expires int64) (map[string]VideoInput, error) {
	ordered := slices.Clone(ids)
	slices.Sort(ordered)
	ordered = slices.Compact(ordered)
	inputs := make(map[string]VideoInput, len(ordered))
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, id := range ordered {
			var input VideoInput
			if err := lockForUpdate(tx).Where("id = ? AND user_id = ? AND status = ? AND expires_at > ?", id, userID, "ready", now).First(&input).Error; err != nil {
				return ErrVideoInputUnavailable
			}
			input.ExpiresAt = max(input.ExpiresAt, expires)
			if err := tx.Model(&VideoInput{}).Where("id = ?", id).Update("expires_at", input.ExpiresAt).Error; err != nil {
				return err
			}
			use := VideoInputUse{InputID: id, TaskID: taskID, CreatedAt: now}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&use).Error; err != nil {
				return err
			}
			inputs[id] = input
		}
		return nil
	})
	return inputs, err
}

// ClaimExpiredVideoInput changes state before object deletion, excluding new
// submissions atomically. Unfinished tasks and their terminal grace period
// extend retention. Missing tasks are failed/abandoned submissions.
func ClaimExpiredVideoInput(ctx context.Context, id string, now, retention int64) (*VideoInput, error) {
	var input VideoInput
	err := DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where("id = ? AND expires_at <= ?", id, now).First(&input).Error; err != nil {
			return err
		}
		var uses []VideoInputUse
		if err := tx.Where("input_id = ?", id).Find(&uses).Error; err != nil {
			return err
		}
		expires := input.ExpiresAt
		for _, use := range uses {
			var task Task
			err := tx.Select("task_id", "status", "finish_time").Where("task_id = ? AND user_id = ?", use.TaskID, input.UserID).First(&task).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				expires = max(expires, use.CreatedAt+retention)
				continue
			}
			if err != nil {
				return err
			}
			if task.Status != TaskStatusSuccess && task.Status != TaskStatusFailure || task.FinishTime <= 0 {
				expires = max(expires, now+retention)
			} else {
				expires = max(expires, task.FinishTime+retention)
			}
		}
		if expires > now {
			input.ExpiresAt = expires
			return tx.Model(&VideoInput{}).Where("id = ?", id).Update("expires_at", expires).Error
		}
		input.Status = "deleting"
		return tx.Model(&VideoInput{}).Where("id = ?", id).Update("status", "deleting").Error
	})
	if err != nil {
		return nil, err
	}
	if input.Status != "deleting" {
		return nil, nil
	}
	return &input, nil
}

func DeleteVideoInputRecord(ctx context.Context, id string) error {
	return DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("input_id = ?", id).Delete(&VideoInputUse{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND status = ?", id, "deleting").Delete(&VideoInput{}).Error
	})
}
