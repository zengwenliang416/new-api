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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  codingInputMultipliers,
  compactPerformanceSeries,
  performanceStatus,
  type PerformanceGroup,
} from '../performance-data'

const statusColors = {
  operational: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unavailable: 'bg-rose-500',
  nodata: 'bg-muted-foreground/30',
}

export function PerformanceGroupCard(props: {
  group: PerformanceGroup
  startTs: number
  endTs: number
  referenceRate: number
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const group = props.group
  const statusLabels = {
    operational: t('Operational'),
    degraded: t('Degraded'),
    unavailable: t('Unavailable'),
    nodata: t('No data'),
  }
  const status = performanceStatus(group.request_count, group.success_rate)
  const series = useMemo(
    () => compactPerformanceSeries(group.series ?? []),
    [group.series]
  )
  const multipliers = useMemo(
    () => codingInputMultipliers(group.models ?? [], props.referenceRate),
    [group.models, props.referenceRate]
  )

  return (
    <Card
      className='min-w-0 gap-3 rounded-none shadow-none'
      role='article'
      aria-label={group.name || group.group}
    >
      <CardHeader className='gap-1.5'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='text-primary min-w-0 text-sm font-semibold break-words'>
            {group.name || group.group}
          </CardTitle>
          <Badge variant='outline' className='gap-1.5'>
            <span
              className={cn('size-1.5 rounded-full', statusColors[status])}
              aria-hidden='true'
            />
            {statusLabels[status]}
          </Badge>
        </div>
        <p className='text-muted-foreground text-xs'>{group.description}</p>
      </CardHeader>
      <CardContent className='min-w-0 space-y-3'>
        <dl className='grid grid-cols-3 gap-2'>
          {[
            {
              label: t('Latency'),
              value:
                group.request_count > 0
                  ? `${formatNumber(group.avg_latency_ms, locale)} ms`
                  : '—',
            },
            {
              label: 'TTFT',
              value:
                group.avg_ttft_ms > 0
                  ? `${formatNumber(group.avg_ttft_ms, locale)} ms`
                  : '—',
            },
            {
              label: 'TPS',
              value:
                group.avg_tps > 0 ? formatNumber(group.avg_tps, locale) : '—',
            },
          ].map((metric) => (
            <div key={metric.label} className='bg-muted/45 min-w-0 px-2.5 py-2'>
              <dt className='text-muted-foreground text-[10px]'>
                {metric.label}
              </dt>
              <dd className='mt-1 font-mono text-sm font-semibold'>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className='bg-muted/45 flex flex-wrap items-center justify-between gap-2 p-3'>
          <div>
            <p className='text-xs font-medium'>{t('Availability')}</p>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('Successful requests')}:{' '}
              {formatNumber(group.success_count, locale)} /{' '}
              {formatNumber(group.request_count, locale)}
            </p>
          </div>
          <p className='font-mono text-2xl font-semibold tracking-tight'>
            {group.request_count > 0
              ? formatNumber(group.success_rate, locale)
              : '—'}
            <span className='text-muted-foreground ml-1 text-sm'>%</span>
          </p>
        </div>
        <figure className='min-w-0 space-y-1.5'>
          <figcaption className='text-muted-foreground text-[10px]'>
            {t('Request availability over time')}
          </figcaption>
          <div
            className='flex h-11 items-end gap-0.5 overflow-hidden'
            role='list'
            aria-label={t('Availability timeline')}
          >
            {series.map((bucket) => {
              const bucketStatus = performanceStatus(
                bucket.request_count,
                bucket.success_rate
              )
              const label = `${formatTimestamp(bucket.ts)} · ${statusLabels[bucketStatus]} · ${t('Requests')}: ${formatNumber(bucket.request_count, locale)}`
              return (
                <span
                  key={bucket.ts}
                  role='listitem'
                  aria-label={label}
                  title={label}
                  className={cn(
                    'h-full min-w-0 flex-1 rounded-xs',
                    statusColors[bucketStatus]
                  )}
                />
              )
            })}
            {series.length === 0 && (
              <span className='text-muted-foreground text-xs'>
                {t('No data')}
              </span>
            )}
          </div>
          <div className='text-muted-foreground flex flex-wrap justify-between gap-1 text-[10px]'>
            <span>{formatTimestamp(props.startTs)}</span>
            <span>{formatTimestamp(props.endTs)}</span>
          </div>
        </figure>
        <Separator />
        <dl className='grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4'>
          {[
            {
              label: t('Cache hit rate'),
              value: group.cache_observed
                ? `${formatNumber(group.cache_hit_rate, locale)}%`
                : '—',
            },
            {
              label: t('Coding cache'),
              value: group.coding_cache_observed
                ? `${formatNumber(group.coding_cache_hit_rate, locale)}%`
                : '—',
            },
            {
              label: t('Input multiplier'),
              value:
                multipliers.input === null
                  ? '—'
                  : `${formatNumber(multipliers.input, locale)}×`,
            },
            {
              label: t('Reference multiplier'),
              value:
                multipliers.reference === null
                  ? '—'
                  : `${formatNumber(multipliers.reference, locale)}×`,
            },
          ].map((metric) => (
            <div key={metric.label} className='min-w-0'>
              <dt className='text-muted-foreground text-[11px]'>
                {metric.label}
              </dt>
              <dd className='mt-1 font-mono text-sm font-semibold'>
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <span className='text-muted-foreground text-xs'>
            {t('Model traffic')}: {formatNumber(group.request_count, locale)}
          </span>
          <Dialog
            title={t('Model traffic')}
            description={group.name || group.group}
            contentClassName='sm:max-w-4xl'
            trigger={
              <Button variant='ghost' size='sm' className='text-xs'>
                {t('View models')}
              </Button>
            }
          >
            {group.models?.length ? (
              <StaticDataTable
                tableProps={{ 'aria-label': t('Model traffic') }}
                data={group.models}
                getRowKey={(model) => model.model_name}
                columns={[
                  {
                    id: 'model',
                    header: t('Model'),
                    className: 'min-w-40',
                    cell: (model) => model.model_name,
                  },
                  {
                    id: 'requests',
                    header: t('Requests'),
                    cell: (model) => formatNumber(model.request_count, locale),
                  },
                  {
                    id: 'availability',
                    header: t('Availability'),
                    cell: (model) =>
                      model.request_count > 0
                        ? `${formatNumber(model.success_rate, locale)}%`
                        : '—',
                  },
                  {
                    id: 'latency',
                    header: t('Latency'),
                    cell: (model) =>
                      model.request_count > 0
                        ? `${formatNumber(model.avg_latency_ms, locale)} ms`
                        : '—',
                  },
                  {
                    id: 'ttft',
                    header: 'TTFT',
                    cell: (model) =>
                      model.avg_ttft_ms > 0
                        ? `${formatNumber(model.avg_ttft_ms, locale)} ms`
                        : '—',
                  },
                  {
                    id: 'tps',
                    header: 'TPS',
                    cell: (model) =>
                      model.avg_tps > 0
                        ? formatNumber(model.avg_tps, locale)
                        : '—',
                  },
                  {
                    id: 'cache',
                    header: t('Cache hit rate'),
                    cell: (model) =>
                      model.cache_observed
                        ? `${formatNumber(model.cache_hit_rate, locale)}%`
                        : '—',
                  },
                  {
                    id: 'coding-cache',
                    header: t('Coding cache'),
                    cell: (model) =>
                      model.coding_cache_observed
                        ? `${formatNumber(model.coding_cache_hit_rate, locale)}%`
                        : '—',
                  },
                ]}
              />
            ) : (
              <EmptyState title={t('No data')} />
            )}
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
