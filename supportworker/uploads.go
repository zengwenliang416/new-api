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
	"encoding/hex"
	"errors"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
	"unicode/utf8"

	_ "golang.org/x/image/webp"
	"gorm.io/gorm"
)

func (s *Server) uploadImage(w http.ResponseWriter, r *http.Request, actor identity) (any, error) {
	if err := s.rateLimit(r.Context(), actor.ID, "upload", 20, time.Hour); err != nil {
		return nil, err
	}
	select {
	case s.imageSlots <- struct{}{}:
		defer func() { <-s.imageSlots }()
	default:
		return nil, fail(http.StatusTooManyRequests, "Too many support requests, please try later")
	}
	r.Body = http.MaxBytesReader(w, r.Body, MaxImageBytes+64*1024)
	if err := r.ParseMultipartForm(1024 * 1024); err != nil {
		return nil, fail(http.StatusRequestEntityTooLarge, "Image upload request is too large")
	}
	defer r.MultipartForm.RemoveAll()
	if len(r.MultipartForm.File) != 1 || len(r.MultipartForm.File["file"]) != 1 {
		return nil, fail(http.StatusBadRequest, "Image file is required")
	}
	header := r.MultipartForm.File["file"][0]
	if header.Size < 1 || header.Size > MaxImageBytes {
		return nil, fail(http.StatusRequestEntityTooLarge, "Image must be 1 byte to 8 MB")
	}
	_, disposition, err := mime.ParseMediaType(header.Header.Get("Content-Disposition"))
	name := disposition["filename"]
	if err != nil {
		return nil, fail(http.StatusBadRequest, "Invalid image attachment")
	}
	if name == "" || utf8.RuneCountInString(name) > 120 || len(name) > 255 || strings.ContainsAny(name, "/\\:\x00\r\n") {
		return nil, fail(http.StatusBadRequest, "Invalid image attachment")
	}
	allowedExtensions := map[string]string{".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
	expected := allowedExtensions[strings.ToLower(filepath.Ext(name))]
	contentType, _, err := mime.ParseMediaType(header.Header.Get("Content-Type"))
	if err != nil || expected == "" || expected != contentType {
		return nil, fail(http.StatusBadRequest, "Only JPG, PNG, WebP, and GIF images are allowed")
	}
	file, err := header.Open()
	if err != nil {
		return nil, err
	}
	defer file.Close()
	data, err := io.ReadAll(io.LimitReader(file, MaxImageBytes+1))
	if err != nil || len(data) == 0 || len(data) > MaxImageBytes {
		return nil, fail(http.StatusRequestEntityTooLarge, "Image must be 1 byte to 8 MB")
	}
	if http.DetectContentType(data) != expected {
		return nil, fail(http.StatusBadRequest, "Image content does not match file type")
	}
	imageConfig, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil || imageConfig.Width <= 0 || imageConfig.Height <= 0 || imageConfig.Width > 10000 || imageConfig.Height > 10000 ||
		int64(imageConfig.Width)*int64(imageConfig.Height) > 16_000_000 {
		return nil, fail(http.StatusBadRequest, "Invalid image signature")
	}
	if _, _, err = image.Decode(bytes.NewReader(data)); err != nil {
		return nil, fail(http.StatusBadRequest, "Invalid image signature")
	}
	key, err := randomKey()
	if err != nil {
		return nil, err
	}
	attachment := Attachment{SiteID: s.siteID, UserID: actor.ID, Key: key, Name: name,
		Size: int64(len(data)), MIME: expected, CreatedAt: s.cfg.Now().UnixMilli()}
	// Persist the unclaimed row before touching disk: an interrupted upload can
	// then be collected after its TTL instead of leaving an untracked file.
	db := s.db.WithContext(r.Context())
	if err = db.Create(&attachment).Error; err != nil {
		return nil, err
	}
	path := filepath.Join(s.cfg.UploadDir, key)
	stored, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		_ = db.Where("site_id = ? AND id = ?", s.siteID, attachment.ID).Delete(&Attachment{}).Error
		return nil, err
	}
	_, writeErr := stored.Write(data)
	syncErr := stored.Sync()
	closeErr := stored.Close()
	if err = errors.Join(writeErr, syncErr, closeErr); err != nil {
		_ = os.Remove(path)
		return nil, err
	}
	return attachment, nil
}

func validStorageKey(key string) bool {
	if len(key) != 64 {
		return false
	}
	_, err := hex.DecodeString(key)
	return err == nil && key == strings.ToLower(key)
}

// Each upload may be claimed once, by its uploader, in the same transaction as
// its message. Client-supplied IDs, URLs, sizes and filenames are never trusted.
func (s *Server) bindAttachments(tx *gorm.DB, actor identity, ticketID, messageID int64, submitted []Attachment) ([]Attachment, error) {
	attachments := make([]Attachment, 0, len(submitted))
	if len(submitted) > 5 {
		return nil, fail(http.StatusBadRequest, "You can attach up to 5 images")
	}
	seen := make(map[string]bool, len(submitted))
	for _, supplied := range submitted {
		if !validStorageKey(supplied.Key) || seen[supplied.Key] {
			return nil, fail(http.StatusBadRequest, "Invalid image attachment")
		}
		seen[supplied.Key] = true
		var attachment Attachment
		err := tx.Where("site_id = ? AND storage_key = ? AND user_id = ? AND ticket_id = 0 AND message_id = 0 AND deleted_at = 0 AND created_at > ?",
			s.siteID, supplied.Key, actor.ID, s.cfg.Now().Add(-24*time.Hour).UnixMilli()).First(&attachment).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fail(http.StatusBadRequest, "Invalid image attachment")
		}
		if err != nil {
			return nil, err
		}
		res := tx.Model(&Attachment{}).Where("site_id = ? AND id = ? AND ticket_id = 0 AND message_id = 0 AND deleted_at = 0", s.siteID, attachment.ID).
			Updates(map[string]any{"ticket_id": ticketID, "message_id": messageID})
		if res.Error != nil {
			return nil, res.Error
		}
		if res.RowsAffected != 1 {
			return nil, fail(http.StatusConflict, "Invalid image attachment")
		}
		attachment.TicketID, attachment.MessageID = ticketID, messageID
		attachments = append(attachments, attachment)
	}
	return attachments, nil
}

func (s *Server) attachmentBlob(w http.ResponseWriter, r *http.Request, actor identity, ticketID, attachmentID int64) error {
	db := s.db.WithContext(r.Context())
	if _, err := s.ticket(db, actor, ticketID); err != nil {
		return err
	}
	var attachment Attachment
	err := db.Where("site_id = ? AND id = ? AND ticket_id = ? AND message_id > 0 AND deleted_at = 0", s.siteID, attachmentID, ticketID).First(&attachment).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return fail(http.StatusNotFound, "Attachment not found")
	}
	if err != nil {
		return err
	}
	if !validStorageKey(attachment.Key) {
		return fail(http.StatusNotFound, "Image not found")
	}
	file, err := os.OpenInRoot(s.cfg.UploadDir, attachment.Key)
	if err != nil {
		return fail(http.StatusNotFound, "Image not found")
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() || info.Size() != attachment.Size {
		return fail(http.StatusNotFound, "Image not found")
	}
	w.Header().Set("Content-Type", attachment.MIME)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": attachment.Name}))
	http.ServeContent(w, r, attachment.Name, time.Time{}, file)
	return nil
}

// CleanupUploads removes discarded ticket files and unclaimed uploads after 24
// hours. The database claim prevents a concurrent message from binding a file
// after cleanup has started. Filesystem failures retain the row for retry.
func (s *Server) CleanupUploads(ctx context.Context) (int, error) {
	now := s.cfg.Now()
	db := s.db.WithContext(ctx)
	if err := db.Model(&Attachment{}).Where("site_id = ? AND ticket_id = 0 AND deleted_at = 0 AND created_at <= ?",
		s.siteID, now.Add(-24*time.Hour).UnixMilli()).UpdateColumn("deleted_at", now.UnixMilli()).Error; err != nil {
		return 0, err
	}
	var rows []Attachment
	if err := db.Where("site_id = ? AND deleted_at > 0", s.siteID).Limit(100).Find(&rows).Error; err != nil {
		return 0, err
	}
	count := 0
	for _, row := range rows {
		if !validStorageKey(row.Key) {
			return count, errors.New("invalid stored support image key")
		}
		err := os.Remove(filepath.Join(s.cfg.UploadDir, row.Key))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return count, err
		}
		if err = db.Where("site_id = ? AND id = ? AND deleted_at > 0", s.siteID, row.ID).Delete(&Attachment{}).Error; err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}
