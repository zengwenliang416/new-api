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
import type {
  TicketCategoryFilter,
  TicketPriority,
  TicketPriorityFilter,
  TicketSort,
  TicketStatusFilter,
  TicketVerificationFilter,
} from './types'

// ============================================================================
// Query Timing
// ============================================================================

export const SUPPORT_SESSION_STALE_MS = 120_000
export const SUPPORT_SESSION_REFETCH_MS = 300_000
export const SUPPORT_DATA_REFETCH_MS = 300_000
export const SUPPORT_SEARCH_DEBOUNCE_MS = 300

// ============================================================================
// Attachments
// ============================================================================

export const SUPPORT_MAX_ATTACHMENTS = 5
export const SUPPORT_MAX_IMAGE_BYTES = 8 * 1024 * 1024
export const SUPPORT_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

// ============================================================================
// Filter Options
// ============================================================================

export const SUPPORT_CATEGORY_OPTIONS: {
  value: TicketCategoryFilter
  labelKey: string
}[] = [
  { value: 'quota', labelKey: 'Quota' },
  { value: 'platform_error', labelKey: 'Platform error' },
  { value: 'frontend_error', labelKey: 'Frontend error' },
  { value: 'api_error', labelKey: 'API error' },
  { value: 'refund', labelKey: 'Refund' },
  { value: 'account', labelKey: 'Account' },
  { value: 'other', labelKey: 'Other' },
]

export const SUPPORT_VERIFICATION_OPTIONS: {
  value: TicketVerificationFilter
  labelKey: string
  descriptionKey: string
}[] = [
  {
    value: 'not_verified',
    labelKey: 'Not verified',
    descriptionKey: 'You are reporting a possible issue without confirmation.',
  },
  {
    value: 'suspected',
    labelKey: 'Suspected',
    descriptionKey: 'You have clues, but the issue is not reliably repeatable.',
  },
  {
    value: 'reproducible',
    labelKey: 'Reproducible',
    descriptionKey: 'You can reproduce it with clear steps.',
  },
  {
    value: 'confirmed',
    labelKey: 'Confirmed',
    descriptionKey: 'You have logs, request IDs, or other direct evidence.',
  },
]

export const SUPPORT_STATUS_OPTIONS: {
  value: TicketStatusFilter
  labelKey: string
}[] = [
  { value: 'all', labelKey: 'All tickets' },
  { value: 'open', labelKey: 'Pending handling' },
  { value: 'pending', labelKey: 'Awaiting user reply' },
  { value: 'closed', labelKey: 'Resolved' },
]

export const SUPPORT_PRIORITY_OPTIONS: {
  value: TicketPriorityFilter
  labelKey: string
}[] = [
  { value: 'all', labelKey: 'All priorities' },
  { value: 'low', labelKey: 'Low priority' },
  { value: 'normal', labelKey: 'Normal priority' },
  { value: 'high', labelKey: 'High priority' },
  { value: 'urgent', labelKey: 'Urgent priority' },
]

export const SUPPORT_SORT_OPTIONS: { value: TicketSort; labelKey: string }[] = [
  { value: 'needs_action', labelKey: 'Needs action first' },
  { value: 'unread', labelKey: 'Unread first' },
  { value: 'priority', labelKey: 'High priority first' },
  { value: 'updated', labelKey: 'Newest first' },
]

export const SUPPORT_STATUS_VALUES: TicketStatusFilter[] = [
  'all',
  'open',
  'pending',
  'closed',
]
export const SUPPORT_CATEGORY_VALUES: TicketCategoryFilter[] = [
  'all',
  'quota',
  'platform_error',
  'frontend_error',
  'api_error',
  'refund',
  'account',
  'other',
]
export const SUPPORT_PRIORITY_VALUES: TicketPriorityFilter[] = [
  'all',
  'low',
  'normal',
  'high',
  'urgent',
]
export const SUPPORT_VERIFICATION_VALUES: TicketVerificationFilter[] = [
  'all',
  'not_verified',
  'suspected',
  'reproducible',
  'confirmed',
]
export const SUPPORT_SORT_VALUES: TicketSort[] = [
  'needs_action',
  'unread',
  'priority',
  'updated',
]

export const DEFAULT_TICKET_SORT: TicketSort = 'needs_action'

// ============================================================================
// Worker Error Messages
// ============================================================================

/**
 * Error messages from the support worker and this site's support endpoints
 * that are safe to surface verbatim (and translatable). Anything else falls
 * back to a generic localized message.
 */
export const SUPPORT_ERROR_MESSAGE_ALLOWLIST = new Set<string>([
  'Admin replies must use admin scope',
  'Admin scope only accepts admin replies',
  'Admin permission required',
  'Attachment not found',
  'Bind an email before creating a support ticket',
  'Content length is required',
  'Image content does not match file type',
  'Image file is required',
  'Image link expired',
  'Image must be 1 byte to 8 MB',
  'Image not found',
  'Image upload request is too large',
  'Incomplete support token',
  'Invalid cursor',
  'Invalid Content-Length',
  'Invalid image attachment',
  'Invalid image range',
  'Invalid image signature',
  'Invalid JSON body',
  'Invalid support token',
  'Invalid support token audience',
  'Invalid support token issuer',
  'Invalid support token signature',
  'Invalid sender type',
  'Invalid ticket category',
  'Invalid ticket priority',
  'Invalid ticket sort',
  'Invalid ticket status',
  'Invalid translation language',
  'Invalid user id',
  'Invalid verification level',
  'Message or image is required',
  'Message is required',
  'Message has no text to translate',
  'Message is already in the requested language',
  'Message not found',
  'Message translation is not enabled',
  'Missing support token',
  'No changes supplied',
  'Only JPG, PNG, WebP, and GIF images are allowed',
  'Only admins can change priority',
  'Only admins can change ticket workflow status',
  'Only admins can filter by user',
  'Only resolved tickets can be deleted',
  'Search query is too long',
  'Support JWT secret is not configured',
  'Support admin verification failed',
  'Support admin verification is not configured',
  'Support image bucket is not configured',
  'Support notification callback is not configured',
  'Support token expired',
  'Support token is not active yet',
  'Support user is disabled',
  'Support user verification failed',
  'Support user verification is not configured',
  'Support worker request failed',
  'Ticket cleanup has already started',
  'Ticket not found',
  'Title and message are required',
  'Too many support requests, please try later',
  'Translation gateway is not configured',
  'Translation text is required',
  'Unsupported support token algorithm',
  'You can attach up to 5 images',
  'JSON request body is too large',
  'support worker is not configured',
  'support worker callback secret is not configured',
  'support worker jwt secret is not configured',
  'user is disabled',
])

/**
 * Token-scoped error messages. When the worker rejects the session token the
 * cached session must be dropped and a fresh one requested.
 */
export const SUPPORT_TOKEN_ERROR_MESSAGES = new Set<string>([
  'Incomplete support token',
  'Invalid support token',
  'Invalid support token audience',
  'Invalid support token issuer',
  'Invalid support token signature',
  'Missing support token',
  'Support token expired',
  'Support token is not active yet',
  'Unsupported support token algorithm',
])

export const EMPTY_SUMMARY_STATUS_COUNTS: Record<
  'open' | 'pending' | 'closed',
  number
> = { open: 0, pending: 0, closed: 0 }

export const LATEST_TICKETS_LIMIT = 3

export const TICKET_PRIORITY_FALLBACK: TicketPriority = 'normal'
