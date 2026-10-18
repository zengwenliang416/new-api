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
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { useStatus } from '@/hooks/use-status'

import { CarbonIcons } from './icons'
import { LandingAnimate } from './landing-animate'

type BoundaryItemKind = 'allow' | 'block' | 'plain'

interface BoundaryItem {
  kind: BoundaryItemKind
  text: string
}

function BoundaryListItem(props: { item: BoundaryItem }) {
  const { t } = useTranslation()
  if (props.item.kind === 'allow') {
    return (
      <li className='flex items-start gap-2.5'>
        <span className='inline-flex shrink-0'>
          <CarbonIcons.CheckmarkFilled
            className='text-success mt-0.5 size-4'
            aria-hidden='true'
          />
        </span>
        <span className='text-foreground/85 text-sm leading-relaxed'>
          {props.item.text}
        </span>
      </li>
    )
  }
  if (props.item.kind === 'block') {
    return (
      <li className='flex items-start gap-2.5'>
        <span className='border-muted-foreground/40 text-muted-foreground mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border'>
          <CarbonIcons.Subtract
            className='size-2.5'
            strokeWidth={2}
            aria-hidden='true'
          />
        </span>
        <span className='text-foreground/85 text-sm leading-relaxed'>
          <Badge variant='outline' className='mr-2'>
            {t('Not allowed')}
          </Badge>
          {props.item.text}
        </span>
      </li>
    )
  }
  return (
    <li className='flex items-start gap-2.5'>
      <span className='inline-flex shrink-0' aria-hidden='true'>
        <span className='bg-muted-foreground/30 mt-1.5 size-1.5 rounded-full' />
      </span>
      <span className='text-foreground/80 text-sm leading-relaxed'>
        {props.item.text}
      </span>
    </li>
  )
}

interface BoundaryCard {
  icon: ReactNode
  title: string
  lead: string
  detailsLabel: string
  visibleItems: BoundaryItem[]
  items: BoundaryItem[]
}

/**
 * Three-column boundaries section: capacity, fair usage, incidents.
 */
export function BoundariesSection() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const agreementSummary = t(
    'These operational rules summarize current practice; the User Agreement controls if terms differ.'
  )

  const capacityItems: BoundaryItem[] = [
    {
      kind: 'plain',
      text: t(
        'During high load, we may lower concurrency or adjust channel capacity to reduce upstream-limit risk.'
      ),
    },
    {
      kind: 'plain',
      text: t(
        'We do not promise unlimited throughput; capacity and response quality can vary.'
      ),
    },
    {
      kind: 'plain',
      text: t(
        'When capacity is reached, registration may pause or move to invite-only.'
      ),
    },
  ]

  const fairUsageItems: BoundaryItem[] = [
    {
      kind: 'allow',
      text: t(
        'Normal Codex / coding usage is supported subject to account limits, capacity controls, and upstream policies.'
      ),
    },
    {
      kind: 'block',
      text: t(
        'Batch, scripted concurrency against low-tier models (e.g. gpt-5-mini, gpt-4.1-mini).'
      ),
    },
    {
      kind: 'block',
      text: t(
        'Load tests or quota-farming that only burns official allowance to trigger upstream limits.'
      ),
    },
    {
      kind: 'plain',
      text: t(
        'We may throttle, reduce concurrency, or suspend access. Notice is provided when reasonably practicable, while urgent safety action may be immediate.'
      ),
    },
  ]

  const incidentItems: BoundaryItem[] = [
    {
      kind: 'plain',
      text: t(
        'Force majeure is outside our control: upstream outages, policy changes, large-scale account actions, or DDoS/CC attacks targeting us. We switch pools and recover ASAP.'
      ),
    },
    {
      kind: 'allow',
      text: t(
        'Verified billing or technical errors may be corrected by adjusting charges or returning unconsumed quota, in line with the User Agreement.'
      ),
    },
    {
      kind: 'plain',
      text: t(
        'Other credits or refunds are discretionary unless required by law or separately agreed in writing.'
      ),
    },
  ]

  const cards: BoundaryCard[] = [
    {
      icon: <CarbonIcons.Meter className='size-5' strokeWidth={1.5} />,
      title: t('Capacity protection'),
      lead: t(
        'Capacity and response quality may vary; registration may pause when capacity is reached.'
      ),
      detailsLabel: t('Capacity and registration details'),
      visibleItems: [],
      items: capacityItems,
    },
    {
      icon: <CarbonIcons.Settings className='size-5' strokeWidth={1.5} />,
      title: t('Fair usage policy'),
      lead: t(
        'Normal coding use is supported within account limits. Scripted quota-farming and abusive load tests are not allowed.'
      ),
      detailsLabel: t('Fair usage details'),
      visibleItems: fairUsageItems.filter((item) => item.kind === 'block'),
      items: fairUsageItems.filter((item) => item.kind !== 'block'),
    },
    {
      icon: <CarbonIcons.CurrencyDollar className='size-5' strokeWidth={1.5} />,
      title: t('Incidents & account corrections'),
      lead: t(
        'Verified errors are reviewed under the User Agreement. Outages and attacks do not create automatic compensation.'
      ),
      detailsLabel: t('Incident and correction details'),
      visibleItems: incidentItems.slice(2),
      items: incidentItems.slice(0, 2),
    },
  ]

  return (
    <section className='border-border/40 bg-background relative z-10 border-t px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8'>
      <div className='mx-auto max-w-[80rem]'>
        <LandingAnimate className='mb-12 max-w-xl sm:mb-16'>
          <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
            <span className='landing-mask'>
              <LandingAnimate as='span' animation='mask-rise' delay={140}>
                {t('Clear boundaries, current practices')}
              </LandingAnimate>
            </span>
          </h2>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
            {status?.user_agreement_enabled ? (
              <Link
                to='/user-agreement'
                className='focus-visible:ring-ring rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none'
              >
                {agreementSummary}
              </Link>
            ) : (
              agreementSummary
            )}
          </p>
        </LandingAnimate>
        <div className='grid items-start gap-4 sm:gap-6 md:grid-cols-3 md:gap-8'>
          {cards.map((card, index) => (
            <LandingAnimate
              key={card.title}
              delay={120 * index}
              animation='fade-in'
              className='border-border/40 bg-background flex flex-col rounded-xl border p-5 sm:p-6 md:p-8'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 mb-5 flex size-11 items-center justify-center rounded-xl border'>
                {card.icon}
              </div>
              <h3 className='text-base font-semibold'>{card.title}</h3>
              <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                {card.lead}
              </p>
              {card.visibleItems.length > 0 ? (
                <ul className='mt-5 flex flex-col gap-3'>
                  {card.visibleItems.map((item) => (
                    <BoundaryListItem key={item.text} item={item} />
                  ))}
                </ul>
              ) : null}
              <Accordion className='mt-4'>
                <AccordionItem value='details'>
                  <AccordionTrigger className='min-h-11'>
                    {card.detailsLabel}
                  </AccordionTrigger>
                  <AccordionContent>
                    <ul className='flex flex-col gap-3 pt-2'>
                      {card.items.map((item) => (
                        <BoundaryListItem key={item.text} item={item} />
                      ))}
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </LandingAnimate>
          ))}
        </div>
      </div>
    </section>
  )
}
