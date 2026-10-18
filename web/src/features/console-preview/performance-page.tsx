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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { PerformanceGroupCard } from './components/performance-group-card'
import {
  MonitoringTimeRange,
  PreviewNotice,
} from './components/preview-elements'

export function PerformancePage() {
  const { t } = useTranslation()
  const [range, setRange] = useState('24h')
  const [group, setGroup] = useState('all')
  const groups = [
    {
      id: 'standard',
      title: t('Standard models'),
      description: t('General conversation and everyday tasks'),
      models: ['example-chat-model', 'example-fast-model'],
      category: 'text',
    },
    {
      id: 'reasoning',
      title: t('Reasoning models'),
      description: t('Reasoning and complex problem solving'),
      models: ['example-reasoning-model'],
      category: 'text',
    },
    {
      id: 'coding',
      title: t('Coding models'),
      description: t('Code generation and development assistance'),
      models: ['example-coding-model'],
      category: 'text',
    },
    {
      id: 'image',
      title: t('Image models'),
      description: t('Image generation and visual tasks'),
      models: ['example-image-model'],
      category: 'image',
    },
  ]
  const visibleGroups = groups.filter(
    (item) => group === 'all' || item.category === group
  )

  return (
    <SectionPageLayout stackActionsOnMobile>
      <SectionPageLayout.Title>{t('Performance')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <MonitoringTimeRange value={range} onValueChange={setRange} />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-5 pb-2'>
          <div className='space-y-3'>
            <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
              <p className='text-muted-foreground'>
                {t('Availability and latency across model groups.')}
              </p>
              <span className='text-muted-foreground'>
                {t('Last updated')}: — · {t('Auto refresh paused')}
              </span>
            </div>
            <PreviewNotice />
          </div>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <Select
              value={group}
              onValueChange={(value) => {
                if (value) setGroup(value)
              }}
              items={{
                all: t('All groups'),
                text: t('Text models'),
                image: t('Image models'),
              }}
            >
              <SelectTrigger
                aria-label={t('Model group filter')}
                className='w-full rounded-sm sm:w-48'
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value='all'>{t('All groups')}</SelectItem>
                  <SelectItem value='text'>{t('Text models')}</SelectItem>
                  <SelectItem value='image'>{t('Image models')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Dialog
              title={t('Cache statistics explained')}
              trigger={
                <Button variant='ghost' className='rounded-sm text-xs'>
                  {t('Cache statistics explained')}
                </Button>
              }
            >
              <div className='space-y-3 text-sm'>
                <p>
                  {t(
                    'Cache hit rate compares cached input with total input. Coding cache is shown separately for coding traffic.'
                  )}
                </p>
                <p className='text-muted-foreground'>
                  {t('This preview has no cache statistics or pricing data.')}
                </p>
              </div>
            </Dialog>
            <span className='border px-3 py-1.5 text-xs'>
              {t('Reference cache rate')}: —
            </span>
          </div>
          <div
            className='flex flex-wrap items-center gap-x-5 gap-y-2 text-xs'
            aria-label={t('Group status summary')}
          >
            <span className='inline-flex items-center gap-1.5'>
              <span
                className='size-1.5 rounded-full bg-emerald-500'
                aria-hidden='true'
              />
              — {t('Operational')}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <span
                className='size-1.5 rounded-full bg-amber-500'
                aria-hidden='true'
              />
              — {t('Degraded')}
            </span>
            <span className='inline-flex items-center gap-1.5'>
              <span
                className='size-1.5 rounded-full bg-rose-500'
                aria-hidden='true'
              />
              — {t('Unavailable')}
            </span>
            <span className='text-muted-foreground inline-flex items-center gap-1.5'>
              <span
                className='bg-muted-foreground/50 size-1.5 rounded-full'
                aria-hidden='true'
              />
              — {t('No data')}
            </span>
          </div>
          <div
            className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2'
            aria-label={t('Performance group previews')}
          >
            {visibleGroups.map((item) => (
              <PerformanceGroupCard
                key={item.id}
                title={item.title}
                description={item.description}
                models={item.models}
                range={range}
              />
            ))}
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
