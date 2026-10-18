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
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { ExampleTimeline } from './preview-elements'

export function IntelligenceGroupCard(props: {
  title: string
  model: string
  range: string
}) {
  const { t } = useTranslation()

  return (
    <Card
      className='min-w-0 gap-5 rounded-none shadow-none'
      role='article'
      aria-label={props.title}
    >
      <CardHeader>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1'>
            <CardTitle className='text-primary text-sm font-semibold'>
              {props.title}
            </CardTitle>
            <span className='font-mono text-xs break-all'>{props.model}</span>
            <Badge variant='secondary' className='rounded-sm'>
              {t('Example')}
            </Badge>
          </div>
          <Badge variant='outline' className='text-muted-foreground'>
            {t('Not connected')}
          </Badge>
        </div>
        <p className='text-muted-foreground mt-1 text-xs'>
          {t('Capability checks and model outputs will appear here.')}
        </p>
      </CardHeader>
      <CardContent className='grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-5'>
        <div className='min-w-0 space-y-6 lg:col-span-3'>
          {[
            { label: t('Logic test'), icon: CodeIcon },
            { label: t('Drawing test'), icon: Image01Icon },
          ].map((test) => (
            <section
              key={test.label}
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
                  {t('Last check')}: —
                </span>
              </div>
              <div className='flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                <strong className='font-mono text-2xl font-semibold'>
                  —<span className='text-muted-foreground ml-1 text-sm'>%</span>
                </strong>
                <span className='text-muted-foreground text-xs'>
                  {t('Completed checks')}: —
                </span>
                <span className='text-muted-foreground text-xs'>
                  {t('Average duration')}: —
                </span>
              </div>
              <ExampleTimeline compact range={props.range} />
            </section>
          ))}
        </div>
        <div className='min-w-0 space-y-2 lg:col-span-2'>
          <div className='text-muted-foreground flex flex-wrap justify-between gap-1 text-[11px]'>
            <span>{t('Latest drawing')}</span>
            <span>{t('Example')}</span>
          </div>
          <div className='bg-muted/35 flex min-h-48 items-center justify-center border lg:min-h-52'>
            <svg
              viewBox='0 0 320 180'
              className='text-muted-foreground/40 h-auto w-full max-w-72'
              role='img'
              aria-label={t('Sample drawing preview')}
            >
              <path
                d='M25 145 Q60 138 95 145 T165 145 T235 145 T300 145 M40 157 Q75 150 110 157 T180 157 T250 157'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
              />
              <path
                d='M127 129 H217 L201 141 H143 Z M170 40 V126 M165 53 L129 118 H165 Z M177 64 L206 118 H177 Z'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinejoin='round'
              />
              <circle
                cx='249'
                cy='44'
                r='12'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
              />
              <path
                d='M48 94 Q66 78 84 94 M42 109 Q66 90 90 109 M66 93 V140'
                fill='none'
                stroke='currentColor'
                strokeWidth='1.5'
              />
            </svg>
          </div>
          <Dialog
            title={t('Example check details')}
            description={t(
              'This is a layout preview, not a completed model evaluation.'
            )}
            trigger={
              <Button
                variant='ghost'
                size='sm'
                className='h-auto w-full justify-between py-1.5 text-xs whitespace-normal'
              >
                {t('View sample check')}
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  data-icon='inline-end'
                  aria-hidden='true'
                />
              </Button>
            }
          >
            <Tabs defaultValue='question'>
              <TabsList aria-label={t('Check details')}>
                <TabsTrigger value='question'>{t('Test question')}</TabsTrigger>
                <TabsTrigger value='response'>
                  {t('Model response')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value='question'>
                <div className='bg-muted/40 mt-2 space-y-3 rounded-md p-4'>
                  <Badge variant='secondary'>{t('Example')}</Badge>
                  <p>{t('Draw a small sailboat on a calm lake using SVG.')}</p>
                </div>
              </TabsContent>
              <TabsContent value='response'>
                <p className='text-muted-foreground bg-muted/40 mt-2 rounded-md p-4'>
                  {t('No model response. Evaluation is not connected.')}
                </p>
              </TabsContent>
            </Tabs>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  )
}
