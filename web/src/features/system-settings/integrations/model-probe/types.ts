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
export type ModelProbeTarget = {
  group: string
  model: string
  effort: 'low' | 'medium' | 'high' | 'xhigh'
  kinds: Array<'math' | 'drawing'>
  enabled: boolean
  token_id: number
}

export type ModelProbeCandidates = {
  groups: Array<{ group: string; name: string }>
  users: Array<{ id: number; username: string; display_name: string }>
  tokens: Array<{ id: number; user_id: number; name: string; group: string }>
  defaults: {
    math_prompt: string
    math_answer: string
    drawing_prompt: string
    instructions: string
    user_agent: string
  }
  drawing_catalog: { vehicles: string[]; scenes: string[] }
}

export type ModelProbeSettings = {
  'model_probe_setting.enabled': boolean
  'model_probe_setting.public_access': boolean
  'model_probe_setting.interval_minutes': number
  'model_probe_setting.timeout_seconds': number
  'model_probe_setting.max_attempts': number
  'model_probe_setting.retention_days': number
  'model_probe_setting.probe_user_id': number
  'model_probe_setting.user_agent': string
  'model_probe_setting.math_prompt': string
  'model_probe_setting.math_answer': string
  'model_probe_setting.drawing_prompt': string
  'model_probe_setting.instructions': string
  'model_probe_setting.targets': string
}

export const DEFAULT_MODEL_PROBE_SETTINGS: ModelProbeSettings = {
  'model_probe_setting.enabled': false,
  'model_probe_setting.public_access': false,
  'model_probe_setting.interval_minutes': 30,
  'model_probe_setting.timeout_seconds': 300,
  'model_probe_setting.max_attempts': 2,
  'model_probe_setting.retention_days': 30,
  'model_probe_setting.probe_user_id': 0,
  'model_probe_setting.user_agent': '',
  'model_probe_setting.math_prompt': '',
  'model_probe_setting.math_answer': '21',
  'model_probe_setting.drawing_prompt': '',
  'model_probe_setting.instructions': '',
  'model_probe_setting.targets': '[]',
}
