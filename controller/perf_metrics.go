package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	perfmetrics "github.com/QuantumNous/new-api/pkg/perf_metrics"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func GetPerfMetricsGroups(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		parsed, err := strconv.Atoi(rawHours)
		if err != nil || (parsed != 1 && parsed != 24 && parsed != 168) {
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "hours must be 1, 24, or 168"})
			return
		}
		hours = parsed
	}

	// The dashboard exposes request counts, unlike the public model summary.
	// Its route requires UserAuth and ordinary users only see selectable groups.
	if c.GetInt("id") <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "authentication required"})
		return
	}
	ratios := ratio_setting.GetGroupRatioCopy()
	groupDescriptions := setting.GetUserUsableGroupsCopy()
	if c.GetInt("role") < common.RoleAdminUser {
		groupDescriptions = service.GetUserUsableGroups(c.GetString("user_group"))
		for group := range ratios {
			if _, allowed := groupDescriptions[group]; !allowed {
				delete(ratios, group)
			}
		}
	}
	result, err := perfmetrics.QueryGroups(hours, lo.Keys(ratios))
	if err != nil {
		common.SysError("failed to query performance groups: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "failed to query performance metrics"})
		return
	}
	for i := range result.Groups {
		group := &result.Groups[i]
		group.Description = groupDescriptions[group.Group]
		group.Ratio = ratios[group.Group]
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func GetPerfMetricsSummary(c *gin.Context) {
	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	activeGroups := append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto")
	result, err := perfmetrics.QuerySummaryAll(hours, activeGroups)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}

func GetPerfMetrics(c *gin.Context) {
	modelName := c.Query("model")
	if modelName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "model is required",
		})
		return
	}

	hours := 24
	if rawHours := c.Query("hours"); rawHours != "" {
		if parsed, err := strconv.Atoi(rawHours); err == nil {
			hours = parsed
		}
	}

	result, err := perfmetrics.Query(perfmetrics.QueryParams{
		Model:         modelName,
		Group:         c.Query("group"),
		Hours:         hours,
		AllowedGroups: append(lo.Keys(ratio_setting.GetGroupRatioCopy()), "auto"),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    result,
	})
}
