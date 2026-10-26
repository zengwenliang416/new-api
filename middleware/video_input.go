package middleware

import (
	"bytes"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

// Reuse the existing anonymous artifact limits for signed input reads.
func VideoInputAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		s := service.VideoInputs
		if s == nil || !s.VerifyContentAccess(c.Param("id"), c.Query("expires"), c.Query("signature"), time.Now()) {
			if !taskArtifactAnonymousLimiter.invalidAttempt(time.Now(), c.ClientIP()) {
				writeTaskArtifactAccessLimited(c)
				return
			}
			writeTaskArtifactAccessNotFound(c)
			return
		}
		release, ok := taskArtifactAnonymousLimiter.acquire(c.ClientIP(), "video-input", c.Param("id"))
		if !ok {
			writeTaskArtifactAccessLimited(c)
			return
		}
		defer release()
		c.Next()
	}
}

// ResolveVideoInputs runs before the video protocol parser. Only explicit
// gateway references are replaced; ordinary URL/data inputs are unchanged.
func ResolveVideoInputs() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.ContentType(), "application/json") {
			c.Next()
			return
		}
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			status := http.StatusBadRequest
			if common.IsRequestBodyTooLargeError(err) {
				status = http.StatusRequestEntityTooLarge
			}
			c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"message": "无法读取视频请求，请检查请求体大小"}})
			return
		}
		payload, err := io.ReadAll(storage)
		_, _ = storage.Seek(0, io.SeekStart)
		if err != nil || !gjson.ValidBytes(payload) {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"message": "视频请求必须为有效 JSON"}})
			return
		}
		paths := []string{"image", "image.url", "last_frame", "last_frame.url"}
		for index := range gjson.GetBytes(payload, "reference_images").Array() {
			paths = append(paths, "reference_images."+strconv.Itoa(index), "reference_images."+strconv.Itoa(index)+".url")
		}
		ids := make([]string, 0)
		references := make(map[string]string)
		for _, path := range paths {
			value := gjson.GetBytes(payload, path)
			if value.Type != gjson.String || !strings.HasPrefix(value.String(), service.VideoInputPrefix) {
				continue
			}
			id := strings.TrimPrefix(value.String(), service.VideoInputPrefix)
			ids = append(ids, id)
			references[path] = id
		}
		if len(ids) == 0 {
			c.Next()
			return
		}
		s := service.VideoInputs
		if s == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": gin.H{"message": "原图暂存服务尚未启用"}})
			return
		}
		now, taskID := time.Now(), model.GenerateTaskID()
		if _, err := model.ClaimVideoInputs(c.Request.Context(), ids, c.GetInt("id"), taskID, now.Unix(), now.Add(s.Config.Retention).Unix()); err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": gin.H{"code": "video_input_unavailable", "message": "参考图不可用或已过期，请重新上传原图"}})
			return
		}
		for path, id := range references {
			payload, err = sjson.SetBytes(payload, path, s.ContentURL(id, now))
			if err != nil {
				c.AbortWithStatus(http.StatusInternalServerError)
				return
			}
		}
		common.CleanupBodyStorage(c)
		c.Set(common.KeyRequestBody, payload)
		c.Request.Body = io.NopCloser(bytes.NewReader(payload))
		c.Request.ContentLength = int64(len(payload))
		c.Set(service.VideoInputTaskContextKey, taskID)
		c.Next()
	}
}
