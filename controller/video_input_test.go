package controller

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"image"
	"image/color"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

type videoInputTestObjects struct {
	directory  string
	failRemove bool
}

func (s *videoInputTestObjects) Put(_ context.Context, key string, reader io.Reader, size int64, _ string) error {
	data, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(s.directory, filepath.Base(key)), data, 0600)
}

func (s *videoInputTestObjects) Open(_ context.Context, key string) (io.ReadSeekCloser, error) {
	return os.Open(filepath.Join(s.directory, filepath.Base(key)))
}

func (s *videoInputTestObjects) Remove(_ context.Context, key string) error {
	if s.failRemove {
		return errors.New("storage unavailable")
	}
	err := os.Remove(filepath.Join(s.directory, filepath.Base(key)))
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	return err
}

func setupVideoInputTest(t *testing.T) (*service.VideoInputService, []byte, *model.User) {
	t.Helper()
	db, dialect := openTaskDialectDatabase(t, &model.User{}, &model.Token{}, &model.VideoInput{}, &model.VideoInputUse{}, &model.Task{})
	previousDB, previousService, previousDialect := model.DB, service.VideoInputs, common.MainDatabaseType()
	previousRedis, previousMemory := common.RedisEnabled, common.MemoryCacheEnabled
	model.DB = db
	common.RedisEnabled, common.MemoryCacheEnabled = false, false
	common.SetMainDatabaseType(dialect)
	t.Cleanup(func() {
		model.DB, service.VideoInputs = previousDB, previousService
		common.SetMainDatabaseType(previousDialect)
		common.RedisEnabled, common.MemoryCacheEnabled = previousRedis, previousMemory
	})
	owner := &model.User{Username: "reference-owner", AffCode: "reference-owner", Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "default", Quota: 1000000}
	require.NoError(t, db.Create(owner).Error)
	s := &service.VideoInputService{
		Config:  service.VideoInputConfig{PublicURL: "https://media.example.test", SigningKey: "test-signing-key", LinkTTL: time.Hour, Retention: 24 * time.Hour, UserBudget: 10 << 20, MaxBytes: 1 << 20},
		Objects: &videoInputTestObjects{directory: t.TempDir()},
	}
	service.VideoInputs = s
	canvas := image.NewNRGBA(image.Rect(0, 0, 80, 48))
	canvas.Set(30, 20, color.NRGBA{R: 255, A: 255})
	var encoded bytes.Buffer
	require.NoError(t, png.Encode(&encoded, canvas))
	return s, encoded.Bytes(), owner
}

func TestVideoInputHTTPAuthentication(t *testing.T) {
	_, data, owner := setupVideoInputTest(t)
	previousLog, previousLogType, previousMaster := model.LOG_DB, common.LogDatabaseType(), common.IsMasterNode
	t.Setenv("LOG_SQL_DSN", "")
	common.IsMasterNode = false
	require.NoError(t, model.InitLogDB()) // Initialize the driver's reserved-column quoting used by token lookup.
	common.IsMasterNode = previousMaster
	t.Cleanup(func() { model.LOG_DB = previousLog; common.SetLogDatabaseType(previousLogType) })
	token := &model.Token{UserId: owner.Id, Key: strings.Repeat("a", 40), Status: common.TokenStatusEnabled, RemainQuota: 1000000, ExpiredTime: -1, Group: "default"}
	require.NoError(t, model.DB.Create(token).Error)
	digest := sha256.Sum256(data)
	payload, err := common.Marshal(map[string]any{"bytes": len(data), "sha256": hex.EncodeToString(digest[:]), "content_type": "image/png"})
	require.NoError(t, err)
	engine := gin.New()
	engine.POST("/v1/video-inputs", middleware.TokenAuth(), CreateVideoInput)
	for _, tc := range []struct {
		name, authorization string
		status              int
	}{
		{"missing", "", http.StatusUnauthorized},
		{"invalid", "Bearer sk-invalid", http.StatusUnauthorized},
		{"valid", "Bearer sk-" + token.Key, http.StatusCreated},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(http.MethodPost, "/v1/video-inputs", bytes.NewReader(payload))
			r.Header.Set("Content-Type", "application/json")
			r.Header.Set("Authorization", tc.authorization)
			w := httptest.NewRecorder()
			engine.ServeHTTP(w, r)
			assert.Equal(t, tc.status, w.Code)
			assert.NotContains(t, w.Body.String(), token.Key)
			assert.NotContains(t, w.Body.String(), "object_key")
		})
	}
	require.NoError(t, model.DB.Model(token).Update("status", common.TokenStatusDisabled).Error)
	r := httptest.NewRequest(http.MethodPost, "/v1/video-inputs", bytes.NewReader(payload))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Authorization", "Bearer sk-"+token.Key)
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, r)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestVideoInputRequestBodyLimit(t *testing.T) {
	previous := constant.MaxRequestBodyMB
	constant.MaxRequestBodyMB = 1
	t.Cleanup(func() { constant.MaxRequestBodyMB = previous })
	engine := gin.New()
	called := false
	engine.POST("/v1/videos", middleware.ResolveVideoInputs(), func(c *gin.Context) { called = true })
	r := httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(`{"prompt":"`+strings.Repeat("x", 1<<20)+`"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	engine.ServeHTTP(w, r)
	assert.Equal(t, http.StatusRequestEntityTooLarge, w.Code)
	assert.False(t, called)
}

func reserveVideoInputTest(t *testing.T, s *service.VideoInputService, owner int, data []byte, now time.Time) *model.VideoInput {
	t.Helper()
	digest := sha256.Sum256(data)
	input, err := s.Reserve(context.Background(), owner, 11, int64(len(data)), hex.EncodeToString(digest[:]), "image/png", now)
	require.NoError(t, err)
	return input
}

func TestVideoInputOriginalBytesOwnershipAndExpiry(t *testing.T) {
	s, data, owner := setupVideoInputTest(t)
	now := time.Now().Truncate(time.Second)
	input := reserveVideoInputTest(t, s, owner.Id, data, now)
	_, err := s.Upload(context.Background(), input.ID, owner.Id+1, bytes.NewReader(data), now)
	require.ErrorIs(t, err, model.ErrVideoInputUnavailable)
	_, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(append(bytes.Clone(data), 0)), now)
	require.ErrorContains(t, err, "size or SHA-256")
	input, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(data), now)
	require.NoError(t, err)
	assert.Equal(t, 80, input.Width)
	assert.Equal(t, 48, input.Height)
	_, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(data), now)
	require.ErrorIs(t, err, model.ErrVideoInputUnavailable, "a ready image is immutable")
	reused := reserveVideoInputTest(t, s, owner.Id, data, now.Add(time.Minute))
	assert.Equal(t, input.ID, reused.ID, "the same user's repeated generation reuses unchanged original bytes")

	contentURL := s.ContentURL(input.ID, now)
	u, err := url.Parse(contentURL)
	require.NoError(t, err)
	assert.True(t, s.VerifyContentAccess(input.ID, u.Query().Get("expires"), u.Query().Get("signature"), now))
	assert.False(t, s.VerifyContentAccess("another-image", u.Query().Get("expires"), u.Query().Get("signature"), now))
	assert.False(t, s.VerifyContentAccess(input.ID, u.Query().Get("expires"), u.Query().Get("signature"), now.Add(time.Hour)))
	recorder := httptest.NewRecorder()
	s.ServeContent(recorder, httptest.NewRequest(http.MethodGet, contentURL, nil), input.ID)
	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, data, recorder.Body.Bytes(), "original pixels, encoding and metadata are preserved byte-for-byte")
	assert.Equal(t, "nosniff", recorder.Header().Get("X-Content-Type-Options"))
	request := httptest.NewRequest(http.MethodGet, contentURL, nil)
	request.Header.Set("Range", "bytes=0-7")
	recorder = httptest.NewRecorder()
	s.ServeContent(recorder, request, input.ID)
	assert.Equal(t, http.StatusPartialContent, recorder.Code)
	assert.Equal(t, data[:8], recorder.Body.Bytes())
	request = httptest.NewRequest(http.MethodHead, contentURL, nil)
	recorder = httptest.NewRecorder()
	s.ServeContent(recorder, request, input.ID)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Empty(t, recorder.Body.Bytes())

	for range 2 {
		require.NoError(t, model.DB.AutoMigrate(&model.VideoInput{}, &model.VideoInputUse{}))
	}
	stored, err := model.GetVideoInput(context.Background(), input.ID, owner.Id)
	require.NoError(t, err)
	assert.Equal(t, input.SHA256, stored.SHA256, "repeated startup migration preserves existing assets")
}

func TestVideoInputRequestResolutionAndTaskRetention(t *testing.T) {
	s, data, owner := setupVideoInputTest(t)
	now := time.Now().Truncate(time.Second)
	input := reserveVideoInputTest(t, s, owner.Id, data, now)
	_, err := s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(data), now)
	require.NoError(t, err)
	engine := gin.New()
	userID := owner.Id
	engine.POST("/v1/videos", func(c *gin.Context) { c.Set("id", userID) }, middleware.ResolveVideoInputs(), func(c *gin.Context) {
		payload, readErr := io.ReadAll(c.Request.Body)
		require.NoError(t, readErr)
		assert.Equal(t, "grok-imagine-video-1.5", gjson.GetBytes(payload, "model").String())
		assert.EqualValues(t, 5, gjson.GetBytes(payload, "duration").Int())
		assert.False(t, gjson.GetBytes(payload, "generate_audio").Bool())
		assert.True(t, strings.HasPrefix(gjson.GetBytes(payload, "reference_images.0.url").String(), s.Config.PublicURL+"/v1/video-inputs/"))
		c.JSON(http.StatusOK, gin.H{"id": c.GetString(service.VideoInputTaskContextKey)})
	})
	body := `{"model":"grok-imagine-video-1.5","duration":5,"generate_audio":false,"reference_images":[{"url":"` + service.VideoInputPrefix + input.ID + `"}]}`
	request := httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	require.Equal(t, http.StatusOK, recorder.Code)
	taskID := gjson.GetBytes(recorder.Body.Bytes(), "id").String()
	require.NotEmpty(t, taskID)
	require.NoError(t, model.DB.Create(&model.Task{TaskID: taskID, UserId: owner.Id, Status: model.TaskStatusInProgress}).Error)
	count, err := s.Cleanup(context.Background(), now.Add(25*time.Hour))
	require.NoError(t, err)
	assert.Zero(t, count, "an unfinished task retains its original input")
	finish := now.Add(26 * time.Hour)
	require.NoError(t, model.DB.Model(&model.Task{}).Where("task_id = ?", taskID).Updates(map[string]any{"status": model.TaskStatusSuccess, "finish_time": finish.Unix()}).Error)
	count, err = s.Cleanup(context.Background(), now.Add(49*time.Hour))
	require.NoError(t, err)
	assert.Zero(t, count, "the grace period starts at actual task completion")

	userID = owner.Id + 1
	request = httptest.NewRequest(http.MethodPost, "/v1/videos", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	recorder = httptest.NewRecorder()
	engine.ServeHTTP(recorder, request)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)
	objects := s.Objects.(*videoInputTestObjects)
	objects.failRemove = true
	_, err = s.Cleanup(context.Background(), now.Add(51*time.Hour))
	require.Error(t, err)
	_, err = model.GetVideoInput(context.Background(), input.ID, owner.Id)
	require.NoError(t, err, "failed object deletion must retain the cleanup record")
	objects.failRemove = false
	count, err = s.Cleanup(context.Background(), now.Add(51*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 1, count)
	_, err = model.GetVideoInput(context.Background(), input.ID, owner.Id)
	assert.ErrorIs(t, err, model.ErrVideoInputUnavailable)
}

func TestVideoInputUploadValidationAndBudget(t *testing.T) {
	s, data, owner := setupVideoInputTest(t)
	now := time.Now()
	s.Config.UserBudget = int64(len(data))
	input := reserveVideoInputTest(t, s, owner.Id, data, now)
	digest := sha256.Sum256(data)
	_, err := s.Reserve(context.Background(), owner.Id, 11, int64(len(data)), hex.EncodeToString(digest[:]), "image/png", now)
	assert.ErrorIs(t, err, model.ErrVideoInputStorageFull)
	_, err = s.Reserve(context.Background(), owner.Id, 11, 12, hex.EncodeToString(digest[:]), "image/svg+xml", now)
	assert.ErrorContains(t, err, "PNG, JPEG or WebP")
	_, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(data), now.Add(25*time.Hour))
	assert.ErrorIs(t, err, model.ErrVideoInputUnavailable)
	count, err := s.Cleanup(context.Background(), now.Add(25*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 1, count, "abandoned reservations are reclaimed without an uploaded object")

	invalid := []byte("<html>not an image</html>")
	input = reserveVideoInputTest(t, s, owner.Id, invalid, now)
	_, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(invalid), now)
	assert.ErrorContains(t, err, "declared image format")
}

func TestVideoInputMigrationPreservesExistingTasks(t *testing.T) {
	db, _ := openTaskDialectDatabase(t, &model.User{}, &model.Token{}, &model.Task{})
	owner := model.User{Username: "existing-video-owner", AffCode: "existing-video-owner", Quota: 123456}
	require.NoError(t, db.Create(&owner).Error)
	task := model.Task{TaskID: "existing-video-task", UserId: owner.Id, Status: model.TaskStatusSuccess, Quota: 160000, FinishTime: 12345}
	require.NoError(t, db.Create(&task).Error)
	t.Cleanup(func() { require.NoError(t, db.Migrator().DropTable(&model.VideoInputUse{}, &model.VideoInput{})) })
	for range 2 {
		require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.Task{}, &model.VideoInput{}, &model.VideoInputUse{}))
	}
	var persisted model.Task
	require.NoError(t, db.Where("task_id = ?", task.TaskID).First(&persisted).Error)
	assert.Equal(t, task.ID, persisted.ID)
	assert.Equal(t, task.Status, persisted.Status)
	assert.Equal(t, task.Quota, persisted.Quota)
	var persistedOwner model.User
	require.NoError(t, db.First(&persistedOwner, owner.Id).Error)
	assert.Equal(t, owner.Quota, persistedOwner.Quota)
}

func TestVideoInputS3OriginalBytes(t *testing.T) {
	endpoint := os.Getenv("TEST_VIDEO_INPUT_S3_ENDPOINT")
	if endpoint == "" {
		t.Skip("TEST_VIDEO_INPUT_S3_ENDPOINT is not configured")
	}
	_, data, owner := setupVideoInputTest(t)
	access, secret := os.Getenv("TEST_VIDEO_INPUT_S3_ACCESS_KEY"), os.Getenv("TEST_VIDEO_INPUT_S3_SECRET_KEY")
	client, err := minio.New(strings.TrimPrefix(endpoint, "http://"), &minio.Options{Creds: credentials.NewStaticV4(access, secret, "")})
	require.NoError(t, err)
	bucket := "video-input-test-" + time.Now().Format("20060102150405")
	require.NoError(t, client.MakeBucket(context.Background(), bucket, minio.MakeBucketOptions{}))
	t.Cleanup(func() { require.NoError(t, client.RemoveBucket(context.Background(), bucket)) })
	for key, value := range map[string]string{
		"VIDEO_INPUTS_ENABLED": "true", "VIDEO_INPUT_PUBLIC_URL": "https://media.example.test",
		"VIDEO_INPUT_SIGNING_KEY":      strings.Repeat("test", 16),
		"VIDEO_INPUT_LINK_TTL_SECONDS": "3600", "VIDEO_INPUT_RETENTION_SECONDS": "86400", "VIDEO_INPUT_USER_BUDGET_BYTES": "10485760",
		"VIDEO_INPUT_S3_ENDPOINT": endpoint, "VIDEO_INPUT_S3_BUCKET": bucket, "VIDEO_INPUT_S3_ACCESS_KEY": access, "VIDEO_INPUT_S3_SECRET_KEY": secret,
	} {
		t.Setenv(key, value)
	}
	require.NoError(t, service.InitVideoInputs())
	s := service.VideoInputs
	now := time.Now()
	input := reserveVideoInputTest(t, s, owner.Id, data, now)
	_, err = s.Upload(context.Background(), input.ID, owner.Id, bytes.NewReader(data), now)
	require.NoError(t, err)
	object, err := s.Objects.Open(context.Background(), input.ObjectKey)
	require.NoError(t, err)
	stored, err := io.ReadAll(object)
	require.NoError(t, err)
	require.NoError(t, object.Close())
	assert.Equal(t, data, stored)
	w := httptest.NewRecorder()
	s.ServeContent(w, httptest.NewRequest(http.MethodGet, s.ContentURL(input.ID, now), nil), input.ID)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, data, w.Body.Bytes(), "signed delivery from the real S3 backend preserves original bytes")
	count, err := s.Cleanup(context.Background(), now.Add(25*time.Hour))
	require.NoError(t, err)
	assert.Equal(t, 1, count)
}
