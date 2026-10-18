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
import { runInNewContext } from 'node:vm'

import { describe, expect, test, vi } from 'vitest'

import { ENDPOINT_MAP } from '../../data/api-endpoints'
import { buildCodeSamples } from '../build-code-samples'

describe('API documentation request samples', () => {
  test('a successful speech response preserves binary bytes instead of parsing JSON', async () => {
    const sample = buildCodeSamples(
      ENDPOINT_MAP['audio-speech'],
      'https://gateway.example'
    ).find((entry) => entry.language === 'JavaScript')
    expect(sample).toBeDefined()
    const bytes = new Uint8Array([73, 68, 51, 4, 0, 0])
    const response = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(bytes.buffer),
      json: vi
        .fn()
        .mockRejectedValue(new SyntaxError('Binary audio is not JSON')),
    }
    const log = vi.fn()
    await runInNewContext(`(async () => { ${sample?.code} })()`, {
      fetch: vi.fn().mockResolvedValue(response),
      process: { env: { NEW_API_KEY: 'sk-example' } },
      console: { log },
    })
    expect([...log.mock.calls[0][0]]).toEqual([...bytes])
    expect(response.json).not.toHaveBeenCalled()
  })

  test('a successful JSON response remains usable by the copied JavaScript example', async () => {
    const sample = buildCodeSamples(
      ENDPOINT_MAP['models-list'],
      'https://gateway.example'
    ).find((entry) => entry.language === 'JavaScript')
    expect(sample).toBeDefined()
    const payload = { data: [{ id: 'available-model' }] }
    const log = vi.fn()
    await runInNewContext(`(async () => { ${sample?.code} })()`, {
      fetch: vi.fn().mockResolvedValue({ ok: true, json: async () => payload }),
      process: { env: { NEW_API_KEY: 'sk-example' } },
      console: { log },
    })
    expect(log).toHaveBeenCalledWith(payload)
  })

  test('a failed binary request reports the HTTP error instead of treating it as a file', async () => {
    const sample = buildCodeSamples(
      ENDPOINT_MAP['audio-speech'],
      'https://gateway.example'
    ).find((entry) => entry.language === 'JavaScript')
    expect(sample).toBeDefined()
    const arrayBuffer = vi.fn()
    await expect(
      runInNewContext(`(async () => { ${sample?.code} })()`, {
        fetch: vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => 'Invalid API key',
          arrayBuffer,
        }),
        process: { env: { NEW_API_KEY: 'sk-example' } },
        console: { log: vi.fn() },
      })
    ).rejects.toThrow('401: Invalid API key')
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  test('realtime examples use a model and WebSocket handshake rather than an HTTP JSON response', () => {
    const samples = buildCodeSamples(
      ENDPOINT_MAP['realtime-open'],
      'https://gateway.example'
    )
    expect(
      samples.find((sample) => sample.language === 'JavaScript')?.code
    ).toContain('wss://gateway.example/v1/realtime?model=')
    expect(
      samples.find((sample) => sample.language === 'cURL')?.code
    ).toContain('Upgrade: websocket')
    expect(
      samples.every((sample) => !sample.code.includes('response.json()'))
    ).toBe(true)
    expect(ENDPOINT_MAP['realtime-open'].responseExamples[0].status).toBe('101')
  })

  test('multipart file samples supply actual file bytes and a filename', () => {
    const samples = buildCodeSamples(
      ENDPOINT_MAP['audio-transcriptions'],
      'https://gateway.example'
    )
    const javascript = samples.find(
      (sample) => sample.language === 'JavaScript'
    )?.code
    expect(javascript).toContain('openAsBlob(')
    expect(javascript).not.toContain('fileInput')
    expect(samples.find((sample) => sample.language === 'Go')?.code).toContain(
      'io.Copy('
    )
    expect(samples.find((sample) => sample.language === 'C#')?.code).toMatch(
      /form\.Add\(new StreamContent\(File\.OpenRead\("[^"]+"\)\), "file", "[^"]+"\)/
    )
    expect(
      samples.find((sample) => sample.language === 'Java')?.code
    ).not.toContain('POST(multipartBody)')
  })
})
