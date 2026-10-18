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
  ArrowRight01Icon,
  CodeIcon,
  Image01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestamp } from '@/lib/format'

import {
  probeQualityRate,
  type ProbeSlot,
  type ProbeTarget,
} from '../intelligence-types'
import { IntelligenceArtifact } from './intelligence-artifact'
import { IntelligenceTimeline } from './intelligence-timeline'

export function IntelligenceGroupCard(props: {
  target: ProbeTarget
  onOpenRun: (id: number) => void
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [selectedDrawing, setSelectedDrawing] = useState<ProbeSlot | null>(null)
  const target = props.target
  const hasMath = target.kinds.includes('math')
  const hasDrawing = target.kinds.includes('drawing')
  const drawing = selectedDrawing ?? target.drawing.latest_pass
  const rate = probeQualityRate(hasMath ? target.math : target.drawing)
  let health = t('No data')
  if (rate !== null) {
    if (rate >= 90) health = t('Normal capability')
    else if (rate >= 70) health = t('Occasional misses')
    else health = t('Potential degradation')
  }
  const tests = [
    {
      kind: 'math',
      label: t('Logic test'),
      icon: CodeIcon,
      stats: target.math,
    },
    {
      kind: 'drawing',
      label: t('Drawing test'),
      icon: Image01Icon,
      stats: target.drawing,
    },
  ] as const

  return (
    <Card
      className='min-w-0 gap-5 rounded-none shadow-none'
      role='article'
      aria-label={`${target.group_name || target.group} · ${target.model}`}
    >
      <CardHeader>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
            <CardTitle className='text-primary text-sm font-semibold'>
              {target.group_name || target.group}
            </CardTitle>
            <span className='font-mono text-xs break-all'>{target.model}</span>
            {target.effort && (
              <Badge variant='secondary' className='rounded-sm'>
                {target.effort}
              </Badge>
            )}
          </div>
          <Badge variant='outline'>{health}</Badge>
        </div>
        {target.group_description && (
          <p className='text-muted-foreground mt-1 text-xs'>
            {target.group_description}
          </p>
        )}
      </CardHeader>
      <CardContent className='grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-5'>
        <div
          className={
            hasDrawing
              ? 'min-w-0 space-y-6 lg:col-span-3'
              : 'min-w-0 space-y-6 lg:col-span-5'
          }
        >
          {tests
            .filter((test) => target.kinds.includes(test.kind))
            .map((test) => {
              const passRate = probeQualityRate(test.stats)
              const latest = test.stats.latest
              return (
                <section
                  key={test.kind}
                  className='min-w-0 space-y-3'
                  aria-label={test.label}
                >
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h4 className='flex items-center gap-2 text-xs font-medium'>
                      <HugeiconsIcon
                        icon={test.icon}
                        className='size-4'
                        aria-hidden='true'
                      />
                      {test.label}
                    </h4>
                    <span className='text-muted-foreground text-[11px]'>
                      {t('Last check')}:{' '}
                      {latest
                        ? formatTimestamp(latest.started_at || latest.ts)
                        : '—'}
                    </span>
                  </div>
                  <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                    <strong className='font-mono text-2xl font-semibold'>
                      {passRate === null ? '—' : formatNumber(passRate, locale)}
                      <span className='text-muted-foreground ml-1 text-sm'>
                        %
                      </span>
                    </strong>
                    <span className='text-muted-foreground text-xs'>
                      {t('Passed')}: {formatNumber(test.stats.pass, locale)} ·{' '}
                      {t('Failed')}: {formatNumber(test.stats.fail, locale)}
                    </span>
                    <span className='text-xs text-amber-700 dark:text-amber-400'>
                      {t('Request failed')}:{' '}
                      {formatNumber(test.stats.error, locale)}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {t('Average duration')}:{' '}
                      {test.stats.total > 0
                        ? `${formatNumber(test.stats.avg_latency_ms / 1000, locale)} s`
                        : '—'}
                    </span>
                  </div>
                  <IntelligenceTimeline
                    slots={test.stats.slots}
                    label={`${target.model} ${test.label}`}
                    selectedRunId={
                      test.kind === 'drawing' ? drawing?.run_id : undefined
                    }
                    onSelect={(slot) => {
                      if (
                        test.kind === 'drawing' &&
                        slot.status === 'pass' &&
                        slot.has_artifact
                      ) {
                        setSelectedDrawing(slot)
                      } else if (slot.run_id) props.onOpenRun(slot.run_id)
                    }}
                  />
                </section>
              )
            })}
        </div>
        {hasDrawing && (
          <div className='min-w-0 space-y-2 lg:col-span-2'>
            <div className='text-muted-foreground flex flex-wrap justify-between gap-1 text-[11px]'>
              <span>{t('Latest drawing')}</span>
              {drawing && (
                <span>{formatTimestamp(drawing.started_at || drawing.ts)}</span>
              )}
            </div>
            <div className='bg-muted/35 min-h-48 overflow-hidden border lg:min-h-52'>
              {drawing?.run_id ? (
                <IntelligenceArtifact runId={drawing.run_id} />
              ) : (
                <EmptyState
                  title={t('No drawing available')}
                  description={t(
                    'A successful drawing check will appear here.'
                  )}
                  className='min-h-48'
                />
              )}
            </div>
            {drawing?.run_id && (
              <Button
                variant='ghost'
                size='sm'
                className='h-auto w-full justify-between py-1.5 text-xs whitespace-normal'
                onClick={() => {
                  if (drawing.run_id) props.onOpenRun(drawing.run_id)
                }}
              >
                {t('View check details')}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  data-icon='inline-end'
                  aria-hidden='true'
                />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
