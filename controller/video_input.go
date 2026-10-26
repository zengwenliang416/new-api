package controller

import (
	"errors"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func VideoInputCapabilities(c *gin.Context) {
	s := service.VideoInputs
	if s == nil {
		c.JSON(http.StatusOK, gin.H{"enabled": false})
		return
	}
	c.JSON(http.StatusOK, gin.H{"enabled": true, "max_bytes": s.Config.MaxBytes, "retention_seconds": int64(s.Config.Retention / time.Second), "formats": []string{"image/jpeg", "image/png", "image/webp"}})
}

func CreateVideoInput(c *gin.Context) {
	s := service.VideoInputs
	if s == nil {
		videoInputError(c, http.StatusServiceUnavailable, "原图暂存服务尚未启用")
		return
	}
	var request struct {
		Bytes       int64  `json:"bytes"`
		SHA256      string `json:"sha256"`
		ContentType string `json:"content_type"`
	}
	if err := common.DecodeJson(http.MaxBytesReader(c.Writer, c.Request.Body, 4096), &request); err != nil {
		videoInputError(c, http.StatusBadRequest, "参考图上传信息无效")
		return
	}
	input, err := s.Reserve(c.Request.Context(), c.GetInt("id"), c.GetInt("token_id"), request.Bytes, request.SHA256, request.ContentType, time.Now())
	if err != nil {
		status := http.StatusBadRequest
		message := "无法准备原图上传，请检查文件格式、大小或存储配置"
		if errors.Is(err, model.ErrVideoInputStorageFull) {
			status = http.StatusInsufficientStorage
			message = "临时参考图容量已满，请等待旧素材清理或联系管理员；未提交视频生成"
		}
		videoInputError(c, status, message)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"input": input, "upload_path": "/v1/video-inputs/" + input.ID + "/content"})
}

func UploadVideoInput(c *gin.Context) {
	s := service.VideoInputs
	if s == nil {
		videoInputError(c, http.StatusServiceUnavailable, "原图暂存服务尚未启用")
		return
	}
	input, err := s.Upload(c.Request.Context(), c.Param("id"), c.GetInt("id"), c.Request.Body, time.Now())
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, model.ErrVideoInputUnavailable) {
			status = http.StatusNotFound
		}
		videoInputError(c, status, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{"input": input, "reference": service.VideoInputPrefix + input.ID})
}

func VideoInputContent(c *gin.Context) {
	if service.VideoInputs == nil {
		c.Status(http.StatusNotFound)
		return
	}
	service.VideoInputs.ServeContent(c.Writer, c.Request, c.Param("id"))
}

func videoInputError(c *gin.Context, status int, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": gin.H{"code": "video_input_unavailable", "message": message}})
}
