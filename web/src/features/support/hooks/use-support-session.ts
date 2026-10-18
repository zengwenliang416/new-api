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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  getSupportSession,
  getSupportSummary,
  isSupportTokenError,
  SupportWorkerNotConfiguredError,
} from '../api'
import {
  EMPTY_SUMMARY_STATUS_COUNTS,
  SUPPORT_DATA_REFETCH_MS,
  SUPPORT_SESSION_REFETCH_MS,
  SUPPORT_SESSION_STALE_MS,
} from '../constants'
import type { SupportScope, SupportSummary, SupportTicket } from '../types'

export const SUPPORT_SESSION_QUERY_KEY = ['support-session'] as const
export const SUPPORT_SUMMARY_QUERY_KEY = ['support-summary'] as const
export const SUPPORT_TICKETS_QUERY_KEY = ['support-tickets'] as const
export const SUPPORT_TICKET_QUERY_KEY = ['support-ticket'] as const

const EMPTY_LATEST_TICKETS: SupportTicket[] = []

export interface UseSupportSessionResult {
  session:
    | ReturnType<
        typeof useQuery<Awaited<ReturnType<typeof getSupportSession>>>
      >['data']
    | null
  summary: SupportSummary | null
  unreadCount: number
  pendingCount: number
  attentionCount: number
  statusCounts: Record<'open' | 'pending' | 'closed', number>
  latestUnread: SupportTicket[]
  latestAttention: SupportTicket[]
  isLoading: boolean
  error: Error | null
  isEnabled: boolean
  isNotConfigured: boolean
  refetch: () => void
}

/**
 * Shell hook for the support pages: the worker session plus the queue summary,
 * shared by the user and admin scopes.
 */
export function useSupportSession(
  scope: SupportScope
): UseSupportSessionResult {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)
  const enabled =
    !!user && (scope === 'user' || Number(user.role ?? 0) >= ROLE.SUPPORT)

  const sessionQuery = useQuery({
    queryKey: SUPPORT_SESSION_QUERY_KEY,
    queryFn: getSupportSession,
    enabled,
    staleTime: SUPPORT_SESSION_STALE_MS,
    refetchInterval: (query) =>
      query.state.error instanceof SupportWorkerNotConfiguredError
        ? false
        : SUPPORT_SESSION_REFETCH_MS,
    retry: false,
    meta: { errorToast: false, errorRedirect: false },
  })

  const session =
    enabled && !sessionQuery.error ? (sessionQuery.data ?? null) : null

  const summaryQuery = useQuery({
    queryKey: [...SUPPORT_SUMMARY_QUERY_KEY, scope, session?.token],
    queryFn: () => {
      if (!session) throw new Error('Support worker is unavailable')
      return getSupportSummary(session, scope)
    },
    enabled: !!session,
    refetchInterval: SUPPORT_DATA_REFETCH_MS,
    retry: false,
    meta: { errorToast: false, errorRedirect: false },
  })

  const tokenRef = useRef('')
  useEffect(() => {
    const token = sessionQuery.data?.token
    if (!token) return
    if (tokenRef.current === token) return
    if (!isSupportTokenError(summaryQuery.error)) return
    tokenRef.current = token
    queryClient.removeQueries({ queryKey: SUPPORT_SESSION_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
  }, [queryClient, sessionQuery.data?.token, summaryQuery.error])

  const summary = session ? (summaryQuery.data ?? null) : null
  const unreadCount = summary?.unread_count ?? 0
  const pendingCount = summary?.pending_count ?? 0
  const attentionCount =
    summary?.attention_count ?? Math.max(unreadCount, pendingCount)
  const latestAttention =
    summary?.latest_attention ?? summary?.latest_unread ?? EMPTY_LATEST_TICKETS

  return {
    session,
    summary,
    unreadCount,
    pendingCount,
    attentionCount,
    statusCounts: {
      ...EMPTY_SUMMARY_STATUS_COUNTS,
      ...summary?.status_counts,
    },
    latestUnread: summary?.latest_unread ?? EMPTY_LATEST_TICKETS,
    latestAttention,
    isLoading: (!session && sessionQuery.isFetching) || summaryQuery.isLoading,
    error: sessionQuery.error ?? summaryQuery.error ?? null,
    isEnabled: enabled,
    isNotConfigured:
      sessionQuery.error instanceof SupportWorkerNotConfiguredError,
    refetch: () => {
      if (!enabled) return
      if (!session) {
        void sessionQuery.refetch()
        return
      }
      void summaryQuery.refetch()
    },
  }
}
