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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Card, CardContent } from '@/components/ui/card'

import { IntelligenceGroupCard } from './components/intelligence-group-card'
import {
  MonitoringTimeRange,
  PreviewNotice,
} from './components/preview-elements'

export function IntelligencePage() {
  const { t } = useTranslation()
  const [range, setRange] = useState('24h')

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
        />
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-5 pb-2'>
          <div className='space-y-3'>
            <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs'>
              <p>
                {t(
                  'Track reasoning and drawing capabilities across model groups.'
                )}
              </p>
              <span>
                {t('Last updated')}: — · {t('Auto refresh paused')}
              </span>
            </div>
            <PreviewNotice />
          </div>
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
                  <p className='text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs'>
                    <span>{t('Normal capability')}: —</span>
                    <span>{t('Potential degradation')}: —</span>
                  </p>
                </div>
              </div>
              <div className='min-w-0 border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5 lg:text-right'>
                <p className='text-muted-foreground text-xs'>
                  {t('Logic test pass rate')} · {range}
                </p>
                <p className='mt-1 font-mono text-4xl font-semibold'>
                  —<span className='text-muted-foreground ml-1 text-xl'>%</span>
                </p>
                <p className='text-muted-foreground mt-2 text-[11px]'>
                  {t('Next check')}: —
                </p>
                <div
                  className='bg-muted-foreground/15 mt-2 h-1 rounded-full'
                  aria-hidden='true'
                />
              </div>
            </CardContent>
          </Card>
          <div
            className='text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs'
            aria-label={t('Check status legend')}
          >
            <span className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-xs bg-emerald-400/75'
                aria-hidden='true'
              />
              {t('Passed')}
            </span>
            <span className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-xs bg-rose-400/75'
                aria-hidden='true'
              />
              {t('Failed')}
            </span>
            <span className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-xs bg-amber-400/75'
                aria-hidden='true'
              />
              {t('Request failed')}
            </span>
            <span className='flex items-center gap-1.5'>
              <span
                className='size-2 rounded-xs bg-sky-400/75'
                aria-hidden='true'
              />
              {t('Checking')}
            </span>
            <span className='flex items-center gap-1.5'>
              <span
                className='bg-muted-foreground/25 size-2 rounded-xs'
                aria-hidden='true'
              />
              {t('No data')}
            </span>
          </div>
          <div
            className='min-w-0 space-y-4'
            aria-label={t('Intelligence group previews')}
          >
            <IntelligenceGroupCard
              title={t('Reasoning models')}
              model='example-reasoning-model'
              range={range}
            />
            <IntelligenceGroupCard
              title={t('Coding models')}
              model='example-coding-model'
              range={range}
            />
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
