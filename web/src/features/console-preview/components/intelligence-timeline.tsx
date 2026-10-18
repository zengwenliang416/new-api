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
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { ProbeSlot, ProbeStatus } from '../intelligence-types'

const statusClasses = {
  pass: 'bg-emerald-500/80',
  fail: 'bg-rose-500/80',
  error: 'bg-amber-500/80',
  running: 'bg-sky-500/80',
  empty: 'bg-muted-foreground/20',
}

export function ProbeStatusBadge(props: { status?: ProbeStatus }) {
  const { t } = useTranslation()
  const labels = {
    pass: t('Passed'),
    fail: t('Failed'),
    error: t('Request failed'),
    running: t('Checking'),
    empty: t('No data'),
  }
  return (
    <Badge variant='outline' className='gap-1.5'>
      <span
        aria-hidden='true'
        className={cn(
          'size-2 rounded-xs',
          statusClasses[props.status ?? 'empty']
        )}
      />
      {labels[props.status ?? 'empty']}
    </Badge>
  )
}

export function IntelligenceTimeline(props: {
  slots: ProbeSlot[]
  label: string
  onSelect: (slot: ProbeSlot) => void
  selectedRunId?: number
}) {
  const { t } = useTranslation()
  const labels = {
    pass: t('Passed'),
    fail: t('Failed'),
    error: t('Request failed'),
    running: t('Checking'),
    empty: t('No data'),
  }
  if (props.slots.length === 0) {
    return (
      <p className='text-muted-foreground py-2 text-xs'>{t('No checks yet')}</p>
    )
  }

  return (
    <figure className='min-w-0 space-y-2' aria-label={props.label}>
      <div className='flex min-w-0 gap-0.5 overflow-x-auto pb-1'>
        {props.slots.map((slot) => {
          const status = slot.run_id ? (slot.status ?? 'empty') : 'empty'
          const label = `${formatTimestamp(slot.started_at || slot.ts)} · ${labels[status]}`
          return (
            <Tooltip key={`${slot.ts}-${slot.run_id ?? 'empty'}`}>
              <TooltipTrigger
                render={
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    disabled={!slot.run_id || status === 'running'}
                    aria-label={label}
                    aria-pressed={
                      slot.run_id
                        ? props.selectedRunId === slot.run_id
                        : undefined
                    }
                    onClick={() => props.onSelect(slot)}
                    className={cn(
                      'h-8 min-w-2 flex-1 rounded-xs p-0 disabled:opacity-100',
                      statusClasses[status],
                      props.selectedRunId &&
                        props.selectedRunId === slot.run_id &&
                        'ring-foreground ring-2 ring-inset'
                    )}
                  />
                }
              />
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      <figcaption className='text-muted-foreground flex justify-between text-[10px]'>
        <span>{formatTimestamp(props.slots[0].ts)}</span>
        <span>{t('Now')}</span>
      </figcaption>
    </figure>
  )
}
