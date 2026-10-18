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
import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

export function PreviewNotice() {
  const { t } = useTranslation()

  return (
    <div
      className='text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'
      role='status'
    >
      <Badge variant='secondary' className='rounded-sm'>
        {t('Interface preview')}
      </Badge>
      <span>
        {t('Example layouts only. Live data and actions are not connected.')}
      </span>
    </div>
  )
}

export function MonitoringTimeRange(props: {
  value: string
  onValueChange: (value: string) => void
  intelligence?: boolean
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const { t } = useTranslation()
  const ranges = props.intelligence ? ['24h', '3d'] : ['1h', '24h', '7d']

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <Tabs
        value={props.value}
        onValueChange={(value) => props.onValueChange(String(value))}
      >
        <TabsList
          aria-label={t('Time range')}
          className='rounded-sm border p-0'
        >
          {ranges.map((range) => (
            <TabsTrigger
              key={range}
              value={range}
              className='h-full rounded-none px-2.5 text-xs'
            >
              {range}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <Button
        variant='outline'
        size='icon'
        className='rounded-sm'
        disabled={!props.onRefresh || props.refreshing}
        onClick={props.onRefresh}
        aria-label={
          props.onRefresh ? t('Refresh') : t('Refresh unavailable in preview')
        }
      >
        <HugeiconsIcon icon={RefreshIcon} aria-hidden='true' />
      </Button>
    </div>
  )
}

// These heights are a visual fixture, never a representation of live monitoring.
const exampleBars = [
  18, 24, 36, 34, 32, 28, 25, 30, 20, 16, 27, 34, 36, 35, 32, 31, 29, 33, 32,
  26, 22, 29, 35, 31, 20, 30, 25, 35, 32, 30, 34, 35, 29, 32, 28, 17,
].map((height, position) => ({ id: `sample-slot-${position + 1}`, height }))

export function ExampleTimeline(props: { compact?: boolean; range: string }) {
  const { t } = useTranslation()

  return (
    <figure className='min-w-0 space-y-1.5'>
      <figcaption className='text-muted-foreground flex flex-wrap items-center justify-between gap-1 text-[10px]'>
        <span>{t('Example timeline')}</span>
        <span>{t('Preview range: {{range}}', { range: props.range })}</span>
      </figcaption>
      <div
        className={cn(
          'flex items-end gap-0.5 overflow-hidden',
          props.compact ? 'h-8' : 'h-11'
        )}
        aria-hidden='true'
      >
        {exampleBars.map((bar) => (
          <span
            key={bar.id}
            className={cn(
              'min-w-0 flex-1 rounded-xs',
              bar.id === 'sample-slot-10' || bar.id === 'sample-slot-36'
                ? 'bg-amber-400/75'
                : 'bg-emerald-400/75 dark:bg-emerald-400/60'
            )}
            style={{ height: `${bar.height * (props.compact ? 2 : 2.5)}%` }}
          />
        ))}
      </div>
      <div className='text-muted-foreground flex justify-between text-[10px]'>
        <span>{t('Earlier')}</span>
        <span>{t('Now')}</span>
      </div>
    </figure>
  )
}
