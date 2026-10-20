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
export type ProbeKind = 'math' | 'drawing'
export type ProbeStatus = 'running' | 'pass' | 'fail' | 'error'

export interface ProbeSlot {
  ts: number
  run_id?: number
  status?: ProbeStatus
  started_at?: number
  latency_ms?: number
  has_artifact?: boolean
  answer?: string
  vehicle?: string
  scene?: string
  error_kind?: string
}

export interface ProbeStats {
  pass: number
  fail: number
  error: number
  total: number
  pass_rate: number
  avg_latency_ms: number
  latest?: ProbeSlot | null
  latest_pass?: ProbeSlot | null
  slots: ProbeSlot[]
}

export interface ProbeTarget {
  group: string
  group_name: string
  group_description: string
  group_ratio: number
  model: string
  effort: string
  kinds: ProbeKind[]
  math: ProbeStats
  drawing: ProbeStats
}

export interface ProbeOverview {
  execution?: {
    status: string
    updated_at: number
    readiness_error?: string
    summary?: { pass: number; fail: number; error: number; skipped: number }
  }
  enabled: boolean
  targets: ProbeTarget[]
  server_now: number
  next_run_ts: number
  interval_seconds: number
  math_answer: string
  drawing_catalog: { vehicles: string[]; scenes: string[] }
}

export interface ProbeRun {
  id: number
  kind: ProbeKind
  group: string
  group_name: string
  model: string
  status: ProbeStatus
  started_at: number
  latency_ms: number
  first_token_ms: number
  usage_source?: string
  consumed_quota?: number | null
  request_ids?: string[]
  error_detail?: string
  prompt_tokens: number
  completion_tokens: number
  attempts: number
  effort: string
  answer: string
  prompt: string
  output_text: string
  artifact_bytes: number
  vehicle: string
  scene: string
  error_kind: string
}

// Transport failures do not count as evidence of reduced model capability.
export function probeQualityRate(
  stats: Pick<ProbeStats, 'pass' | 'fail'>
): number | null {
  const samples = stats.pass + stats.fail
  return samples > 0 ? (stats.pass / samples) * 100 : null
}
