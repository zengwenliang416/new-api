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
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestampToDate } from '@/lib/format'
import { getServerErrorMessage } from '@/lib/server-error-message'

import { PerformanceGroupCard } from './components/performance-group-card'
import { MonitoringTimeRange } from './components/preview-elements'
import { getPerformanceGroups, performanceStatus } from './performance-data'

export function PerformancePage() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [range, setRange] = useState('24h')
  const [group, setGroup] = useState('all')
  const [referenceRate, setReferenceRate] = useState('90')
  const hours = { '1h': 1, '24h': 24, '7d': 168 }[range] ?? 24
  const lang = i18n.resolvedLanguage || i18n.language
  const query = useQuery({
    queryKey: ['perf-metrics-groups', hours, lang],
    queryFn: ({ signal }) => getPerformanceGroups(hours, lang, signal),
    staleTime: 55_000,
    refetchInterval: 60_000,
    placeholderData: keepPreviousData,
    meta: { errorToast: false },
  })
  const groups = query.data?.groups ?? []
  const visibleGroups = groups.filter(
    (item) => group === 'all' || `group:${item.group}` === group
  )
  const referenceNumber = Number(referenceRate)
  const validReference =
    referenceRate.trim() !== '' &&
    Number.isFinite(referenceNumber) &&
    referenceNumber >= 0 &&
    referenceNumber <= 99.9
  const summaries = [
    { status: 'operational', label: t('Operational'), color: 'bg-emerald-500' },
    { status: 'degraded', label: t('Degraded'), color: 'bg-amber-500' },
    { status: 'unavailable', label: t('Unavailable'), color: 'bg-rose-500' },
    { status: 'nodata', label: t('No data'), color: 'bg-muted-foreground/50' },
  ]

  return (
    <SectionPageLayout stackActionsOnMobile>
      <SectionPageLayout.Title>{t('Performance')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <MonitoringTimeRange
          value={range}
          onValueChange={setRange}
          onRefresh={() => void query.refetch()}
          refreshing={query.isFetching}
        />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-5 pb-2'>
          <div className='flex flex-wrap items-center justify-between gap-2 text-xs'>
            <p className='text-muted-foreground'>
              {t('Availability and latency across model groups.')}
            </p>
            <span className='text-muted-foreground' role='status'>
              {t('Last updated')}:{' '}
              {query.dataUpdatedAt > 0
                ? formatTimestampToDate(query.dataUpdatedAt, 'milliseconds')
                : '—'}{' '}
              · {t('Auto refresh every 60 seconds')}
              {query.isFetching && ` · ${t('Refreshing...')}`}
            </span>
          </div>
          <div className='flex flex-wrap items-center justify-end gap-2'>
            <Select
              value={group}
              onValueChange={(value) => {
                if (value) setGroup(value)
              }}
              items={{
                all: t('All groups'),
                ...Object.fromEntries(
                  groups.map((item) => [
                    `group:${item.group}`,
                    item.name || item.group,
                  ])
                ),
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
                  {groups.map((item) => (
                    <SelectItem key={item.group} value={`group:${item.group}`}>
                      {item.name || item.group}
                    </SelectItem>
                  ))}
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
                  {t(
                    'Missing observations are shown as —. Input multipliers require at least 90% cost coverage and exclude output and tool charges.'
                  )}
                </p>
                <p className='text-muted-foreground'>
                  {t(
                    'The reference cache rate only changes this comparison. It does not change billing or model requests.'
                  )}
                </p>
              </div>
            </Dialog>
            <div className='flex items-center gap-2 text-xs'>
              <Label htmlFor='performance-reference-rate' className='text-xs'>
                {t('Reference cache rate')}
              </Label>
              <Input
                id='performance-reference-rate'
                type='number'
                min={0}
                max={99.9}
                step={0.1}
                value={referenceRate}
                onChange={(event) => setReferenceRate(event.target.value)}
                aria-invalid={!validReference}
                aria-describedby={
                  !validReference ? 'performance-reference-error' : undefined
                }
                className='w-20 rounded-sm'
              />
              <span>%</span>
            </div>
          </div>
          {!validReference && (
            <p
              id='performance-reference-error'
              className='text-destructive text-xs'
            >
              {t('Enter a reference cache rate from 0 to 99.9%.')}
            </p>
          )}
          {query.isPending && <LoadingState />}
          {query.isError && (
            <ErrorState
              title={t('Unable to load performance data')}
              description={getServerErrorMessage(query.error)}
              onRetry={() => void query.refetch()}
            />
          )}
          {query.data && (
            <>
              <div
                className='flex flex-wrap items-center gap-x-5 gap-y-2 text-xs'
                aria-label={t('Group status summary')}
              >
                {summaries.map((summary) => (
                  <span
                    key={summary.status}
                    className='inline-flex items-center gap-1.5'
                  >
                    <span
                      className={`size-1.5 rounded-full ${summary.color}`}
                      aria-hidden='true'
                    />
                    {formatNumber(
                      visibleGroups.filter(
                        (item) =>
                          performanceStatus(
                            item.request_count,
                            item.success_rate
                          ) === summary.status
                      ).length,
                      locale
                    )}{' '}
                    {summary.label}
                  </span>
                ))}
              </div>
              {visibleGroups.length === 0 ? (
                <EmptyState
                  title={t('No performance data')}
                  description={t(
                    'No requests were recorded for the selected groups and time range.'
                  )}
                />
              ) : (
                <div
                  className='grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2'
                  aria-label={t('Performance groups')}
                  aria-busy={query.isPlaceholderData}
                >
                  {visibleGroups.map((item) => (
                    <PerformanceGroupCard
                      key={item.group}
                      group={item}
                      startTs={query.data.start_ts}
                      endTs={query.data.end_ts}
                      referenceRate={
                        validReference ? referenceNumber : Number.NaN
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
