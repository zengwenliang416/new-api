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
import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

import { SUPPORT_SORT_VALUES, SUPPORT_STATUS_VALUES } from '../constants'
import {
  getMessageSenderName,
  getSupportErrorMessage,
  getTicketCategoryLabel,
  getTicketPriorityLabel,
  getTicketSortLabel,
  getTicketStatusLabel,
  getTicketVerificationLabel,
} from '../lib'
import { useSupportDateTimeFormat } from '../lib/use-support-date-format'
import type {
  SupportPageSearch,
  SupportScope,
  SupportTicket,
  SupportTicketPage,
  TicketStatusFilter,
} from '../types'
import {
  TicketCategoryBadge,
  TicketStatusBadge,
  TicketVerificationBadge,
} from './support-badges'

interface TicketListProps {
  scope: SupportScope
  pages: SupportTicketPage[] | undefined
  statusCounts: Record<'open' | 'pending' | 'closed', number>
  unreadCount: number
  filters: SupportPageSearch
  activeTicketId?: number
  isLoading: boolean
  error: unknown
  hasNextPage: boolean
  isFetchingNextPage: boolean
  onRetry: () => void
  onLoadMore: () => void
  onSelect: (ticketId: number) => void
  onStatusChange: (status: TicketStatusFilter) => void
  onClearFilters: () => void
}

function buildFilterChips(
  filters: SupportPageSearch,
  scope: SupportScope,
  t: (key: string) => string
): string[] {
  const chips: string[] = []
  if (filters.status && filters.status !== 'all') {
    chips.push(t(getTicketStatusLabel(filters.status, scope)))
  }
  if (filters.category && filters.category !== 'all') {
    chips.push(t(getTicketCategoryLabel(filters.category)))
  }
  if (filters.priority && filters.priority !== 'all') {
    chips.push(t(getTicketPriorityLabel(filters.priority)))
  }
  if (filters.verification && filters.verification !== 'all') {
    chips.push(t(getTicketVerificationLabel(filters.verification)))
  }
  if (filters.unread) chips.push(t('Unread only'))
  if (filters.q?.trim()) chips.push(`“${filters.q.trim()}”`)
  if (filters.user_id) chips.push(`${t('User')} #${filters.user_id}`)
  if (filters.sort && SUPPORT_SORT_VALUES.includes(filters.sort)) {
    chips.push(t(getTicketSortLabel(filters.sort)))
  }
  return chips
}

export function TicketList(props: TicketListProps) {
  const { t } = useTranslation()
  const formatDateTime = useSupportDateTimeFormat()
  const [showAllChips, setShowAllChips] = useState(false)
  const { scope } = props

  const tickets = (props.pages ?? []).flatMap((page) => page.items ?? [])
  const chips = buildFilterChips(props.filters, scope, t)
  const visibleChips = showAllChips ? chips : chips.slice(0, 4)
  const hiddenChipCount = chips.length - visibleChips.length
  const totalCount =
    props.statusCounts.open +
    props.statusCounts.pending +
    props.statusCounts.closed

  const statusCount = (status: TicketStatusFilter): number => {
    if (status === 'all') return totalCount
    return props.statusCounts[status] ?? 0
  }

  const isUnread = (ticket: SupportTicket) =>
    scope === 'admin' ? ticket.unread_admin : ticket.unread_user

  let listContent: ReactNode
  if (props.isLoading) {
    listContent = (
      <div className='space-y-2'>
        {Array.from({ length: 6 }, (_, index) => `skeleton-${index}`).map(
          (skeletonId) => (
            <Skeleton key={skeletonId} className='h-20 rounded-lg' />
          )
        )}
      </div>
    )
  } else if (props.error) {
    listContent = (
      <Alert variant='destructive' className='m-2'>
        <AlertTitle>{t('Failed to load tickets')}</AlertTitle>
        <AlertDescription className='space-y-2'>
          <p>
            {getSupportErrorMessage(props.error, 'Failed to load tickets', t)}
          </p>
          <Button
            type='button'
            size='xs'
            variant='outline'
            onClick={props.onRetry}
          >
            {t('Retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  } else if (tickets.length === 0) {
    listContent = (
      <EmptyState
        icon={Inbox}
        title={t('No tickets found')}
        description={
          chips.length > 0
            ? t('No tickets match the current filters.')
            : t(
                scope === 'admin'
                  ? 'No tickets in the queue.'
                  : 'You have not created any tickets yet.'
              )
        }
        className='min-h-60'
      />
    )
  } else {
    listContent = (
      <div className='space-y-1.5'>
        {tickets.map((ticket) => {
          const active = ticket.id === props.activeTicketId
          const unread = isUnread(ticket)
          return (
            <button
              key={ticket.id}
              type='button'
              onClick={() => props.onSelect(ticket.id)}
              className={cn(
                'w-full rounded-lg border p-2.5 text-left transition-colors',
                active ? 'border-primary/40 bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <div className='flex items-start justify-between gap-2'>
                <p
                  className={cn(
                    'line-clamp-2 text-sm',
                    unread ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {ticket.title}
                </p>
                {unread && (
                  <Badge className='h-4 shrink-0 px-1.5 text-[10px]'>
                    {t('Unread')}
                  </Badge>
                )}
              </div>
              <div className='mt-1.5 flex flex-wrap gap-1'>
                <TicketStatusBadge
                  status={ticket.status}
                  scope={scope}
                  className='h-4 px-1.5 text-[10px]'
                />
                <TicketCategoryBadge
                  category={ticket.category}
                  className='h-4 px-1.5 text-[10px]'
                />
                <TicketVerificationBadge
                  level={ticket.verification_level}
                  className='h-4 px-1.5 text-[10px]'
                />
              </div>
              {ticket.last_message_preview && (
                <p className='text-muted-foreground mt-1.5 line-clamp-2 text-xs'>
                  {ticket.last_message_sender_type
                    ? `${getMessageSenderName(
                        {
                          sender_type: ticket.last_message_sender_type,
                          display_name: ticket.display_name,
                          username: ticket.username,
                        },
                        scope,
                        t
                      )}: `
                    : ''}
                  {ticket.last_message_preview}
                </p>
              )}
              <div className='text-muted-foreground mt-1.5 flex items-center justify-between gap-2 text-[11px]'>
                <span className='truncate'>
                  {ticket.display_name || ticket.username || t('User')}
                </span>
                <span className='shrink-0'>
                  {formatDateTime.format(new Date(ticket.updated_at))}
                </span>
              </div>
            </button>
          )
        })}
        {props.hasNextPage && (
          <div className='flex justify-center py-2'>
            <Button
              type='button'
              size='sm'
              variant='outline'
              disabled={props.isFetchingNextPage}
              onClick={props.onLoadMore}
            >
              {props.isFetchingNextPage && (
                <Loader2 className='animate-spin' data-icon='inline-start' />
              )}
              {t('Load more')}
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='bg-card flex h-full min-h-0 flex-col rounded-xl border'>
      <div className='flex items-center justify-between gap-2 border-b px-3 py-2.5'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span className='truncate text-sm font-semibold'>
            {t(scope === 'admin' ? 'Queue' : 'My tickets')}
          </span>
          {props.unreadCount > 0 && (
            <Badge className='h-4 px-1.5 text-[10px]'>
              {props.unreadCount}
            </Badge>
          )}
        </div>
        <span className='text-muted-foreground text-xs'>{totalCount}</span>
      </div>

      <div className='flex flex-wrap gap-1.5 border-b px-3 py-2'>
        {SUPPORT_STATUS_VALUES.map((status) => {
          const active = (props.filters.status ?? 'all') === status
          const attention =
            (status === 'open' && scope === 'admin') ||
            (status === 'pending' && scope === 'user')
          return (
            <button
              key={status}
              type='button'
              onClick={() => props.onStatusChange(status)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition-colors',
                active
                  ? 'border-primary/50 bg-primary/10 text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60'
              )}
            >
              <span
                className={cn(
                  'size-1.5 rounded-full',
                  status === 'open' && 'bg-warning',
                  status === 'pending' && 'bg-info',
                  status === 'closed' && 'bg-success',
                  status === 'all' && 'bg-muted-foreground/50'
                )}
              />
              {t(getTicketStatusLabel(status, scope))}
              <span className='text-muted-foreground tabular-nums'>
                {statusCount(status)}
              </span>
              {attention && statusCount(status) > 0 && (
                <AlertCircle className='text-warning size-3' />
              )}
            </button>
          )
        })}
      </div>

      {chips.length > 0 && (
        <div className='flex flex-wrap items-center gap-1.5 border-b px-3 py-2'>
          {visibleChips.map((chip) => (
            <Badge
              key={chip}
              variant='secondary'
              className='text-muted-foreground max-w-40 truncate text-[10px]'
            >
              {chip}
            </Badge>
          ))}
          {hiddenChipCount > 0 && (
            <button
              type='button'
              className='text-muted-foreground text-xs hover:underline'
              onClick={() => setShowAllChips(true)}
            >
              {t('+{{count}} more', { count: hiddenChipCount })}
            </button>
          )}
          <Button
            type='button'
            size='xs'
            variant='ghost'
            onClick={props.onClearFilters}
          >
            {t('Clear')}
          </Button>
        </div>
      )}

      <div className='min-h-0 flex-1 overflow-y-auto p-2'>{listContent}</div>
    </div>
  )
}
