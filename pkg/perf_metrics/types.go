package perfmetrics

import (
	"math"
	"sync"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

type Store interface {
	Record(sample Sample)
	Query(params QueryParams) (QueryResult, error)
}

type Sample struct {
	Model        string
	Group        string
	LatencyMs    int64
	TtftMs       int64
	HasTtft      bool
	Success      bool
	OutputTokens int64
	GenerationMs int64
	Input        relaycommon.PerformanceInputObservation
}

type QueryParams struct {
	Model string
	Group string
	Hours int
	// AllowedGroups restricts both the per-group results and the model summary;
	// nil allows every group.
	AllowedGroups []string
}

// Summary is the request-weighted aggregate over every bucket in the window.
type Summary struct {
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type BucketPoint struct {
	Ts           int64   `json:"ts"`
	AvgTtftMs    int64   `json:"avg_ttft_ms"`
	AvgLatencyMs int64   `json:"avg_latency_ms"`
	SuccessRate  float64 `json:"success_rate"`
	AvgTps       float64 `json:"avg_tps"`
}

type GroupResult struct {
	Group        string        `json:"group"`
	AvgTtftMs    int64         `json:"avg_ttft_ms"`
	AvgLatencyMs int64         `json:"avg_latency_ms"`
	SuccessRate  float64       `json:"success_rate"`
	AvgTps       float64       `json:"avg_tps"`
	Series       []BucketPoint `json:"series"`
}

type QueryResult struct {
	ModelName    string        `json:"model_name"`
	SeriesSchema string        `json:"series_schema"`
	Summary      *Summary      `json:"summary"`
	Series       []BucketPoint `json:"series"`
	WindowStart  int64         `json:"window_start"`
	WindowEnd    int64         `json:"window_end"`
	Groups       []GroupResult `json:"groups"`
}

type SuccessRatePoint struct {
	Ts          int64   `json:"ts"`
	SuccessRate float64 `json:"success_rate"`
}

type ModelSummary struct {
	ModelName           string             `json:"model_name"`
	AvgLatencyMs        int64              `json:"avg_latency_ms"`
	SuccessRate         float64            `json:"success_rate"`
	AvgTps              float64            `json:"avg_tps"`
	RecentSuccessSeries []SuccessRatePoint `json:"recent_success_series,omitempty"`
	RequestCount        int64              `json:"-"`
}

type SummaryAllResult struct {
	Summary     *Summary       `json:"summary"`
	WindowStart int64          `json:"window_start"`
	WindowEnd   int64          `json:"window_end"`
	Models      []ModelSummary `json:"models"`
}

type bucketKey struct {
	model    string
	group    string
	bucketTs int64
}

type counters struct {
	requestCount            int64
	successCount            int64
	totalLatencyMs          int64
	ttftSumMs               int64
	ttftCount               int64
	outputTokens            int64
	generationMs            int64
	inputTokens             int64
	cachedInputTokens       int64
	codingInputTokens       int64
	codingCachedInputTokens int64
	codingCostInputTokens   int64
	codingInputCost         float64
	codingCache0Cost        float64
	codingCache100Cost      float64
}

// atomicBucket snapshots and drains whole samples atomically. A single lock
// keeps fractional input costs and their token weights in the same flush.
type atomicBucket struct {
	mu    sync.Mutex
	value counters
}

func (b *atomicBucket) add(sample Sample) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.value.addSample(sample)
}

func (c *counters) addSample(sample Sample) {
	c.requestCount++
	if sample.Success {
		c.successCount++
	}
	if sample.LatencyMs > 0 {
		c.totalLatencyMs += sample.LatencyMs
	}
	if sample.HasTtft && sample.TtftMs >= 0 {
		c.ttftSumMs += sample.TtftMs
		c.ttftCount++
	}
	if sample.OutputTokens > 0 && sample.GenerationMs > 0 {
		c.outputTokens += sample.OutputTokens
		c.generationMs += sample.GenerationMs
	}
	observation := sample.Input
	if !sample.Success || observation.InputTokens <= 0 || observation.CachedTokens < 0 || observation.CachedTokens > observation.InputTokens {
		return
	}
	c.inputTokens += observation.InputTokens
	c.cachedInputTokens += observation.CachedTokens
	if !observation.Coding {
		return
	}
	c.codingInputTokens += observation.InputTokens
	c.codingCachedInputTokens += observation.CachedTokens
	if !observation.CostObserved {
		return
	}
	for _, cost := range []float64{observation.InputCost, observation.Cache0Cost, observation.Cache100Cost} {
		if cost < 0 || math.IsNaN(cost) || math.IsInf(cost, 0) {
			return
		}
	}
	c.codingCostInputTokens += observation.InputTokens
	c.codingInputCost += observation.InputCost
	c.codingCache0Cost += observation.Cache0Cost
	c.codingCache100Cost += observation.Cache100Cost
}

func (b *atomicBucket) snapshot() counters {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.value
}

func (b *atomicBucket) drain() counters {
	b.mu.Lock()
	defer b.mu.Unlock()
	value := b.value
	b.value = counters{}
	return value
}

func (b *atomicBucket) addCounters(c counters) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.value.add(c)
}

func (c *counters) add(value counters) {
	c.requestCount += value.requestCount
	c.successCount += value.successCount
	c.totalLatencyMs += value.totalLatencyMs
	c.ttftSumMs += value.ttftSumMs
	c.ttftCount += value.ttftCount
	c.outputTokens += value.outputTokens
	c.generationMs += value.generationMs
	c.inputTokens += value.inputTokens
	c.cachedInputTokens += value.cachedInputTokens
	c.codingInputTokens += value.codingInputTokens
	c.codingCachedInputTokens += value.codingCachedInputTokens
	c.codingCostInputTokens += value.codingCostInputTokens
	c.codingInputCost += value.codingInputCost
	c.codingCache0Cost += value.codingCache0Cost
	c.codingCache100Cost += value.codingCache100Cost
}
