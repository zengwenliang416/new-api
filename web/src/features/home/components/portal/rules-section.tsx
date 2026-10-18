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
import { useMemo, type PointerEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'

import {
  isThirdPartyReportsEnabled,
  parseThirdPartyReports,
  type ReportEntry,
} from '../../lib/third-party-reports'
import { CarbonIcons } from './icons'
import { LandingAnimate } from './landing-animate'
import { RequestFlowMini } from './request-flow-mini'
import {
  ChannelsCard,
  IconMotion,
  PricingCard,
  RegionsCard,
  SupportCard,
} from './rules-cards'
import { ThirdPartyReports } from './third-party-reports'

const SUPPORT_GUIDES = [
  { slug: 'codex-cli', label: 'Codex CLI' },
  { slug: 'claude-code', label: 'Claude Code' },
  { slug: 'cherry-studio', label: 'Cherry Studio' },
] as const

/**
 * Track the pointer position inside a card so the spotlight gradient follows
 * it through the `--spot-x` / `--spot-y` custom properties.
 */
function handleCardPointerMove(event: PointerEvent<HTMLElement>) {
  const target = event.currentTarget
  const rect = target.getBoundingClientRect()
  target.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
  target.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
}

interface RuleCard {
  id: string
  title: string
  desc: string
  icon: ReactNode
  span: string
  visual: ReactNode
}

function useReportEntries(): ReportEntry[] {
  const { status } = useStatus()
  return useMemo(() => {
    if (!isThirdPartyReportsEnabled(status)) return []
    return parseThirdPartyReports(status)
  }, [status])
}

/**
 * Bento grid of operational rules: routing, reports, pricing, transparency,
 * regions, and support.
 */
export function RulesSection() {
  const { t } = useTranslation()
  const reports = useReportEntries()
  const hasDocs = useTopNavLinks().some((link) => link.href === '/docs')

  const cards: RuleCard[] = [
    {
      id: 'flow',
      title: t('One API, supported models'),
      desc: t(
        'Route supported calls through configured upstream channels, with usage records available for review.'
      ),
      icon: (
        <CarbonIcons.Roadmap className='size-4 text-[color:var(--home-accent-soft)]' />
      ),
      span: reports.length > 0 ? 'md:col-span-2' : 'md:col-span-3',
      visual: <RequestFlowMini />,
    },
    ...(reports.length > 0
      ? [
          {
            id: 'modeloc',
            title: t('Third-party report'),
            desc:
              (reports.length === 1 && reports[0].description) ||
              t('Independent verification and reference links.'),
            icon: (
              <CarbonIcons.CertificateCheck className='size-4 text-[color:var(--home-accent-soft)]' />
            ),
            span: 'md:col-span-1',
            visual: <ThirdPartyReports reports={reports} />,
          },
        ]
      : []),
    {
      id: 'pricing',
      title: t('Transparent pricing'),
      desc: t(
        'Prices and multipliers follow the live pricing page and actual usage records.'
      ),
      icon: <CarbonIcons.Wallet className='size-4 text-emerald-400' />,
      span: 'md:col-span-2',
      visual: <PricingCard />,
    },
    {
      id: 'pool',
      title: t('Upstream transparency'),
      desc: t(
        'Published channel information and third-party reports are references, not continuous availability guarantees.'
      ),
      icon: (
        <CarbonIcons.CertificateCheck className='size-4 text-[color:var(--home-accent-soft)]' />
      ),
      span: 'md:col-span-1',
      visual: <ChannelsCard />,
    },
    {
      id: 'route',
      title: t('Regional access options'),
      desc: t(
        'Primary infrastructure is in East US. Availability and latency vary by region, with no mainland China access guarantee.'
      ),
      icon: <CarbonIcons.Meter className='size-4 text-violet-400' />,
      span: 'md:col-span-1',
      visual: <RegionsCard />,
    },
    {
      id: 'pledge',
      title: t('On-site ticket support'),
      desc: t(
        'Send request details through the support center so we can review routing, billing, or access issues.'
      ),
      icon: <CarbonIcons.Ticket className='size-4 text-amber-400' />,
      span: 'md:col-span-2',
      visual: <SupportCard />,
    },
  ]

  return (
    <section className='bg-background relative z-10 px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-8 lg:shadow-[0_-24px_70px_-20px_rgba(0,0,0,0.28)]'>
      <div className='mx-auto max-w-[80rem]'>
        <LandingAnimate className='mb-12 max-w-3xl sm:mb-16'>
          <h2 className='text-2xl leading-tight font-bold tracking-tight text-balance sm:text-3xl md:text-4xl'>
            <span className='landing-mask'>
              <LandingAnimate as='span' animation='mask-rise' delay={140}>
                {t('Clear routing, live pricing, published references')}
              </LandingAnimate>
            </span>
          </h2>
          <p className='text-muted-foreground mt-3 text-sm leading-relaxed'>
            {t(
              'Operational details are shown with their limits and remain subject to the User Agreement.'
            )}
          </p>
        </LandingAnimate>
        <div className='md:border-border/40 md:bg-border/40 grid gap-3 rounded-xl sm:gap-px md:grid-cols-3 md:gap-px md:overflow-hidden md:border'>
          {cards.map((card, index) => (
            <LandingAnimate
              key={card.id}
              delay={100 * index}
              animation='scale-in'
              onPointerMove={handleCardPointerMove}
              className={`bg-background group border-border/40 relative rounded-xl border p-5 transition-colors duration-300 sm:p-6 md:rounded-none md:border-0 md:p-8 ${card.span}`}
            >
              <div
                aria-hidden='true'
                className='pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100'
                style={{
                  background:
                    'radial-gradient(20rem circle at var(--spot-x, 50%) var(--spot-y, 50%), color-mix(in oklch, var(--home-accent) 9%, transparent), transparent 70%)',
                }}
              />
              <div className='mb-3 flex items-center gap-3'>
                <IconMotion icon={card.icon} />
                <h3 className='text-sm font-semibold'>{card.title}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {card.desc}
              </p>
              {card.visual}
            </LandingAnimate>
          ))}
        </div>
        {hasDocs ? (
          <nav
            aria-label={t('Client setup guides')}
            className='mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm'
          >
            <span className='text-muted-foreground'>
              {t('Client setup guides')}
            </span>
            {SUPPORT_GUIDES.map((guide) => (
              <Link
                key={guide.slug}
                to='/docs/guides/$slug'
                params={{ slug: guide.slug }}
                className='focus-visible:ring-ring inline-flex min-h-11 items-center rounded-sm underline decoration-current/30 underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:outline-none'
              >
                {t(guide.label)}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </section>
  )
}
