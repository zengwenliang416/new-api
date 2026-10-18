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
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Separator } from '@/components/ui/separator'

import { ExampleTimeline } from './preview-elements'

export function PerformanceGroupCard(props: {
  title: string
  description: string
  models: string[]
  range: string
}) {
  const { t } = useTranslation()

  return (
    <Card
      className='min-w-0 gap-3 rounded-none shadow-none'
      role='article'
      aria-label={props.title}
    >
      <CardHeader className='gap-1.5'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <CardTitle className='text-primary min-w-0 text-sm font-semibold break-words'>
            {props.title}
          </CardTitle>
          <Badge variant='outline' className='text-muted-foreground'>
            {t('Example')}
          </Badge>
        </div>
        <p className='text-muted-foreground text-xs'>{props.description}</p>
      </CardHeader>
      <CardContent className='min-w-0 space-y-3'>
        <dl className='grid grid-cols-3 gap-2'>
          {[t('Latency'), 'TTFT', 'TPS'].map((label) => (
            <div key={label} className='bg-muted/45 min-w-0 px-2.5 py-2'>
              <dt className='text-muted-foreground text-[10px]'>{label}</dt>
              <dd className='mt-1 font-mono text-sm font-semibold'>—</dd>
            </div>
          ))}
        </dl>
        <div className='bg-muted/45 flex flex-wrap items-center justify-between gap-2 p-3'>
          <div>
            <p className='text-xs font-medium'>{t('Availability')}</p>
            <p className='text-muted-foreground mt-0.5 text-xs'>
              {t('Successful requests')}: —
            </p>
          </div>
          <p className='font-mono text-2xl font-semibold tracking-tight'>
            —<span className='text-muted-foreground ml-1 text-sm'>%</span>
          </p>
        </div>
        <ExampleTimeline range={props.range} />
        <Separator />
        <dl className='grid grid-cols-2 gap-x-3 gap-y-3 sm:grid-cols-4'>
          {[
            t('Cache hit rate'),
            t('Coding cache'),
            t('Input multiplier'),
            t('Reference multiplier'),
          ].map((label) => (
            <div key={label} className='min-w-0'>
              <dt className='text-muted-foreground text-[11px]'>{label}</dt>
              <dd className='mt-1 font-mono text-sm font-semibold'>—</dd>
            </div>
          ))}
        </dl>
        <Collapsible>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-muted-foreground text-xs'>
              {t('Model traffic')}: —
            </span>
            <CollapsibleTrigger
              render={<Button variant='ghost' size='sm' className='text-xs' />}
            >
              {t('View models')}
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                data-icon='inline-end'
                aria-hidden='true'
              />
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className='bg-muted/40 mt-2 space-y-2 p-3'>
              <p className='text-muted-foreground text-xs'>
                {t('Example models. Availability is not connected.')}
              </p>
              <ul className='space-y-1 font-mono text-xs'>
                {props.models.map((model) => (
                  <li key={model} className='break-all'>
                    {model}
                  </li>
                ))}
              </ul>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
