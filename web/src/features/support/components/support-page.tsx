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
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import { MessagesSquare, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { readStatusField, statusQueryOptions } from '@/lib/status-query'

import {
  createSupportTicket,
  isSupportTokenError,
  listSupportTickets,
} from '../api'
import {
  DEFAULT_TICKET_SORT,
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_DATA_REFETCH_MS,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_SEARCH_DEBOUNCE_MS,
  SUPPORT_SORT_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
  SUPPORT_VERIFICATION_OPTIONS,
} from '../constants'
import {
  SUPPORT_SESSION_QUERY_KEY,
  SUPPORT_SUMMARY_QUERY_KEY,
  SUPPORT_TICKETS_QUERY_KEY,
  SUPPORT_TICKET_QUERY_KEY,
  useSupportSession,
} from '../hooks/use-support-session'
import {
  getSupportErrorMessage,
  normalizeUserIdInput,
  toWorkerLanguage,
} from '../lib'
import type {
  SupportPageSearch,
  SupportScope,
  SupportTicketCreatePayload,
  SupportTicketDetail,
  SupportTicketPage,
  TicketCategoryFilter,
  TicketPriorityFilter,
  TicketSort,
  TicketStatusFilter,
  TicketVerificationFilter,
} from '../types'
import { CreateTicketForm } from './create-ticket-form'
import { TicketDetail } from './ticket-detail'
import { TicketList } from './ticket-list'

interface SupportPageProps {
  scope: SupportScope
  search: SupportPageSearch
  onSearchChange: (next: SupportPageSearch) => void
}

export function SupportPage(props: SupportPageProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { scope, search } = props
  const viewerLang = toWorkerLanguage(i18n.language)

  const searchRef = useRef(search)
  searchRef.current = search
  const onSearchChangeRef = useRef(props.onSearchChange)
  onSearchChangeRef.current = props.onSearchChange

  const [creating, setCreating] = useState(false)
  const [qInput, setQInput] = useState(search.q ?? '')
  const [userIdInput, setUserIdInput] = useState(search.user_id ?? '')

  const {
    session,
    statusCounts,
    unreadCount,
    refetch: refetchSummary,
  } = useSupportSession(scope)

  const statusQuery = useQuery(statusQueryOptions)
  const translationEnabled =
    readStatusField(statusQuery.data, 'ticket_translation_enabled') === true

  const status = search.status ?? 'all'
  const category = search.category ?? 'all'
  const priority = search.priority ?? 'all'
  const verification = search.verification ?? 'all'
  const sort = search.sort ?? DEFAULT_TICKET_SORT
  const unread = search.unread ?? false
  const userId = search.user_id ?? ''
  const selectedId = resolveTicketId(search.ticket)

  const ticketsQuery = useInfiniteQuery({
    queryKey: [
      ...SUPPORT_TICKETS_QUERY_KEY,
      scope,
      status,
      category,
      priority,
      verification,
      sort,
      unread,
      search.q ?? '',
      userId,
      session?.token,
    ],
    queryFn: ({ pageParam }) => {
      if (!session) {
        throw new Error('Support session is not available')
      }
      return listSupportTickets(session, {
        scope,
        status,
        category,
        priority,
        verification,
        sort,
        unread,
        q: search.q,
        user_id: userId ? Number(userId) : null,
        cursor: pageParam,
      })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    enabled: !!session,
    refetchInterval: SUPPORT_DATA_REFETCH_MS,
    retry: false,
  })

  useEffect(() => {
    const next = search.q ?? ''
    setQInput((current) => (current === next ? current : next))
  }, [search.q])

  useEffect(() => {
    setUserIdInput(search.user_id ?? '')
  }, [search.user_id])

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = searchRef.current
      const trimmed = qInput.trim()
      if (trimmed !== (current.q ?? '')) {
        onSearchChangeRef.current({
          ...current,
          q: trimmed || undefined,
        })
      }
    }, SUPPORT_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [qInput])

  useEffect(() => {
    if (isSupportTokenError(ticketsQuery.error)) {
      queryClient.removeQueries({ queryKey: SUPPORT_SESSION_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
    }
  }, [queryClient, ticketsQuery.error])

  const handleTicketData = (detail: SupportTicketDetail) => {
    queryClient.setQueriesData<InfiniteData<SupportTicketPage>>(
      { queryKey: SUPPORT_TICKETS_QUERY_KEY },
      (current) => {
        if (!current) return current
        return {
          ...current,
          pages: current.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item.id === detail.ticket.id ? detail.ticket : item
            ),
          })),
        }
      }
    )
    queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
  }

  const createMutation = useMutation({
    mutationFn: async (payload: SupportTicketCreatePayload) => {
      if (!session) {
        throw new Error('Support session is not available')
      }
      return createSupportTicket(session, payload)
    },
    onSuccess: (result) => {
      toast.success(t('Ticket created'))
      setCreating(false)
      queryClient.setQueryData(
        [
          ...SUPPORT_TICKET_QUERY_KEY,
          scope,
          result.ticket.id,
          session?.token,
          viewerLang,
        ],
        result
      )
      queryClient.invalidateQueries({ queryKey: SUPPORT_TICKETS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
      onSearchChangeRef.current({
        ...searchRef.current,
        ticket: String(result.ticket.id),
      })
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Failed to create ticket', t))
    },
  })

  const patchSearch = (next: Partial<SupportPageSearch>) => {
    props.onSearchChange({ ...search, ...next })
  }

  const refresh = () => {
    void ticketsQuery.refetch()
    queryClient.invalidateQueries({ queryKey: SUPPORT_TICKET_QUERY_KEY })
    refetchSummary()
  }

  let detailPane: ReactNode
  if (creating && session) {
    detailPane = (
      <CreateTicketForm
        session={session}
        isSubmitting={createMutation.isPending}
        onCancel={() => setCreating(false)}
        onSubmit={async (payload) => {
          await createMutation.mutateAsync(payload)
        }}
      />
    )
  } else if (selectedId && session) {
    detailPane = (
      <TicketDetail
        scope={scope}
        ticketId={selectedId}
        session={session}
        translationEnabled={translationEnabled}
        onDeleted={() => patchSearch({ ticket: undefined })}
        onTicketData={handleTicketData}
      />
    )
  } else {
    detailPane = (
      <div className='bg-card flex h-full min-h-0 items-center justify-center rounded-xl border'>
        <EmptyState
          icon={MessagesSquare}
          title={t('No ticket selected')}
          description={t(
            'Choose a ticket from the list to view the conversation.'
          )}
          action={
            scope === 'user' ? (
              <Button type='button' size='sm' onClick={() => setCreating(true)}>
                <Plus data-icon='inline-start' />
                {t('New ticket')}
              </Button>
            ) : undefined
          }
          className='min-h-0 border-0'
        />
      </div>
    )
  }

  return (
    <SectionPageLayout fixedContent stackActionsOnMobile>
      <SectionPageLayout.Title>
        {t(scope === 'admin' ? 'Support Tickets' : 'Support Center')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <div className='flex flex-wrap items-center gap-2'>
          <Input
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder={t('Search tickets')}
            className='w-44'
            maxLength={120}
          />
          <Select
            value={status}
            onValueChange={(value) =>
              patchSearch({
                status:
                  value === 'all' ? undefined : (value as TicketStatusFilter),
              })
            }
          >
            <SelectTrigger size='sm' className='w-36'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scope === 'admin' && (
            <>
              <Select
                value={sort}
                onValueChange={(value) =>
                  patchSearch({
                    sort:
                      value === DEFAULT_TICKET_SORT
                        ? undefined
                        : (value as TicketSort),
                  })
                }
              >
                <SelectTrigger size='sm' className='w-40'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={category}
                onValueChange={(value) =>
                  patchSearch({
                    category:
                      value === 'all'
                        ? undefined
                        : (value as TicketCategoryFilter),
                  })
                }
              >
                <SelectTrigger size='sm' className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={priority}
                onValueChange={(value) =>
                  patchSearch({
                    priority:
                      value === 'all'
                        ? undefined
                        : (value as TicketPriorityFilter),
                  })
                }
              >
                <SelectTrigger size='sm' className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={verification}
                onValueChange={(value) =>
                  patchSearch({
                    verification:
                      value === 'all'
                        ? undefined
                        : (value as TicketVerificationFilter),
                  })
                }
              >
                <SelectTrigger size='sm' className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORT_VERIFICATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={userIdInput}
                onChange={(event) =>
                  setUserIdInput(normalizeUserIdInput(event.target.value))
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  const next = normalizeUserIdInput(userIdInput)
                  patchSearch({ user_id: next || undefined })
                }}
                onBlur={() => {
                  const next = normalizeUserIdInput(userIdInput)
                  if (next !== (search.user_id ?? '')) {
                    patchSearch({ user_id: next || undefined })
                  }
                }}
                placeholder={t('User ID')}
                className='w-28'
                inputMode='numeric'
              />
            </>
          )}
          <Button
            type='button'
            size='sm'
            variant={unread ? 'secondary' : 'ghost'}
            onClick={() => patchSearch({ unread: unread ? undefined : true })}
          >
            {t('Unread only')}
          </Button>
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={t('Refresh')}
            onClick={refresh}
          >
            <RefreshCw
              className={ticketsQuery.isFetching ? 'animate-spin' : undefined}
            />
          </Button>
          {scope === 'user' && !creating && (
            <Button type='button' size='sm' onClick={() => setCreating(true)}>
              <Plus data-icon='inline-start' />
              {t('New ticket')}
            </Button>
          )}
        </div>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='grid h-full min-h-0 grid-rows-[minmax(14rem,40vh)_minmax(0,1fr)] gap-3 md:grid-cols-[minmax(17rem,24rem)_minmax(0,1fr)] md:grid-rows-1 2xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]'>
          <div className='min-h-0'>
            <TicketList
              scope={scope}
              pages={ticketsQuery.data?.pages}
              statusCounts={statusCounts}
              unreadCount={unreadCount}
              filters={search}
              activeTicketId={selectedId ?? undefined}
              isLoading={ticketsQuery.isLoading}
              error={ticketsQuery.error}
              hasNextPage={ticketsQuery.hasNextPage}
              isFetchingNextPage={ticketsQuery.isFetchingNextPage}
              onRetry={() => void ticketsQuery.refetch()}
              onLoadMore={() => void ticketsQuery.fetchNextPage()}
              onSelect={(ticketId) => patchSearch({ ticket: String(ticketId) })}
              onStatusChange={(next) =>
                patchSearch({
                  status: next === 'all' ? undefined : next,
                })
              }
              onClearFilters={() =>
                patchSearch({
                  status: undefined,
                  category: undefined,
                  priority: undefined,
                  verification: undefined,
                  sort: undefined,
                  unread: undefined,
                  q: undefined,
                  user_id: undefined,
                })
              }
            />
          </div>
          <div className='min-h-0'>{detailPane}</div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function resolveTicketId(value?: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}
