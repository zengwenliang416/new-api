package model

import (
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// PerfMetric stores aggregated relay performance metrics for the model square.
type PerfMetric struct {
	Id                      int     `json:"id" gorm:"primaryKey"`
	ModelName               string  `json:"model_name" gorm:"size:128;uniqueIndex:idx_perf_model_group_bucket,priority:1"`
	Group                   string  `json:"group" gorm:"column:group;size:64;uniqueIndex:idx_perf_model_group_bucket,priority:2"`
	BucketTs                int64   `json:"bucket_ts" gorm:"uniqueIndex:idx_perf_model_group_bucket,priority:3;index:idx_perf_bucket_ts"`
	RequestCount            int64   `json:"-" gorm:"default:0"`
	SuccessCount            int64   `json:"-" gorm:"default:0"`
	TotalLatencyMs          int64   `json:"-" gorm:"default:0"`
	TtftSumMs               int64   `json:"-" gorm:"default:0"`
	TtftCount               int64   `json:"-" gorm:"default:0"`
	OutputTokens            int64   `json:"-" gorm:"default:0"`
	GenerationMs            int64   `json:"-" gorm:"default:0"`
	InputTokens             int64   `json:"-" gorm:"default:0"`
	CachedInputTokens       int64   `json:"-" gorm:"default:0"`
	CodingInputTokens       int64   `json:"-" gorm:"default:0"`
	CodingCachedInputTokens int64   `json:"-" gorm:"default:0"`
	CodingCostInputTokens   int64   `json:"-" gorm:"default:0"`
	CodingInputCost         float64 `json:"-" gorm:"default:0"`
	CodingCache0Cost        float64 `json:"-" gorm:"default:0"`
	CodingCache100Cost      float64 `json:"-" gorm:"default:0"`
}

func (PerfMetric) TableName() string {
	return "perf_metrics"
}

func UpsertPerfMetric(metric *PerfMetric) error {
	if metric == nil || metric.RequestCount == 0 {
		return nil
	}
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{
			{Name: "model_name"},
			{Name: "group"},
			{Name: "bucket_ts"},
		},
		DoUpdates: clause.Assignments(map[string]any{
			"request_count":              gorm.Expr("perf_metrics.request_count + ?", metric.RequestCount),
			"success_count":              gorm.Expr("perf_metrics.success_count + ?", metric.SuccessCount),
			"total_latency_ms":           gorm.Expr("perf_metrics.total_latency_ms + ?", metric.TotalLatencyMs),
			"ttft_sum_ms":                gorm.Expr("perf_metrics.ttft_sum_ms + ?", metric.TtftSumMs),
			"ttft_count":                 gorm.Expr("perf_metrics.ttft_count + ?", metric.TtftCount),
			"output_tokens":              gorm.Expr("perf_metrics.output_tokens + ?", metric.OutputTokens),
			"generation_ms":              gorm.Expr("perf_metrics.generation_ms + ?", metric.GenerationMs),
			"input_tokens":               gorm.Expr("perf_metrics.input_tokens + ?", metric.InputTokens),
			"cached_input_tokens":        gorm.Expr("perf_metrics.cached_input_tokens + ?", metric.CachedInputTokens),
			"coding_input_tokens":        gorm.Expr("perf_metrics.coding_input_tokens + ?", metric.CodingInputTokens),
			"coding_cached_input_tokens": gorm.Expr("perf_metrics.coding_cached_input_tokens + ?", metric.CodingCachedInputTokens),
			"coding_cost_input_tokens":   gorm.Expr("perf_metrics.coding_cost_input_tokens + ?", metric.CodingCostInputTokens),
			"coding_input_cost":          gorm.Expr("perf_metrics.coding_input_cost + ?", metric.CodingInputCost),
			"coding_cache0_cost":         gorm.Expr("perf_metrics.coding_cache0_cost + ?", metric.CodingCache0Cost),
			"coding_cache100_cost":       gorm.Expr("perf_metrics.coding_cache100_cost + ?", metric.CodingCache100Cost),
		}),
	}).Create(metric).Error
}

func GetPerfMetrics(modelName string, group string, startTs int64, endTs int64) ([]PerfMetric, error) {
	var metrics []PerfMetric
	query := DB.Model(&PerfMetric{}).
		Where("model_name = ? AND bucket_ts >= ? AND bucket_ts <= ?", modelName, startTs, endTs)
	if group != "" {
		query = query.Where(commonGroupCol+" = ?", group)
	}
	err := query.Order("bucket_ts ASC").Find(&metrics).Error
	return metrics, err
}

// GetPerfMetricsGroupBuckets returns the persisted model/group counters used by
// the group dashboard. A non-nil empty groups slice deliberately returns no data.
func GetPerfMetricsGroupBuckets(startTs, endTs int64, groups []string) ([]PerfMetric, error) {
	metrics := make([]PerfMetric, 0)
	if groups != nil && len(groups) == 0 {
		return metrics, nil
	}
	query := DB.Model(&PerfMetric{}).
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.Order("bucket_ts ASC").Find(&metrics).Error
	return metrics, err
}

type PerfMetricSummary struct {
	ModelName      string `json:"model_name"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

type PerfMetricSummaryBucket struct {
	ModelName      string `json:"model_name"`
	BucketTs       int64  `json:"bucket_ts"`
	RequestCount   int64  `json:"request_count"`
	SuccessCount   int64  `json:"success_count"`
	TotalLatencyMs int64  `json:"total_latency_ms"`
	OutputTokens   int64  `json:"output_tokens"`
	GenerationMs   int64  `json:"generation_ms"`
}

func GetPerfMetricsSummaryAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummary, error) {
	var summaries []PerfMetricSummary
	query := DB.Model(&PerfMetric{}).
		Select("model_name, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name").
		Having("SUM(request_count) > 0").
		Find(&summaries).Error
	return summaries, err
}

func GetPerfMetricsSummaryBucketsAll(startTs int64, endTs int64, groups []string) ([]PerfMetricSummaryBucket, error) {
	var summaries []PerfMetricSummaryBucket
	query := DB.Model(&PerfMetric{}).
		Select("model_name, bucket_ts, SUM(request_count) as request_count, SUM(success_count) as success_count, SUM(total_latency_ms) as total_latency_ms, SUM(output_tokens) as output_tokens, SUM(generation_ms) as generation_ms").
		Where("bucket_ts >= ? AND bucket_ts <= ?", startTs, endTs)
	if groups != nil {
		if len(groups) == 0 {
			return summaries, nil
		}
		query = query.Where(commonGroupCol+" IN ?", groups)
	}
	err := query.
		Group("model_name, bucket_ts").
		Having("SUM(request_count) > 0").
		Order("bucket_ts ASC").
		Find(&summaries).Error
	return summaries, err
}

func DeletePerfMetricsBefore(cutoffTs int64) error {
	if cutoffTs <= 0 {
		return nil
	}
	return DB.Where("bucket_ts < ?", cutoffTs).Delete(&PerfMetric{}).Error
}

func PerfMetricStartTime(hours int) int64 {
	if hours <= 0 {
		hours = 24
	}
	return time.Now().Add(-time.Duration(hours) * time.Hour).Unix()
}
