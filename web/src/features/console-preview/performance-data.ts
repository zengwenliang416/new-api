/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

export interface PerformanceMetrics {
  request_count: number
  success_count?: number
  success_rate: number
  avg_latency_ms: number
  avg_ttft_ms: number
  avg_tps: number
  cache_observed: boolean
  cache_hit_rate: number
  coding_cache_observed: boolean
  coding_cache_hit_rate: number
}

export interface PerformanceModel extends PerformanceMetrics {
  model_name: string
  coding_input_weight: number
  coding_cost_observed: boolean
  coding_cost_input_weight: number
  coding_observed_input_price: number
  coding_cache0_input_price: number
  coding_cache100_input_price: number
}

export interface PerformanceBucket {
  ts: number
  request_count: number
  success_rate: number
  avg_latency_ms: number
}

export interface PerformanceGroup extends PerformanceMetrics {
  success_count: number
  group: string
  name: string
  description: string
  ratio: number
  series: PerformanceBucket[]
  models: PerformanceModel[]
}

export interface PerformanceSnapshot {
  start_ts: number
  end_ts: number
  bucket_seconds: number
  groups: PerformanceGroup[]
}

export async function getPerformanceGroups(
  hours: number,
  lang: string,
  signal?: AbortSignal
): Promise<PerformanceSnapshot> {
  const response = await api.get<{
    success: boolean
    message?: string
    data: PerformanceSnapshot
  }>('/api/perf-metrics/groups', {
    params: { hours, lang },
    signal,
    disableDuplicate: true,
  })
  return requireServerSuccess(response.data).data
}

export function performanceStatus(requests: number, successRate: number) {
  if (requests <= 0) return 'nodata'
  if (successRate >= 90) return 'operational'
  if (successRate >= 70) return 'degraded'
  return 'unavailable'
}

/** Merge adjacent buckets using request weights, never averaging percentages. */
export function compactPerformanceSeries(
  series: PerformanceBucket[],
  maxBuckets = 48
): PerformanceBucket[] {
  if (series.length <= maxBuckets) return series
  const result: PerformanceBucket[] = []
  for (let index = 0; index < maxBuckets; index++) {
    const start = Math.floor((index * series.length) / maxBuckets)
    const end = Math.floor(((index + 1) * series.length) / maxBuckets)
    let requests = 0
    let successes = 0
    let latency = 0
    for (const bucket of series.slice(start, end)) {
      requests += bucket.request_count
      successes += Math.round(
        (bucket.success_rate / 100) * bucket.request_count
      )
      latency += bucket.avg_latency_ms * bucket.request_count
    }
    result.push({
      ts: series[start].ts,
      request_count: requests,
      success_rate:
        requests > 0 ? Math.round((successes / requests) * 10000) / 100 : 0,
      avg_latency_ms: requests > 0 ? Math.round(latency / requests) : 0,
    })
  }
  return result
}

/** Display-only comparison of observed coding input cost with reference prices. */
export function codingInputMultipliers(
  models: PerformanceModel[],
  referenceRate: number
) {
  let inputWeight = 0
  let costWeight = 0
  let observedCost = 0
  let uncachedCost = 0
  let referenceCost = 0
  for (const model of models) {
    const weight = model.coding_input_weight
    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 1 ||
      !model.coding_cache_observed ||
      !Number.isFinite(model.coding_cache_hit_rate) ||
      model.coding_cache_hit_rate < 0 ||
      model.coding_cache_hit_rate > 100
    ) {
      continue
    }
    inputWeight += weight
    const cost = model.coding_cost_input_weight
    const actual = model.coding_observed_input_price
    const uncached = model.coding_cache0_input_price
    const cached = model.coding_cache100_input_price
    if (
      !model.coding_cost_observed ||
      !Number.isFinite(cost) ||
      cost <= 0 ||
      cost > weight + 1e-12 ||
      !Number.isFinite(actual) ||
      actual < 0 ||
      !Number.isFinite(uncached) ||
      uncached < 0 ||
      !Number.isFinite(cached) ||
      cached < 0
    ) {
      continue
    }
    costWeight += cost
    observedCost += cost * actual
    uncachedCost += cost * uncached
    referenceCost +=
      cost *
      ((1 - referenceRate / 100) * uncached + (referenceRate / 100) * cached)
  }
  if (
    inputWeight <= 0 ||
    costWeight / inputWeight < 0.9 ||
    !Number.isFinite(referenceRate) ||
    referenceRate < 0 ||
    referenceRate > 99.9
  ) {
    return { input: null, reference: null }
  }
  return {
    input: uncachedCost > 0 ? observedCost / uncachedCost : null,
    reference: referenceCost > 0 ? observedCost / referenceCost : null,
  }
}
