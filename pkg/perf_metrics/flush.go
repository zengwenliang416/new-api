package perfmetrics

import (
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/perf_metrics_setting"
)

func flushLoop() {
	for {
		interval := perf_metrics_setting.GetFlushIntervalMinutes()
		time.Sleep(time.Duration(interval) * time.Minute)
		setting := perf_metrics_setting.GetSetting()
		if !setting.Enabled {
			continue
		}
		flushCompletedBuckets()
		cleanupExpiredMetrics(setting.RetentionDays)
	}
}

func flushCompletedBuckets() {
	bucketFlushMu.Lock()
	defer bucketFlushMu.Unlock()
	currentBucket := bucketStart(time.Now().Unix())
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs >= currentBucket {
			return true
		}

		bucket := value.(*atomicBucket)
		drained := bucket.drain()
		if drained.requestCount == 0 {
			deleteOldEmptyBucket(k, key)
			return true
		}

		err := model.UpsertPerfMetric(&model.PerfMetric{
			ModelName:               k.model,
			Group:                   k.group,
			BucketTs:                k.bucketTs,
			RequestCount:            drained.requestCount,
			SuccessCount:            drained.successCount,
			TotalLatencyMs:          drained.totalLatencyMs,
			TtftSumMs:               drained.ttftSumMs,
			TtftCount:               drained.ttftCount,
			OutputTokens:            drained.outputTokens,
			GenerationMs:            drained.generationMs,
			InputTokens:             drained.inputTokens,
			CachedInputTokens:       drained.cachedInputTokens,
			CodingInputTokens:       drained.codingInputTokens,
			CodingCachedInputTokens: drained.codingCachedInputTokens,
			CodingCostInputTokens:   drained.codingCostInputTokens,
			CodingInputCost:         drained.codingInputCost,
			CodingCache0Cost:        drained.codingCache0Cost,
			CodingCache100Cost:      drained.codingCache100Cost,
		})
		if err != nil {
			bucket.addCounters(drained)
			common.SysError(fmt.Sprintf("failed to flush perf metric bucket model=%s group=%s bucket=%d: %s", k.model, k.group, k.bucketTs, err.Error()))
			return true
		}

		deleteOldEmptyBucket(k, key)
		return true
	})
}

func deleteOldEmptyBucket(k bucketKey, rawKey any) {
	if k.bucketTs < bucketStart(time.Now().Add(-24*time.Hour).Unix()) {
		hotBuckets.Delete(rawKey)
	}
}

func cleanupExpiredMetrics(retentionDays int) {
	if retentionDays <= 0 {
		return
	}
	cutoff := time.Now().Add(-time.Duration(retentionDays) * 24 * time.Hour).Unix()
	if err := model.DeletePerfMetricsBefore(cutoff); err != nil {
		common.SysError("failed to cleanup expired perf metrics: " + err.Error())
	}
}

func redisCounters(values map[string]string) counters {
	return counters{
		requestCount:            parseRedisInt(values["req"]),
		successCount:            parseRedisInt(values["ok"]),
		totalLatencyMs:          parseRedisInt(values["lat"]),
		ttftSumMs:               parseRedisInt(values["ttft"]),
		ttftCount:               parseRedisInt(values["ttft_n"]),
		outputTokens:            parseRedisInt(values["out"]),
		generationMs:            parseRedisInt(values["gen_ms"]),
		inputTokens:             parseRedisInt(values["input_tokens"]),
		cachedInputTokens:       parseRedisInt(values["cached_input_tokens"]),
		codingInputTokens:       parseRedisInt(values["coding_input_tokens"]),
		codingCachedInputTokens: parseRedisInt(values["coding_cached_input_tokens"]),
		codingCostInputTokens:   parseRedisInt(values["coding_cost_input_tokens"]),
		codingInputCost:         parseRedisFloat(values["coding_input_cost"]),
		codingCache0Cost:        parseRedisFloat(values["coding_cache0_cost"]),
		codingCache100Cost:      parseRedisFloat(values["coding_cache100_cost"]),
	}
}

func parseRedisInt(value string) int64 {
	if value == "" {
		return 0
	}
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func parseRedisFloat(value string) float64 {
	parsed, _ := strconv.ParseFloat(value, 64)
	if math.IsNaN(parsed) || math.IsInf(parsed, 0) || parsed < 0 {
		return 0
	}
	return parsed
}
