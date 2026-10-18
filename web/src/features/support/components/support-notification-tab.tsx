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
import { CheckCheck, LifeBuoy, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

import { getSupportErrorMessage } from '../lib'
import { useSupportDateTimeFormat } from '../lib/use-support-date-format'
import type { SupportScope, SupportTicket } from '../types'
import { TicketStatusBadge } from './support-badges'

interface SupportNotificationTabProps {
  scope: SupportScope
  tickets: SupportTicket[]
  loading: boolean
  error: unknown
  onSelectTicket: (ticketId: number) => void
  onViewAll: () => void
}

/**
 * Notification popover tab listing tickets that need the viewer's attention
 * (unread updates for users, pending handling for support staff).
 */
export function SupportNotificationTab(props: SupportNotificationTabProps) {
  const { t } = useTranslation()
  const formatDateTime = useSupportDateTimeFormat()
  const { tickets, loading } = props

  let content: ReactNode
  if (loading && tickets.length === 0) {
    content = (
      <div className='text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm'>
        <Loader2 className='size-4 animate-spin' />
        {t('Loading...')}
      </div>
    )
  } else if (props.error) {
    content = (
      <div className='text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-1 p-4 text-center text-sm'>
        <LifeBuoy className='mb-1 size-5' />
        {getSupportErrorMessage(props.error, 'Failed to load tickets', t)}
      </div>
    )
  } else if (tickets.length === 0) {
    content = (
      <div className='text-muted-foreground flex min-h-48 flex-col items-center justify-center gap-1 p-4 text-center text-sm'>
        <CheckCheck className='mb-1 size-5' />
        {t('No tickets need your attention')}
      </div>
    )
  } else {
    content = (
      <ScrollArea className='h-[min(52vh,28rem)] pr-3'>
        <div className='flex flex-col'>
          {tickets.map((ticket, index) => (
            <div key={ticket.id}>
              <button
                type='button'
                onClick={() => props.onSelectTicket(ticket.id)}
                className='hover:bg-muted/50 w-full space-y-1.5 rounded-md p-2 text-left transition-colors'
              >
                <div className='flex items-start justify-between gap-2'>
                  <p className='line-clamp-2 text-sm font-medium'>
                    {ticket.title}
                  </p>
                  <TicketStatusBadge
                    status={ticket.status}
                    scope={props.scope}
                    className='h-4 shrink-0 px-1.5 text-[10px]'
                  />
                </div>
                {ticket.last_message_preview && (
                  <p className='text-muted-foreground line-clamp-2 text-xs'>
                    {ticket.last_message_preview}
                  </p>
                )}
                <p className='text-muted-foreground text-[11px]'>
                  {formatDateTime.format(new Date(ticket.updated_at))}
                </p>
              </button>
              {index < tickets.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  return (
    <div className='space-y-2'>
      {content}
      <div className='flex justify-end'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={props.onViewAll}
        >
          {t(
            props.scope === 'admin'
              ? 'Open Support Tickets'
              : 'Open Support Center'
          )}
        </Button>
      </div>
    </div>
  )
}
