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
import { readStatusField, type StatusData } from '@/lib/status-query'

function firstApiInfoUrl(apiInfo: unknown): string | null {
  if (!Array.isArray(apiInfo)) return null
  for (const entry of apiInfo) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).url === 'string'
    ) {
      return (entry as Record<string, unknown>).url as string
    }
  }
  return null
}

/**
 * Resolve the API root URL shown in the hero from the status payload.
 *
 * Prefers `server_address`/`serverAddress`, falls back to the first URL in
 * `api_info`, then to the current origin, and trims the trailing slash and
 * `/v1` suffix because the copy action states the root URL explicitly.
 */
export function resolveApiEndpoint(
  status: StatusData | null | undefined
): string {
  let candidate = readStatusField(status, 'server_address')
  if (candidate === undefined) {
    candidate = readStatusField(status, 'serverAddress')
  }

  if (typeof candidate !== 'string' || !candidate.trim()) {
    const apiInfo = readStatusField(status, 'api_info')
    if (Array.isArray(apiInfo)) {
      candidate = firstApiInfoUrl(apiInfo) ?? candidate
    } else if (typeof apiInfo === 'string' && apiInfo.trim()) {
      const trimmed = apiInfo.trim()
      if (trimmed.startsWith('[')) {
        try {
          candidate = firstApiInfoUrl(JSON.parse(trimmed)) ?? candidate
        } catch {
          // Keep the previous candidate when the payload is not valid JSON.
        }
      } else {
        candidate = trimmed
      }
    }
  }

  let endpoint =
    typeof candidate === 'string' && candidate.trim() ? candidate.trim() : ''
  if (!endpoint && typeof window !== 'undefined') {
    endpoint = window.location.origin
  }
  if (!endpoint) endpoint = 'https://api.example.com'
  return endpoint.replace(/\/+$/, '').replace(/\/v1$/i, '')
}
