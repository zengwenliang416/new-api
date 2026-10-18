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

export type ReportStatus = 'verified' | 'reference' | 'archived'

export interface ReportEntry {
  id: number
  provider: string
  title: string
  description: string
  url: string
  status: ReportStatus
  publishedDate: string
  sort: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function trimString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

/**
 * Parse the admin-configured third-party reports from the status payload.
 *
 * Accepts either a JSON string or an array under `third_party_reports`, drops
 * entries without provider/title/url, and orders by `sort` then title.
 */
export function parseThirdPartyReports(
  status: StatusData | null | undefined
): ReportEntry[] {
  const raw = readStatusField(status, 'third_party_reports')
  let source: unknown = raw
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(source)) return []

  const reports: ReportEntry[] = []
  for (const [index, entry] of source.entries()) {
    if (!isRecord(entry) || entry.enabled === false) continue
    const provider = trimString(entry.provider)
    const title = trimString(entry.title)
    const url = trimString(entry.url)
    if (!provider || !title || !url) continue
    try {
      const target = new URL(url)
      if (
        !['http:', 'https:'].includes(target.protocol) ||
        target.username ||
        target.password
      ) {
        continue
      }
    } catch {
      continue
    }
    const status = entry.status
    reports.push({
      id: toNumber(entry.id, index + 1),
      provider,
      title,
      description: trimString(entry.description),
      url,
      status:
        status === 'verified' || status === 'archived' ? status : 'reference',
      publishedDate: trimString(entry.publishedDate),
      sort: toNumber(entry.sort, index + 1),
    })
  }
  return reports.sort((a, b) =>
    a.sort !== b.sort ? a.sort - b.sort : a.title.localeCompare(b.title)
  )
}

/** Whether the admin has explicitly configured the reports list. */
export function isThirdPartyReportsConfigured(
  status: StatusData | null | undefined
): boolean {
  return readStatusField(status, 'third_party_reports_configured') === true
}

/** Whether third-party reports are enabled in the status payload. */
export function isThirdPartyReportsEnabled(
  status: StatusData | null | undefined
): boolean {
  return readStatusField(status, 'third_party_reports_enabled') === true
}
