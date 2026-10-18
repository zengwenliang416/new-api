package perfmetrics

import (
	"cmp"
	"slices"
	"time"

	"github.com/QuantumNous/new-api/model"
)

type OverviewMetrics struct {
	RequestCount             int64   `json:"request_count"`
	SuccessCount             int64   `json:"success_count"`
	SuccessRate              float64 `json:"success_rate"`
	AvgLatencyMs             int64   `json:"avg_latency_ms"`
	AvgTtftMs                int64   `json:"avg_ttft_ms"`
	AvgTps                   float64 `json:"avg_tps"`
	CacheObserved            bool    `json:"cache_observed"`
	CacheHitRate             float64 `json:"cache_hit_rate"`
	CodingCacheObserved      bool    `json:"coding_cache_observed"`
	CodingCacheHitRate       float64 `json:"coding_cache_hit_rate"`
	CodingInputWeight        float64 `json:"coding_input_weight"`
	CodingCostObserved       bool    `json:"coding_cost_observed"`
	CodingCostInputWeight    float64 `json:"coding_cost_input_weight"`
	CodingObservedInputPrice float64 `json:"coding_observed_input_price"`
	CodingCache0InputPrice   float64 `json:"coding_cache0_input_price"`
	CodingCache100InputPrice float64 `json:"coding_cache100_input_price"`
}

type GroupOverviewPoint struct {
	Ts int64 `json:"ts"`
	OverviewMetrics
}

type GroupModelOverview struct {
	ModelName string `json:"model_name"`
	OverviewMetrics
}

type GroupOverview struct {
	Group       string               `json:"group"`
	Name        string               `json:"name"`
	Description string               `json:"description"`
	Ratio       float64              `json:"ratio"`
	Series      []GroupOverviewPoint `json:"series"`
	Models      []GroupModelOverview `json:"models"`
	OverviewMetrics
}

type GroupsQueryResult struct {
	StartTs       int64           `json:"start_ts"`
	EndTs         int64           `json:"end_ts"`
	BucketSeconds int64           `json:"bucket_seconds"`
	Groups        []GroupOverview `json:"groups"`
}

// QueryGroups uses hourly output buckets, matching the existing summary query.
// Smaller persisted buckets are combined using their counters, never by
// averaging percentages or per-request token speeds. Missing hours remain empty
// observations (request_count=0), rather than outages.
func QueryGroups(hours int, groups []string) (GroupsQueryResult, error) {
	bucketFlushMu.RLock()
	defer bucketFlushMu.RUnlock()
	startTs, endTs := queryWindow(time.Now(), hours)
	allowedGroups := allowedGroupSet(groups)
	rows, err := model.GetPerfMetricsGroupBuckets(startTs, endTs, groups)
	if err != nil {
		return GroupsQueryResult{}, err
	}

	merged := make(map[bucketKey]counters, len(rows))
	for _, row := range rows {
		mergeCounters(merged, bucketKey{model: row.ModelName, group: row.Group, bucketTs: row.BucketTs}, counters{
			requestCount:            row.RequestCount,
			successCount:            row.SuccessCount,
			totalLatencyMs:          row.TotalLatencyMs,
			ttftSumMs:               row.TtftSumMs,
			ttftCount:               row.TtftCount,
			outputTokens:            row.OutputTokens,
			generationMs:            row.GenerationMs,
			inputTokens:             row.InputTokens,
			cachedInputTokens:       row.CachedInputTokens,
			codingInputTokens:       row.CodingInputTokens,
			codingCachedInputTokens: row.CodingCachedInputTokens,
			codingCostInputTokens:   row.CodingCostInputTokens,
			codingInputCost:         row.CodingInputCost,
			codingCache0Cost:        row.CodingCache0Cost,
			codingCache100Cost:      row.CodingCache100Cost,
		})
	}
	hotBuckets.Range(func(key, value any) bool {
		k := key.(bucketKey)
		if k.bucketTs < startTs || k.bucketTs > endTs {
			return true
		}
		if allowedGroups != nil {
			if _, allowed := allowedGroups[k.group]; !allowed {
				return true
			}
		}
		mergeCounters(merged, k, value.(*atomicBucket).snapshot())
		return true
	})

	groupTotals := make(map[string]counters)
	groupBuckets := make(map[string]map[int64]counters)
	groupModels := make(map[string]map[string]counters)
	for _, group := range groups {
		groupTotals[group] = counters{}
	}
	for key, value := range merged {
		mergeModelTotals(groupTotals, key.group, value)
		mergeModelBucket(groupBuckets, key.group, key.bucketTs-key.bucketTs%3600, value)
		if groupModels[key.group] == nil {
			groupModels[key.group] = make(map[string]counters)
		}
		mergeModelTotals(groupModels[key.group], key.model, value)
	}

	result := GroupsQueryResult{
		StartTs: startTs, EndTs: endTs, BucketSeconds: 3600,
		Groups: make([]GroupOverview, 0, len(groupTotals)),
	}
	for group, total := range groupTotals {
		entry := GroupOverview{
			Group: group, Name: group,
			OverviewMetrics: overviewMetrics(total),
			Series:          make([]GroupOverviewPoint, 0, (endTs-startTs)/3600+1),
			Models:          make([]GroupModelOverview, 0, len(groupModels[group])),
		}
		for ts := startTs; ts <= endTs; ts += 3600 {
			entry.Series = append(entry.Series, GroupOverviewPoint{
				Ts: ts, OverviewMetrics: overviewMetrics(groupBuckets[group][ts]),
			})
		}
		for name, value := range groupModels[group] {
			metrics := overviewMetrics(value)
			if total.codingInputTokens > 0 {
				metrics.CodingInputWeight = float64(value.codingInputTokens) / float64(total.codingInputTokens)
				metrics.CodingCostInputWeight = float64(value.codingCostInputTokens) / float64(total.codingInputTokens)
			}
			entry.Models = append(entry.Models, GroupModelOverview{
				ModelName: name, OverviewMetrics: metrics,
			})
		}
		slices.SortFunc(entry.Models, func(a, b GroupModelOverview) int {
			return cmp.Or(cmp.Compare(b.RequestCount, a.RequestCount), cmp.Compare(a.ModelName, b.ModelName))
		})
		result.Groups = append(result.Groups, entry)
	}
	slices.SortFunc(result.Groups, func(a, b GroupOverview) int { return cmp.Compare(a.Group, b.Group) })
	return result, nil
}

func overviewMetrics(total counters) OverviewMetrics {
	result := OverviewMetrics{
		RequestCount:        total.requestCount,
		SuccessCount:        total.successCount,
		SuccessRate:         successRate(total),
		AvgLatencyMs:        avg(total.totalLatencyMs, total.requestCount),
		AvgTtftMs:           avg(total.ttftSumMs, total.ttftCount),
		AvgTps:              avgTps(total),
		CacheObserved:       total.inputTokens > 0,
		CodingCacheObserved: total.codingInputTokens > 0,
		CodingCostObserved:  total.codingCostInputTokens > 0,
	}
	if result.CacheObserved {
		result.CacheHitRate = 100 * float64(total.cachedInputTokens) / float64(total.inputTokens)
	}
	if result.CodingCacheObserved {
		result.CodingCacheHitRate = 100 * float64(total.codingCachedInputTokens) / float64(total.codingInputTokens)
		result.CodingInputWeight = 1
		result.CodingCostInputWeight = float64(total.codingCostInputTokens) / float64(total.codingInputTokens)
	}
	if result.CodingCostObserved {
		// USD per million input tokens. Only the supported cost subset contributes
		// to the denominator, and the UI separately checks its coverage.
		scale := 1e6 / float64(total.codingCostInputTokens)
		result.CodingObservedInputPrice = total.codingInputCost * scale
		result.CodingCache0InputPrice = total.codingCache0Cost * scale
		result.CodingCache100InputPrice = total.codingCache100Cost * scale
	}
	return result
}
