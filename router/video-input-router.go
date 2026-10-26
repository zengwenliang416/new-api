package router

import (
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/gin-gonic/gin"
)

func SetVideoInputRouter(router *gin.Engine) {
	inputs := router.Group("/v1/video-inputs", middleware.RouteTag("video-input"))
	// A short-lived, object-bound signature authorizes upstream GET/HEAD only.
	inputs.GET("/:id/content", middleware.VideoInputAccess(), controller.VideoInputContent)
	inputs.HEAD("/:id/content", middleware.VideoInputAccess(), controller.VideoInputContent)
	inputs.Use(middleware.TokenAuth(), middleware.SystemPerformanceCheck(), middleware.GlobalAPIRateLimit())
	inputs.GET("/capabilities", controller.VideoInputCapabilities)
	inputs.POST("", middleware.UploadRateLimit(), controller.CreateVideoInput)
	inputs.PUT("/:id/content", controller.UploadVideoInput)
}
