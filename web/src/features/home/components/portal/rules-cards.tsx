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
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { buttonVariants } from '@/components/ui/button'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { CarbonIcons } from './icons'

const SUPPORT_DISCLAIMER_ICON_CLASS = 'size-4'

function PricingCard() {
  const { t } = useTranslation()
  const pricingLink = useTopNavLinks().find((link) => link.href === '/pricing')
  const rows = [
    { label: t('Quota conversion'), value: t('Shown before purchase') },
    { label: t('Usage records'), value: t('Metered per request') },
  ]
  return (
    <div className='mt-5 flex flex-col gap-3'>
      {pricingLink ? (
        <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
          <span className='text-muted-foreground text-sm'>
            {t('Live model pricing')}
          </span>
          <Link
            to={pricingLink.requiresAuth ? '/sign-in' : '/pricing'}
            search={
              pricingLink.requiresAuth ? { redirect: '/pricing' } : undefined
            }
            className='text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-sm text-sm font-semibold underline decoration-current/40 underline-offset-4 hover:decoration-current focus-visible:ring-2 focus-visible:outline-none'
          >
            {t(
              pricingLink.requiresAuth
                ? 'Sign in to view pricing'
                : 'See pricing page'
            )}
            <span aria-hidden='true'>→</span>
          </Link>
        </div>
      ) : null}
      {rows.map((row) => (
        <div
          key={row.label}
          className='flex items-center justify-between gap-3'
        >
          <span className='text-muted-foreground text-sm'>{row.label}</span>
          <span className='text-foreground text-right text-sm font-semibold'>
            {row.value}
          </span>
        </div>
      ))}
      <div className='border-border/40 bg-muted/20 mt-3 rounded-lg border px-3 py-2.5'>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {t(
            'Billing follows the current pricing page, purchase terms, and per-request usage records.'
          )}
        </p>
      </div>
      <a
        href='https://linux.do/t/topic/2504277'
        target='_blank'
        rel='noopener noreferrer'
        className='text-muted-foreground hover:text-foreground focus-visible:ring-ring group inline-flex min-h-11 flex-wrap items-center gap-1.5 rounded-sm text-xs underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:outline-none'
      >
        <span>{t('How is the guidance price derived?')}</span>
        <span className='inline-block transition-transform duration-200 group-hover:translate-x-0.5'>
          →
        </span>
        <span className='font-mono'>{t('View guidance price post')}</span>
      </a>
    </div>
  )
}

function ChannelsCard() {
  const { t } = useTranslation()
  const items = [
    t('Configured upstream channels'),
    t('Third-party reports when available'),
    t('Availability may change'),
  ]
  return (
    <div className='mt-5 space-y-2'>
      {items.map((item) => (
        <div key={item} className='flex items-center gap-2.5'>
          <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--home-accent)_15%,transparent)]'>
            <CarbonIcons.CertificateCheck className='size-3 text-[color:var(--home-accent)]' />
          </span>
          <span className='text-foreground/80 text-sm leading-relaxed'>
            {item}
          </span>
        </div>
      ))}
    </div>
  )
}

function RegionsCard() {
  const { t } = useTranslation()
  const items = [
    t('Primary infrastructure in East US'),
    t('Multiple endpoints for supported regions'),
    t('No mainland China access guarantee'),
  ]
  return (
    <div className='mt-5 space-y-2'>
      {items.map((item) => (
        <div key={item} className='flex items-center gap-2.5'>
          <span className='flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-500/15'>
            <CarbonIcons.Meter className='size-3 text-violet-400' />
          </span>
          <span className='text-foreground/80 text-sm leading-relaxed'>
            {item}
          </span>
        </div>
      ))}
    </div>
  )
}

function SupportCard() {
  const { t } = useTranslation()
  const isAuthenticated = useAuthStore((state) => !!state.auth.user)
  const notAcceptedItems = [
    t('Scores from a review site'),
    t('Knowledge cutoff questions or claims that a blogger said it is fake'),
    t(
      'Asking the AI what model it is and saying the answer differs from ChatGPT'
    ),
    t('It just feels wrong'),
  ]
  return (
    <div className='mt-5 flex flex-col gap-4'>
      <Link
        to={isAuthenticated ? '/support' : '/sign-in'}
        search={isAuthenticated ? undefined : { redirect: '/support' }}
        className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11 w-fit')}
      >
        <CarbonIcons.Ticket data-icon='inline-start' aria-hidden='true' />
        {t(
          isAuthenticated ? 'Open support center' : 'Sign in to contact support'
        )}
      </Link>
      <p className='text-muted-foreground text-sm leading-relaxed'>
        {t(
          'Include the request ID, time, model, and reproducible request and response details. Remove API keys and personal data before sharing.'
        )}
      </p>
      <Accordion>
        <AccordionItem value='support-evidence'>
          <AccordionTrigger className='min-h-11'>
            {t('Evidence and handling rules')}
          </AccordionTrigger>
          <AccordionContent>
            <div className='flex flex-col gap-5 pt-2'>
              <div>
                <h4 className='text-foreground flex items-center gap-2 text-sm font-semibold'>
                  <CarbonIcons.Checkmark
                    className={`text-success ${SUPPORT_DISCLAIMER_ICON_CLASS}`}
                    aria-hidden='true'
                  />
                  {t('Valid evidence')}
                </h4>
                <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                  {t(
                    'Complete request and response records, reproducible technical screenshots, API response headers, and parameter comparisons help us investigate. Verified billing or routing errors are handled under the User Agreement.'
                  )}
                </p>
              </div>
              <div>
                <h4 className='text-foreground flex items-center gap-2 text-sm font-semibold'>
                  <CarbonIcons.Close
                    className={`text-muted-foreground ${SUPPORT_DISCLAIMER_ICON_CLASS}`}
                    aria-hidden='true'
                  />
                  {t('Not accepted')}
                </h4>
                <ul className='text-muted-foreground mt-2 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed'>
                  {notAcceptedItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {t(
                  'The burden of proof rests with the claimant. The platform has no duty to proactively prove itself, does not accept any form of compelled self-proof, and will not respond to challenges submitted without valid evidence.'
                )}
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

interface IconMotionProps {
  icon: ReactNode
}

function IconMotion(props: IconMotionProps) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.span
      initial={false}
      whileHover={reducedMotion ? undefined : { scale: 1.08 }}
      whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22 }}
      className='border-border/40 bg-muted flex size-7 items-center justify-center rounded-md border'
    >
      {props.icon}
    </motion.span>
  )
}

export { ChannelsCard, IconMotion, PricingCard, RegionsCard, SupportCard }
