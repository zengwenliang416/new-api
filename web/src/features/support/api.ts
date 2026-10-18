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
import { api } from '@/lib/http-client'
import { createServerError } from '@/lib/server-error-message'

import { SUPPORT_TOKEN_ERROR_MESSAGES } from './constants'
import type {
  SupportAttachment,
  SupportMessage,
  SupportMessageCreatePayload,
  SupportMessageListParams,
  SupportSession,
  SupportSummary,
  SupportTicketCreatePayload,
  SupportTicketDetail,
  SupportTicketListParams,
  SupportTicketPage,
  SupportTicketUpdatePayload,
  SupportTranslation,
} from './types'

export class SupportWorkerRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SupportWorkerRequestError'
    this.status = status
  }
}

export class SupportWorkerNotConfiguredError extends Error {
  constructor() {
    super('support worker is not configured')
    this.name = 'SupportWorkerNotConfiguredError'
  }
}

/** Whether an error means the cached worker session token is no longer valid. */
export function isSupportTokenError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (SUPPORT_TOKEN_ERROR_MESSAGES.has(error.message)) return true
  return (
    error instanceof SupportWorkerRequestError &&
    error.status === 401 &&
    error.message.startsWith('Support worker request failed')
  )
}

export async function getSupportSession(): Promise<SupportSession> {
  const res = await api.get('/api/support/session', {
    skipErrorHandler: true,
  })
  if (!res.data.success) {
    if (res.data.message === 'support worker is not configured') {
      throw new SupportWorkerNotConfiguredError()
    }
    throw createServerError(res.data, 'Failed to connect support worker')
  }
  return res.data.data as SupportSession
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

async function workerRequest<T>(
  session: SupportSession,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const isFormData = init.body instanceof FormData
  const response = await fetch(`${session.worker_url}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.token}`,
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init.headers,
    },
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.success) {
    throw new SupportWorkerRequestError(
      payload?.message || `Support worker request failed: ${response.status}`,
      response.status
    )
  }
  return payload.data as T
}

async function workerBlobRequest(
  session: SupportSession,
  path: string
): Promise<Blob> {
  const response = await fetch(`${session.worker_url}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new SupportWorkerRequestError(
      payload?.message || `Support worker request failed: ${response.status}`,
      response.status
    )
  }
  return response.blob()
}

export async function listSupportTickets(
  session: SupportSession,
  params: SupportTicketListParams
): Promise<SupportTicketPage> {
  const query = new URLSearchParams()
  query.set('limit', '30')
  if (params.scope === 'admin') query.set('scope', 'admin')
  if (params.status && params.status !== 'all') {
    query.set('status', params.status)
  }
  if (params.category && params.category !== 'all') {
    query.set('category', params.category)
  }
  if (params.priority && params.priority !== 'all') {
    query.set('priority', params.priority)
  }
  if (params.verification && params.verification !== 'all') {
    query.set('verification', params.verification)
  }
  if (params.sort) query.set('sort', params.sort)
  if (params.unread) query.set('unread', '1')
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.user_id) query.set('user_id', String(params.user_id))
  if (params.cursor) query.set('cursor', params.cursor)
  return workerRequest<SupportTicketPage>(
    session,
    withQuery('/api/tickets', query)
  )
}

export async function listSupportMessages(
  session: SupportSession,
  params: SupportMessageListParams
): Promise<{
  items: SupportMessage[]
  next_cursor?: string | null
  translations?: Record<number, SupportTranslation>
}> {
  const query = new URLSearchParams()
  query.set('limit', '50')
  if (params.scope === 'admin') query.set('scope', 'admin')
  if (params.cursor) query.set('cursor', params.cursor)
  if (params.lang) query.set('lang', params.lang)
  return workerRequest(
    session,
    withQuery(
      `/api/tickets/${encodeURIComponent(params.ticketId)}/messages`,
      query
    )
  )
}

export async function getSupportTicket(
  session: SupportSession,
  ticketId: number,
  scope: SupportTicketListParams['scope'],
  lang?: string
): Promise<SupportTicketDetail> {
  const query = new URLSearchParams()
  if (scope === 'admin') query.set('scope', 'admin')
  if (lang) query.set('lang', lang)
  return workerRequest<SupportTicketDetail>(
    session,
    withQuery(`/api/tickets/${encodeURIComponent(ticketId)}`, query)
  )
}

export async function getSupportSummary(
  session: SupportSession,
  scope: SupportTicketListParams['scope']
): Promise<SupportSummary> {
  const query = new URLSearchParams()
  if (scope === 'admin') query.set('scope', 'admin')
  return workerRequest<SupportSummary>(
    session,
    withQuery('/api/tickets/summary', query)
  )
}

export async function createSupportTicket(
  session: SupportSession,
  payload: SupportTicketCreatePayload
): Promise<SupportTicketDetail> {
  return workerRequest<SupportTicketDetail>(session, '/api/tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function createSupportMessage(
  session: SupportSession,
  payload: SupportMessageCreatePayload
): Promise<SupportTicketDetail> {
  const query = new URLSearchParams()
  if (payload.scope === 'admin') query.set('scope', 'admin')
  if (payload.lang) query.set('lang', payload.lang)
  return workerRequest<SupportTicketDetail>(
    session,
    withQuery(
      `/api/tickets/${encodeURIComponent(payload.ticketId)}/messages`,
      query
    ),
    {
      method: 'POST',
      body: JSON.stringify({
        client_request_id: payload.client_request_id,
        sender_type: payload.sender_type,
        body: payload.body,
        attachments: payload.attachments,
        lang: payload.lang,
      }),
    }
  )
}

export async function translateSupportMessage(
  session: SupportSession,
  params: {
    ticketId: number
    messageId: number
    scope: SupportTicketListParams['scope']
    lang: string
  }
): Promise<SupportTranslation> {
  const query = new URLSearchParams()
  if (params.scope === 'admin') query.set('scope', 'admin')
  return workerRequest<SupportTranslation>(
    session,
    withQuery(
      `/api/tickets/${encodeURIComponent(params.ticketId)}/messages/${encodeURIComponent(params.messageId)}/translate`,
      query
    ),
    { method: 'POST', body: JSON.stringify({ lang: params.lang }) }
  )
}

export async function updateSupportMessageTranslation(
  session: SupportSession,
  params: {
    ticketId: number
    messageId: number
    scope: SupportTicketListParams['scope']
    lang: string
    body: string
  }
): Promise<SupportTranslation> {
  const query = new URLSearchParams()
  if (params.scope === 'admin') query.set('scope', 'admin')
  return workerRequest<SupportTranslation>(
    session,
    withQuery(
      `/api/tickets/${encodeURIComponent(params.ticketId)}/messages/${encodeURIComponent(params.messageId)}/translation`,
      query
    ),
    {
      method: 'PUT',
      body: JSON.stringify({ lang: params.lang, body: params.body }),
    }
  )
}

export async function uploadSupportImage(
  session: SupportSession,
  file: File
): Promise<SupportAttachment> {
  const formData = new FormData()
  formData.set('file', file)
  return workerRequest<SupportAttachment>(session, '/api/uploads/images', {
    method: 'POST',
    body: formData,
  })
}

export async function updateSupportTicket(
  session: SupportSession,
  payload: SupportTicketUpdatePayload
): Promise<SupportTicketDetail> {
  const body: Record<string, string> = {}
  if (payload.status) body.status = payload.status
  if (payload.priority) body.priority = payload.priority
  const query = new URLSearchParams()
  if (payload.scope === 'admin') query.set('scope', 'admin')
  return workerRequest<SupportTicketDetail>(
    session,
    withQuery(`/api/tickets/${encodeURIComponent(payload.ticketId)}`, query),
    { method: 'PATCH', body: JSON.stringify(body) }
  )
}

export async function deleteSupportTicket(
  session: SupportSession,
  params: { ticketId: number; scope: SupportTicketListParams['scope'] }
): Promise<unknown> {
  const query = new URLSearchParams()
  if (params.scope === 'admin') query.set('scope', 'admin')
  return workerRequest(
    session,
    withQuery(`/api/tickets/${encodeURIComponent(params.ticketId)}`, query),
    { method: 'DELETE' }
  )
}

export async function fetchSupportAttachmentBlob(
  session: SupportSession,
  params: {
    ticketId: number
    attachmentId: number
    scope: SupportTicketListParams['scope']
  }
): Promise<Blob> {
  const query = new URLSearchParams()
  if (params.scope === 'admin') query.set('scope', 'admin')
  return workerBlobRequest(
    session,
    withQuery(
      `/api/tickets/${encodeURIComponent(params.ticketId)}/attachments/${encodeURIComponent(params.attachmentId)}/blob`,
      query
    )
  )
}
