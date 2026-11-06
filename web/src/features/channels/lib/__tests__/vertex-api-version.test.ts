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
import { describe, expect, test } from 'vitest'

import { channelSchema } from '../../types'
import { CHANNEL_TYPE_ADVANCED_CUSTOM } from '../advanced-custom'
import {
  CHANNEL_FORM_DEFAULT_VALUES,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
  transformFormDataToUpdatePayload,
} from '../channel-form'

const vertexChannel = channelSchema.parse({
  id: 41,
  name: 'Vertex channel',
  key: '',
  type: 41,
  status: 1,
  created_time: 0,
  test_time: 0,
  response_time: 0,
  balance_updated_time: 0,
  other: 'us-central1',
})

describe('Vertex API version form settings', () => {
  test.each(['v1', 'v1beta1'] as const)(
    'preserves %s through create, update and reload without exposing a key',
    (version) => {
      const channel = {
        ...vertexChannel,
        settings: JSON.stringify({ vertex_api_version: version }),
      }
      const values = transformChannelToFormDefaults(channel)
      expect(values.vertex_api_version).toBe(version)
      const payloads = [
        transformFormDataToCreatePayload(values).channel,
        transformFormDataToUpdatePayload(values, channel.id),
      ]
      for (const payload of payloads) {
        expect(payload.settings).toBeDefined()
        expect(JSON.parse(payload.settings ?? '')).toMatchObject({
          vertex_key_type: 'json',
          vertex_api_version: version,
        })
        expect(
          transformChannelToFormDefaults({
            ...channel,
            settings: payload.settings ?? '',
          }).vertex_api_version
        ).toBe(version)
        expect(payload.key).toBeFalsy()
      }
    }
  )

  test.each([undefined, 'v1', 'unsupported', null])(
    'defaults legacy or invalid saved version %s to v1',
    (version) => {
      expect(
        transformChannelToFormDefaults({
          ...vertexChannel,
          settings: JSON.stringify({ vertex_api_version: version }),
        }).vertex_api_version
      ).toBe('v1')
    }
  )

  test('rejects an unsupported form version before submitting', () => {
    const result = channelFormSchema.safeParse({
      ...CHANNEL_FORM_DEFAULT_VALUES,
      name: vertexChannel.name,
      type: 41,
      other: 'us-central1',
      vertex_api_version: 'v2',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ['vertex_api_version'] }),
        ])
      )
    }
  })

  test('removes Vertex-only settings after switching to an OpenAI channel', () => {
    const values = transformChannelToFormDefaults({
      ...vertexChannel,
      settings: JSON.stringify({
        vertex_key_type: 'api_key',
        vertex_api_version: 'v1beta1',
        custom_setting: 'keep',
      }),
    })
    values.type = 1
    const payload = transformFormDataToUpdatePayload(values, vertexChannel.id)
    expect(payload.settings).toBeDefined()
    const settings = JSON.parse(payload.settings ?? '')
    expect(settings).not.toHaveProperty('vertex_api_version')
    expect(settings).not.toHaveProperty('vertex_key_type')
    expect(settings.custom_setting).toBe('keep')
  })

  test('retains the local Advanced Custom body-passthrough restriction', () => {
    const values = {
      ...CHANNEL_FORM_DEFAULT_VALUES,
      type: CHANNEL_TYPE_ADVANCED_CUSTOM,
      pass_through_body_enabled: true,
    }
    for (const payload of [
      transformFormDataToCreatePayload(values).channel,
      transformFormDataToUpdatePayload(values, 1),
    ]) {
      expect(payload.setting).toBeDefined()
      expect(JSON.parse(payload.setting ?? '').pass_through_body_enabled).toBe(
        false
      )
    }
  })
})
