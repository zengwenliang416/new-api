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
import {
  INTERFACE_LANGUAGE_OPTIONS,
  normalizeInterfaceLanguage,
  toIntlLocale,
} from '@/i18n/languages'

import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_ERROR_MESSAGE_ALLOWLIST,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_SORT_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  SUPPORT_VERIFICATION_OPTIONS,
} from '../constants'
import type {
  SupportScope,
  TicketCategory,
  TicketPriority,
  TicketSenderType,
  TicketSort,
  TicketStatusFilter,
  TicketVerification,
  TicketVerificationFilter,
} from '../types'

type Translate = (key: string, options?: Record<string, unknown>) => string

const BY_LABEL = (value: string) => value.trim().toLowerCase()

/** Localized label for a ticket status, scoped to the current viewer. */
export function getTicketStatusLabel(
  status: TicketStatusFilter,
  scope: SupportScope
): string {
  if (status === 'all') return 'All tickets'
  if (status === 'open') {
    return scope === 'admin' ? 'Pending handling' : 'Support is handling'
  }
  if (status === 'pending') {
    return scope === 'admin' ? 'Awaiting user reply' : 'Awaiting your reply'
  }
  return 'Resolved'
}

/** Whether a ticket status needs the viewer's attention. */
export function isTicketStatusAttention(
  status: TicketStatusFilter,
  scope: SupportScope
): boolean {
  return scope === 'admin' ? status === 'open' : status === 'pending'
}

export function getTicketCategoryLabel(
  category: TicketCategory | string
): string {
  return (
    SUPPORT_CATEGORY_OPTIONS.find((option) => option.value === category)
      ?.labelKey ?? 'Other'
  )
}

export function getTicketVerificationLabel(
  level: TicketVerification | TicketVerificationFilter | string
): string {
  return (
    SUPPORT_VERIFICATION_OPTIONS.find((option) => option.value === level)
      ?.labelKey ?? 'Not verified'
  )
}

export function getTicketPriorityLabel(
  priority: TicketPriority | string
): string {
  return (
    SUPPORT_PRIORITY_OPTIONS.find((option) => option.value === priority)
      ?.labelKey ?? 'Normal priority'
  )
}

export function getTicketSortLabel(sort: TicketSort | string): string {
  return (
    SUPPORT_SORT_OPTIONS.find((option) => option.value === sort)?.labelKey ??
    'Needs action first'
  )
}

export function getTicketStatusFilterLabel(status: TicketStatusFilter): string {
  return (
    SUPPORT_STATUS_OPTIONS.find((option) => option.value === status)
      ?.labelKey ?? 'All tickets'
  )
}

/** Localized reply-channel label sent by the worker. */
export function getNotifyChannelLabel(channel: string, t: Translate): string {
  const normalized = BY_LABEL(channel)
  if (normalized === 'email') return t('Email')
  if (normalized === 'webhook') return t('Webhook')
  if (normalized === 'bark') return t('Bark')
  if (normalized === 'gotify') return t('Gotify')
  if (normalized === 'unsupported notification method') {
    return t('Unsupported notification method')
  }
  return normalized ? channel : t('No reply method')
}

/** Display name of the sender of a list-item or message preview. */
export function getMessageSenderName(
  message: {
    sender_type?: TicketSenderType
    sender_name?: string
    display_name?: string
    username?: string
  },
  scope: SupportScope,
  t: Translate
): string {
  const senderType = message.sender_type
  if (senderType === 'admin') return message.sender_name || t('Admin')
  if (senderType === 'system') return t('System')
  if (senderType === 'external') return t('External')
  if (senderType === 'user') {
    return (
      message.sender_name ||
      message.display_name ||
      message.username ||
      t('User')
    )
  }
  return t(scope === 'admin' ? 'User' : 'Support')
}

/**
 * Resolve an error message for display: known worker/site messages pass
 * through verbatim (they are translation keys); anything else falls back
 * to the localized fallback text.
 */
export function getSupportErrorMessage(
  error: unknown,
  fallbackKey: string,
  t: Translate
): string {
  const message = error instanceof Error ? error.message : ''
  return t(
    message && SUPPORT_ERROR_MESSAGE_ALLOWLIST.has(message)
      ? message
      : fallbackKey
  )
}

/** Human readable byte size ("12 KB", "1.5 MB"). */
export function formatFileSize(size?: number): string {
  if (!size || size <= 0) return ''
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

/** Normalize a language code to a worker translation language (BCP 47). */
export function toWorkerLanguage(language?: string): string {
  return toIntlLocale(normalizeInterfaceLanguage(language)) ?? 'en'
}

/** Display label of a viewer language code. */
export function getViewerLanguageLabel(language?: string): string {
  const normalized = normalizeInterfaceLanguage(language)
  return (
    INTERFACE_LANGUAGE_OPTIONS.find((option) => option.code === normalized)
      ?.label ?? normalized
  )
}

/** Parse a positive safe integer user id from digits-only input. */
export function parseUserIdFilter(value: string): number | null {
  const digits = value.replaceAll(/\D/g, '').slice(0, 12)
  if (!digits) return null
  const parsed = Number(digits)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

/** Keep only digits, capped at the user-id filter length. */
export function normalizeUserIdInput(value: string): string {
  return value.replaceAll(/\D/g, '').slice(0, 12)
}
