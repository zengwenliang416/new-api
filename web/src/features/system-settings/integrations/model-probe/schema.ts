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
import { z } from 'zod'

import type { ModelProbeSettings, ModelProbeTarget } from './types'

export const storedProbeTargetSchema = z.object({
  group: z.string(),
  model: z.string(),
  effort: z.enum(['low', 'medium', 'high', 'xhigh']).default('medium'),
  kinds: z.array(z.enum(['math', 'drawing'])).default(['math', 'drawing']),
  enabled: z.boolean().default(true),
  token_id: z.number().int().nonnegative().default(0),
})

export function createModelProbeSchema(t: (key: string) => string) {
  const required = t('This field is required')
  return z
    .object({
      enabled: z.boolean(),
      public_access: z.boolean(),
      interval_minutes: z.number().int().min(5).max(1440),
      timeout_seconds: z.number().int().min(30).max(1800),
      max_attempts: z.number().int().min(1).max(5),
      retention_days: z.number().int().min(0).max(365),
      probe_user_id: z.number().int().nonnegative(),
      user_agent: z.string(),
      math_prompt: z.string(),
      math_answer: z.string().trim().min(1, required),
      drawing_prompt: z.string(),
      instructions: z.string(),
      targets: z.array(
        z.object({
          group: z.string().trim().min(1, required),
          model: z.string().trim().min(1, required),
          effort: z.enum(['low', 'medium', 'high', 'xhigh']),
          kinds: z
            .array(z.enum(['math', 'drawing']))
            .min(1, t('Select at least one probe type')),
          enabled: z.boolean(),
          token_id: z.number().int().nonnegative(),
        })
      ),
    })
    .superRefine((value, ctx) => {
      for (const [index, target] of value.targets.entries()) {
        if (value.enabled && target.enabled && target.token_id === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['targets', index, 'token_id'],
            message: t('Select an API token for this probe target'),
          })
        }
      }
      if (value.enabled && value.probe_user_id === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['probe_user_id'],
          message: t('Select a probe account'),
        })
      }
      if (value.enabled && !value.targets.some((target) => target.enabled)) {
        ctx.addIssue({
          code: 'custom',
          path: ['targets'],
          message: t('Add and enable at least one probe target'),
        })
      }
    })
}

export type ModelProbeFormValues = z.infer<
  ReturnType<typeof createModelProbeSchema>
>

export function modelProbeFormDefaults(
  settings: ModelProbeSettings,
  targets: ModelProbeTarget[]
): ModelProbeFormValues {
  return {
    enabled: settings['model_probe_setting.enabled'],
    public_access: settings['model_probe_setting.public_access'],
    interval_minutes: settings['model_probe_setting.interval_minutes'],
    timeout_seconds: settings['model_probe_setting.timeout_seconds'],
    max_attempts: settings['model_probe_setting.max_attempts'],
    retention_days: settings['model_probe_setting.retention_days'],
    probe_user_id: settings['model_probe_setting.probe_user_id'],
    user_agent: settings['model_probe_setting.user_agent'],
    math_prompt: settings['model_probe_setting.math_prompt'],
    math_answer: settings['model_probe_setting.math_answer'],
    drawing_prompt: settings['model_probe_setting.drawing_prompt'],
    instructions: settings['model_probe_setting.instructions'],
    targets,
  }
}

export function serializeModelProbeSettings(
  values: ModelProbeFormValues
): ModelProbeSettings {
  return {
    'model_probe_setting.enabled': values.enabled,
    'model_probe_setting.public_access': values.public_access,
    'model_probe_setting.interval_minutes': values.interval_minutes,
    'model_probe_setting.timeout_seconds': values.timeout_seconds,
    'model_probe_setting.max_attempts': values.max_attempts,
    'model_probe_setting.retention_days': values.retention_days,
    'model_probe_setting.probe_user_id': values.probe_user_id,
    'model_probe_setting.user_agent': values.user_agent,
    'model_probe_setting.math_prompt': values.math_prompt,
    'model_probe_setting.math_answer': values.math_answer,
    'model_probe_setting.drawing_prompt': values.drawing_prompt,
    'model_probe_setting.instructions': values.instructions,
    'model_probe_setting.targets': JSON.stringify(values.targets),
  }
}
