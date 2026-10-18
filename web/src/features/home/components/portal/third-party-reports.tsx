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

import { Button } from '@/components/ui/button'

import type { ReportEntry, ReportStatus } from '../../lib/third-party-reports'

interface ReportStatusBadgeProps {
  status: ReportStatus
}

function reportStatusStyles(status: ReportStatus): {
  badge: string
  dot: string
} {
  switch (status) {
    case 'verified':
      return { badge: 'bg-success/15 text-foreground', dot: 'bg-success' }
    case 'archived':
      return {
        badge: 'bg-muted text-muted-foreground',
        dot: 'bg-muted-foreground',
      }
    default:
      return { badge: 'bg-info/15 text-foreground', dot: 'bg-info' }
  }
}

function ReportStatusBadge(props: ReportStatusBadgeProps) {
  const { t } = useTranslation()
  const styles = reportStatusStyles(props.status)
  let label: string
  switch (props.status) {
    case 'verified':
      label = t('Verified')
      break
    case 'archived':
      label = t('Archived')
      break
    default:
      label = t('Reference')
  }
  return (
    <span
      className={`${styles.badge} flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold`}
    >
      <span
        className={`${styles.dot} size-1.5 rounded-full`}
        aria-hidden='true'
      />
      {label}
    </span>
  )
}

interface ThirdPartyReportsProps {
  reports: ReportEntry[]
}

/**
 * Renders configured third-party reports as a single feature card or a
 * collapsible list.
 */
export function ThirdPartyReports(props: ThirdPartyReportsProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const visibleReports = expanded ? props.reports : props.reports.slice(0, 3)

  if (props.reports.length === 0) return null

  if (props.reports.length === 1) {
    const report = props.reports[0]
    return (
      <a
        href={report.url}
        target='_blank'
        rel='noopener noreferrer'
        className='border-border/40 bg-muted/20 hover:bg-muted/30 group/report mt-4 flex flex-col gap-4 rounded-lg border p-4 transition-colors'
      >
        <div className='flex items-center justify-between gap-2'>
          <span className='text-muted-foreground truncate font-mono text-xs font-semibold tracking-[0.08em]'>
            {report.provider}
          </span>
          <ReportStatusBadge status={report.status} />
        </div>
        <div className='flex items-end justify-between gap-3'>
          <span className='text-foreground min-w-0 text-sm leading-tight font-semibold'>
            {report.title}
          </span>
          <span className='text-muted-foreground group-hover/report:text-foreground text-xs whitespace-nowrap transition-colors'>
            {t('View report')} ↗
          </span>
        </div>
        {report.publishedDate ? (
          <span className='text-muted-foreground text-xs'>
            {t('Published Date')}: {report.publishedDate}
          </span>
        ) : null}
      </a>
    )
  }

  return (
    <div className='mt-4 space-y-2'>
      {visibleReports.map((report) => (
        <a
          key={report.id}
          href={report.url}
          target='_blank'
          rel='noopener noreferrer'
          className='border-border/40 bg-muted/20 hover:bg-muted/30 group/report flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors'
        >
          <span className='min-w-0 space-y-1.5'>
            <span className='flex min-w-0 flex-wrap items-center gap-2'>
              <span className='text-muted-foreground max-w-32 truncate font-mono text-xs font-semibold tracking-[0.08em]'>
                {report.provider}
              </span>
              <ReportStatusBadge status={report.status} />
            </span>
            <span className='text-foreground block text-sm leading-tight font-semibold'>
              {report.title}
            </span>
            {report.description ? (
              <span className='text-muted-foreground block text-sm leading-relaxed'>
                {report.description}
              </span>
            ) : null}
            {report.publishedDate ? (
              <span className='text-muted-foreground block text-xs'>
                {t('Published Date')}: {report.publishedDate}
              </span>
            ) : null}
          </span>
          <span className='text-muted-foreground group-hover/report:text-foreground mt-0.5 shrink-0 text-xs whitespace-nowrap transition-colors'>
            {t('View report')} ↗
          </span>
        </a>
      ))}
      {props.reports.length > 3 ? (
        <Button
          type='button'
          variant='link'
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className='text-muted-foreground hover:text-foreground focus-visible:ring-ring mt-1 min-h-11 rounded-sm text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none'
        >
          {expanded ? t('Show fewer reports') : t('View all reports')}
        </Button>
      ) : null}
    </div>
  )
}
