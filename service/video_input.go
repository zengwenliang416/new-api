package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	_ "golang.org/x/image/webp"
)

const VideoInputPrefix = "newapi-input://"
const VideoInputTaskContextKey = "video_input_task_id"

type VideoInputConfig struct {
	PublicURL  string
	SigningKey string
	LinkTTL    time.Duration
	Retention  time.Duration
	UserBudget int64
	MaxBytes   int64
}

type VideoInputObjects interface {
	Put(context.Context, string, io.Reader, int64, string) error
	Open(context.Context, string) (io.ReadSeekCloser, error)
	Remove(context.Context, string) error
}

type VideoInputService struct {
	Config  VideoInputConfig
	Objects VideoInputObjects
}

// VideoInputs is initialized once at startup. Disabled installations expose
// capabilities=false and do not accept uploads or run cleanup.
var VideoInputs *VideoInputService

func InitVideoInputs() error {
	if !common.GetEnvOrDefaultBool("VIDEO_INPUTS_ENABLED", false) {
		return nil
	}
	base := os.Getenv("VIDEO_INPUT_PUBLIC_URL")
	u, err := url.Parse(base)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" && u.Path != "/" {
		return errors.New("VIDEO_INPUT_PUBLIC_URL must be an HTTPS origin")
	}
	seconds, err := strconv.ParseInt(os.Getenv("VIDEO_INPUT_LINK_TTL_SECONDS"), 10, 64)
	if err != nil || seconds <= 0 || seconds > int64((24*time.Hour)/time.Second) {
		return errors.New("VIDEO_INPUT_LINK_TTL_SECONDS must be between 1 and 86400")
	}
	retention, err := strconv.ParseInt(os.Getenv("VIDEO_INPUT_RETENTION_SECONDS"), 10, 64)
	if err != nil || retention < seconds || retention > int64((7*24*time.Hour)/time.Second) {
		return errors.New("VIDEO_INPUT_RETENTION_SECONDS must cover the link TTL and be at most 604800")
	}
	budget, err := strconv.ParseInt(os.Getenv("VIDEO_INPUT_USER_BUDGET_BYTES"), 10, 64)
	key := os.Getenv("VIDEO_INPUT_SIGNING_KEY")
	if err != nil || budget <= 0 || len(key) < 32 {
		return errors.New("video input storage budget and application signing key are required")
	}
	maxBytes := min(budget, int64(max(constant.MaxRequestBodyMB, 1))<<20)
	if raw := os.Getenv("VIDEO_INPUT_MAX_BYTES"); raw != "" {
		limit, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || limit <= 0 || limit > maxBytes {
			return errors.New("VIDEO_INPUT_MAX_BYTES must be positive and within the existing request body and storage limits")
		}
		maxBytes = limit
	}
	endpoint, err := url.Parse(os.Getenv("VIDEO_INPUT_S3_ENDPOINT"))
	if err != nil || endpoint.Host == "" || endpoint.User != nil || endpoint.Path != "" && endpoint.Path != "/" || endpoint.RawQuery != "" || endpoint.Fragment != "" || endpoint.Scheme != "http" && endpoint.Scheme != "https" {
		return errors.New("VIDEO_INPUT_S3_ENDPOINT must be an HTTP(S) origin")
	}
	bucket := os.Getenv("VIDEO_INPUT_S3_BUCKET")
	access, secret := os.Getenv("VIDEO_INPUT_S3_ACCESS_KEY"), os.Getenv("VIDEO_INPUT_S3_SECRET_KEY")
	if bucket == "" || access == "" || secret == "" {
		return errors.New("video input private bucket and application credentials are required")
	}
	client, err := minio.New(endpoint.Host, &minio.Options{Creds: credentials.NewStaticV4(access, secret, ""), Secure: endpoint.Scheme == "https"})
	if err != nil {
		return errors.New("invalid video input storage configuration")
	}
	VideoInputs = &VideoInputService{
		Config: VideoInputConfig{
			PublicURL: strings.TrimRight(base, "/"), SigningKey: key,
			LinkTTL: time.Duration(seconds) * time.Second, Retention: time.Duration(retention) * time.Second,
			UserBudget: budget, MaxBytes: maxBytes,
		},
		Objects: &videoInputS3{client: client, bucket: bucket},
	}
	return nil
}

type videoInputS3 struct {
	client *minio.Client
	bucket string
}

func (s *videoInputS3) Put(ctx context.Context, key string, body io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, body, size, minio.PutObjectOptions{ContentType: contentType, DisableMultipart: true})
	return err
}

func (s *videoInputS3) Open(ctx context.Context, key string) (io.ReadSeekCloser, error) {
	object, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, err
	}
	if _, err = object.Stat(); err != nil {
		_ = object.Close()
		return nil, err
	}
	return object, nil
}

func (s *videoInputS3) Remove(ctx context.Context, key string) error {
	return s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{})
}

func (s *VideoInputService) Reserve(ctx context.Context, userID, tokenID int, size int64, digest, contentType string, now time.Time) (*model.VideoInput, error) {
	if size <= 0 || size > s.Config.MaxBytes {
		return nil, fmt.Errorf("reference image must be between 1 and %d bytes", s.Config.MaxBytes)
	}
	decoded, err := hex.DecodeString(digest)
	if err != nil || len(decoded) != sha256.Size || digest != strings.ToLower(digest) {
		return nil, errors.New("a SHA-256 digest is required")
	}
	if contentType != "image/png" && contentType != "image/jpeg" && contentType != "image/webp" {
		return nil, errors.New("reference images must be PNG, JPEG or WebP")
	}
	var random [24]byte
	if _, err := rand.Read(random[:]); err != nil {
		return nil, err
	}
	id := "vi_" + hex.EncodeToString(random[:])
	input := &model.VideoInput{
		ID: id, UserID: userID, TokenID: tokenID, ObjectKey: "inputs/" + id,
		Size: size, SHA256: digest, ContentType: contentType, Status: "pending",
		CreatedAt: now.Unix(), ExpiresAt: now.Add(s.Config.Retention).Unix(),
	}
	if err := model.ReserveVideoInput(ctx, input, s.Config.UserBudget); err != nil {
		return nil, err
	}
	return input, nil
}

// Upload spools at most the declared length plus one byte, validates the hash
// and raster header, then stores exactly those bytes. No image is re-encoded.
func (s *VideoInputService) Upload(ctx context.Context, id string, userID int, body io.Reader, now time.Time) (*model.VideoInput, error) {
	input, err := model.GetVideoInput(ctx, id, userID)
	if err != nil {
		return nil, err
	}
	if err := model.BeginVideoInputUpload(ctx, id, userID, now.Unix()); err != nil {
		return nil, err
	}
	completed := false
	defer func() {
		if !completed {
			_ = model.FailVideoInputUpload(context.WithoutCancel(ctx), id)
		}
	}()
	file, err := os.CreateTemp("", "video-input-*")
	if err != nil {
		return nil, errors.New("temporary image storage is unavailable")
	}
	defer os.Remove(file.Name())
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(io.MultiWriter(file, hash), io.LimitReader(body, input.Size+1))
	if err != nil || size != input.Size || hex.EncodeToString(hash.Sum(nil)) != input.SHA256 {
		return nil, errors.New("reference image size or SHA-256 does not match the reserved upload")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	meta, format, err := image.DecodeConfig(file)
	mimeTypes := map[string]string{"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
	if err != nil || meta.Width <= 0 || meta.Height <= 0 || mimeTypes[format] != input.ContentType {
		return nil, errors.New("reference image content does not match its declared image format")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return nil, err
	}
	if err := s.Objects.Put(ctx, input.ObjectKey, file, input.Size, input.ContentType); err != nil {
		return nil, errors.New("reference image storage is unavailable; generation was not submitted")
	}
	input.Width, input.Height = meta.Width, meta.Height
	input.ExpiresAt = now.Add(s.Config.Retention).Unix()
	if err := model.CompleteVideoInputUpload(ctx, input); err != nil {
		return nil, err
	}
	completed = true
	return input, nil
}

func (s *VideoInputService) ContentURL(id string, now time.Time) string {
	expires := strconv.FormatInt(now.Add(s.Config.LinkTTL).Unix(), 10)
	mac := hmac.New(sha256.New, []byte(s.Config.SigningKey))
	_, _ = io.WriteString(mac, "video-input-v1\x00"+id+"\x00"+expires)
	return s.Config.PublicURL + "/v1/video-inputs/" + url.PathEscape(id) + "/content?expires=" + expires + "&signature=" + hex.EncodeToString(mac.Sum(nil))
}

func (s *VideoInputService) VerifyContentAccess(id, expires, signature string, now time.Time) bool {
	deadline, err := strconv.ParseInt(expires, 10, 64)
	if err != nil || deadline <= now.Unix() || deadline > now.Add(s.Config.LinkTTL).Unix() || strconv.FormatInt(deadline, 10) != expires {
		return false
	}
	supplied, err := hex.DecodeString(signature)
	if err != nil || len(supplied) != sha256.Size {
		return false
	}
	mac := hmac.New(sha256.New, []byte(s.Config.SigningKey))
	_, _ = io.WriteString(mac, "video-input-v1\x00"+id+"\x00"+expires)
	return hmac.Equal(mac.Sum(nil), supplied)
}

func (s *VideoInputService) ServeContent(w http.ResponseWriter, r *http.Request, id string) {
	if !s.VerifyContentAccess(id, r.URL.Query().Get("expires"), r.URL.Query().Get("signature"), time.Now()) {
		http.NotFound(w, r)
		return
	}
	input, err := model.GetVideoInput(r.Context(), id, 0)
	if err != nil || input.Status != "ready" || input.ExpiresAt <= time.Now().Unix() {
		http.NotFound(w, r)
		return
	}
	object, err := s.Objects.Open(r.Context(), input.ObjectKey)
	if err != nil {
		http.Error(w, "reference image is temporarily unavailable", http.StatusServiceUnavailable)
		return
	}
	defer object.Close()
	w.Header().Set("Content-Type", input.ContentType)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Content-Disposition", `attachment; filename="reference-image"`)
	http.ServeContent(w, r, "", time.Time{}, object)
}

func (s *VideoInputService) Cleanup(ctx context.Context, now time.Time) (int, error) {
	var candidates []model.VideoInput
	if err := model.DB.WithContext(ctx).Where("expires_at <= ?", now.Unix()).Order("expires_at").Limit(100).Find(&candidates).Error; err != nil {
		return 0, err
	}
	deleted := 0
	for _, candidate := range candidates {
		input, err := model.ClaimExpiredVideoInput(ctx, candidate.ID, now.Unix(), int64(s.Config.Retention/time.Second))
		if err != nil {
			return deleted, err
		}
		if input == nil {
			continue
		}
		if err := s.Objects.Remove(ctx, input.ObjectKey); err != nil {
			return deleted, errors.New("temporary image cleanup storage operation failed")
		}
		if err := model.DeleteVideoInputRecord(ctx, input.ID); err != nil {
			return deleted, err
		}
		deleted++
	}
	return deleted, nil
}
