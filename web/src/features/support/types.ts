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
export type SupportScope = 'user' | 'admin'

export type TicketStatus = 'open' | 'pending' | 'closed'
export type TicketStatusFilter = TicketStatus | 'all'

export type TicketCategory =
  | 'quota'
  | 'platform_error'
  | 'frontend_error'
  | 'api_error'
  | 'refund'
  | 'account'
  | 'other'
export type TicketCategoryFilter = TicketCategory | 'all'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketPriorityFilter = TicketPriority | 'all'

export type TicketVerification =
  | 'not_verified'
  | 'suspected'
  | 'reproducible'
  | 'confirmed'
export type TicketVerificationFilter = TicketVerification | 'all'

export type TicketSort = 'needs_action' | 'unread' | 'priority' | 'updated'

export type TicketSenderType = 'user' | 'admin' | 'system' | 'external'

export interface SupportSessionUser {
  id: number
  email?: string
}

export interface SupportSessionNotify {
  configured: boolean
  label: string
  target: string
}

export interface SupportSession {
  worker_url: string
  token: string
  user: SupportSessionUser
  notify: SupportSessionNotify
}

export interface SupportAttachment {
  id?: number
  key: string
  name: string
  size?: number
  url?: string
  /** Client-side object URL for freshly uploaded images. */
  preview_url?: string
}

export interface SupportMessage {
  id: number
  sender_type: TicketSenderType
  sender_name?: string
  sender_lang?: string
  body: string
  created_at: number
  attachments: SupportAttachment[]
}

export interface SupportTranslation {
  body: string
  status?: 'machine' | 'reviewed'
}

export interface SupportTicket {
  id: number
  user_id: number
  username?: string
  display_name?: string
  title: string
  status: TicketStatus
  category: TicketCategory
  priority: TicketPriority
  verification_level: TicketVerification
  unread_user: boolean
  unread_admin: boolean
  last_message_preview?: string
  last_message_sender_type?: TicketSenderType
  reply_channel?: string
  reply_target?: string
  created_at: number
  updated_at: number
}

export interface SupportTicketDetail {
  ticket: SupportTicket
  messages: SupportMessage[]
  translations?: Record<number, SupportTranslation>
  next_cursor?: string | null
}

export interface SupportTicketPage {
  items: SupportTicket[]
  next_cursor?: string | null
}

export interface SupportSummary {
  unread_count?: number
  pending_count?: number
  attention_count?: number
  status_counts?: Partial<Record<TicketStatus, number>>
  latest_unread?: SupportTicket[]
  latest_attention?: SupportTicket[]
}

export interface SupportTicketListParams {
  scope: SupportScope
  status?: TicketStatusFilter
  category?: TicketCategoryFilter
  priority?: TicketPriorityFilter
  verification?: TicketVerificationFilter
  sort?: TicketSort
  unread?: boolean
  q?: string
  user_id?: number | null
  cursor?: string | null
}

export interface SupportMessageListParams {
  scope: SupportScope
  ticketId: number
  cursor?: string | null
  lang?: string
}

export interface SupportMessageCreatePayload {
  client_request_id?: string
  scope: SupportScope
  ticketId: number
  sender_type: TicketSenderType
  body: string
  attachments: SupportAttachment[]
  lang?: string
}

export interface SupportTicketUpdatePayload {
  scope: SupportScope
  ticketId: number
  status?: TicketStatus
  priority?: TicketPriority
}

export interface SupportTicketCreatePayload {
  client_request_id?: string
  title: string
  category: TicketCategory
  verification_level: TicketVerification
  body: string
  attachments: SupportAttachment[]
  lang?: string
}

export interface SupportPageSearch {
  ticket?: string
  status?: TicketStatusFilter
  category?: TicketCategoryFilter
  priority?: TicketPriorityFilter
  verification?: TicketVerificationFilter
  sort?: TicketSort
  unread?: boolean
  q?: string
  user_id?: string
}
