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
import { ArtificialIntelligence02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { SectionPageLayout } from '@/components/layout'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useIsAdmin } from '@/hooks/use-admin'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestamp } from '@/lib/format'

import { IntelligenceGroupCard } from './components/intelligence-group-card'
import { IntelligenceRunDialog } from './components/intelligence-run-dialog'
import { ProbeStatusBadge } from './components/intelligence-timeline'
import { MonitoringTimeRange } from './components/preview-elements'
import { getProbeOverview, startProbe } from './intelligence-api'
import { probeQualityRate } from './intelligence-types'

export function IntelligencePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  const locale = toIntlLocale(lang)
  const isAdmin = useIsAdmin()
  const queryClient = useQueryClient()
  const [range, setRange] = useState('24h')
  const [selectedRun, setSelectedRun] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now)
  const hours = range === '3d' ? 72 : 24
  const overview = useQuery({
    meta: { errorRedirect: false },
    queryKey: ['model-probe-overview', hours, lang],
    queryFn: ({ signal }) => getProbeOverview(hours, lang, signal),
    staleTime: 25000,
    refetchInterval: 30000,
  })
  const run = useMutation({
    mutationFn: startProbe,
    onSuccess: (data) => {
      toast.success(
        data.created
          ? t('Checks queued')
          : t('A check is already queued or running')
      )
      void queryClient.invalidateQueries({ queryKey: ['model-probe-overview'] })
    },
  })
  const data = overview.data

  useEffect(() => {
    if (!data?.enabled) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [data?.enabled])

  useEffect(() => {
    if (!run.data) return
    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['model-probe-overview'] })
    }, 3000)
    return () => window.clearTimeout(timer)
  }, [run.data, queryClient])

  const targets = data?.targets ?? []
  let healthy = 0
  let degraded = 0
  let passed = 0
  let failed = 0
  let errors = 0
  const hasMath = targets.some((target) => target.kinds.includes('math'))
  for (const target of targets) {
    const healthStats = target.kinds.includes('math')
      ? target.math
      : target.drawing
    const qualityRate = probeQualityRate(healthStats)
    if (qualityRate !== null && qualityRate >= 90) healthy++
    if (qualityRate !== null && qualityRate < 90) degraded++
    if (hasMath && !target.kinds.includes('math')) continue
    const stats = hasMath ? target.math : target.drawing
    passed += stats.pass
    failed += stats.fail
    errors += stats.error
  }
  const passRate = probeQualityRate({ pass: passed, fail: failed })
  const serverNow =
    (data?.server_now ?? 0) +
    Math.max(0, Math.floor((now - overview.dataUpdatedAt) / 1000))
  const secondsUntilNext = Math.max(0, (data?.next_run_ts ?? 0) - serverNow)
  const running = targets.some(
    (target) =>
      target.math.latest?.status === 'running' ||
      target.drawing.latest?.status === 'running'
  )
  let nextCheck = '—'
  if (data?.enabled && data.next_run_ts > 0) {
    nextCheck = `${Math.floor(secondsUntilNext / 60)}:${String(secondsUntilNext % 60).padStart(2, '0')}`
  }

  return (
    <SectionPageLayout stackActionsOnMobile>
      <SectionPageLayout.Title>
        {t('Intelligence monitoring')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <MonitoringTimeRange
          value={range}
          onValueChange={setRange}
          intelligence
          onRefresh={() => void overview.refetch()}
          refreshing={overview.isFetching}
        />
        {isAdmin && (
          <Button
            variant='outline'
            size='sm'
            disabled={
              !data?.enabled || targets.length === 0 || run.isPending || running
            }
            onClick={() => run.mutate()}
          >
            {run.isPending || running ? t('Checking') : t('Check now')}
          </Button>
        )}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-5 pb-2'>
          <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs'>
            <p>
              {t(
                'Track reasoning and drawing capabilities across model groups.'
              )}
            </p>
            <span>
              {t('Last updated')}:{' '}
              {overview.dataUpdatedAt
                ? formatTimestamp(overview.dataUpdatedAt / 1000)
                : '—'}{' '}
              · {t('Refreshes every 30 seconds')}
            </span>
          </div>
          {overview.isPending && <LoadingState />}
          {overview.isError && (
            <ErrorState
              title={t('Could not load intelligence monitoring')}
              description={
                data
                  ? t(
                      'Showing the last available results. Refresh to try again.'
                    )
                  : undefined
              }
              onRetry={() => void overview.refetch()}
            />
          )}
          {data && (
            <>
              {!data.enabled && (
                <div
                  role='status'
                  className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'
                >
                  <Badge variant='secondary'>{t('Monitoring disabled')}</Badge>
                  {t(
                    'Enable intelligence monitoring in system settings to start scheduled checks.'
                  )}
                </div>
              )}
              <Card className='bg-muted/40 rounded-none shadow-none'>
                <CardContent className='grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_13rem]'>
                  <div className='flex min-w-0 items-start gap-3'>
                    <div className='bg-muted flex size-10 shrink-0 items-center justify-center'>
                      <HugeiconsIcon
                        icon={ArtificialIntelligence02Icon}
                        className='size-5'
                        aria-hidden='true'
                      />
                    </div>
                    <div className='min-w-0 space-y-2'>
                      <h3 className='text-sm font-semibold'>
                        {t('Is the model performing at full capability?')}
                      </h3>
                      <p className='text-muted-foreground text-xs leading-relaxed'>
                        {t(
                          'Compare logic checks and drawing outputs over time. Each block represents a check, with details available beside the timeline.'
                        )}
                      </p>
                      <p className='text-muted-foreground text-xs'>
                        {t(
                          'Quality pass rates exclude request errors. These checks measure specific tasks, not model identity.'
                        )}
                      </p>
                      <p className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                        <span>
                          {t('Normal capability')}:{' '}
                          {formatNumber(healthy, locale)}
                        </span>
                        <span>
                          {t('Potential degradation')}:{' '}
                          {formatNumber(degraded, locale)}
                        </span>
                        <span>
                          {t('Request failed')}: {formatNumber(errors, locale)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className='min-w-0 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5 lg:text-right'>
                    <p className='text-muted-foreground text-xs'>
                      {hasMath
                        ? t('Logic test pass rate')
                        : t('Drawing test pass rate')}{' '}
                      · {range}
                    </p>
                    <p
                      className='mt-1 font-mono text-4xl font-semibold'
                      aria-label={t('Quality pass rate')}
                    >
                      {passRate === null ? '—' : formatNumber(passRate, locale)}
                      <span className='text-muted-foreground ml-1 text-xl'>
                        %
                      </span>
                    </p>
                    <p className='text-muted-foreground mt-2 text-[11px]'>
                      {t('Next check')}: {nextCheck}
                    </p>
                    {data.enabled && (
                      <p className='text-muted-foreground mt-1 text-[11px]'>
                        {t('Check interval: {{minutes}} min', {
                          minutes: formatNumber(
                            data.interval_seconds / 60,
                            locale
                          ),
                        })}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <div
                className='flex flex-wrap items-center gap-2 text-xs'
                aria-label={t('Check status legend')}
              >
                <ProbeStatusBadge status='pass' />
                <ProbeStatusBadge status='fail' />
                <ProbeStatusBadge status='error' />
                <ProbeStatusBadge status='running' />
                <ProbeStatusBadge />
              </div>
              {targets.length === 0 && (
                <EmptyState
                  title={t('No monitoring targets')}
                  description={t(
                    'Configure a model group and a probe account in system settings.'
                  )}
                />
              )}
              <div
                className='min-w-0 space-y-4'
                aria-label={t('Intelligence groups')}
              >
                {targets.map((target) => (
                  <IntelligenceGroupCard
                    key={`${hours}-${target.group}-${target.model}-${target.effort}`}
                    target={target}
                    onOpenRun={setSelectedRun}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <IntelligenceRunDialog
          runId={selectedRun}
          onClose={() => setSelectedRun(null)}
        />
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
