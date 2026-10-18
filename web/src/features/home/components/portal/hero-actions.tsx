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
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { readStatusField } from '@/lib/status-query'
import { cn } from '@/lib/utils'

import { CarbonIcons } from './icons'

interface HeroActionsProps {
  isAuthenticated: boolean
  align?: 'end'
}

/**
 * Primary hero buttons: dashboard/registration, pricing, and quick start.
 */
export function HeroActions(props: HeroActionsProps) {
  const { t } = useTranslation()
  const { status } = useStatus()
  const navLinks = useTopNavLinks()
  const pricingLink = navLinks.find((link) => link.href === '/pricing')
  const hasDocs = navLinks.some((link) => link.href === '/docs')

  const registrationOpen =
    !!status &&
    readStatusField(status, 'register_enabled') !== false &&
    !readStatusField(status, 'self_use_mode_enabled')
  const inviteRequired = !!readStatusField(
    status,
    'registration_invite_required'
  )

  let primaryLabel = t('Get started')
  if (registrationOpen) {
    if (inviteRequired) primaryLabel = t('Sign up with an invite')
  } else {
    primaryLabel = t('Sign in')
  }

  const primaryClassName = cn(
    buttonVariants({ size: 'lg' }),
    'min-h-12 h-auto w-full rounded-none px-5 py-3 whitespace-normal sm:w-auto sm:min-w-40'
  )
  const outlineClassName = cn(
    buttonVariants({ size: 'lg', variant: 'outline' }),
    'min-h-12 h-auto w-full rounded-none px-5 py-3 whitespace-normal sm:w-auto'
  )

  return (
    <div className='flex flex-col gap-3'>
      <div
        className={cn(
          'flex flex-col gap-3 sm:flex-row sm:flex-wrap',
          props.align === 'end' && 'xl:justify-end'
        )}
      >
        {props.isAuthenticated ? (
          <Link
            to='/dashboard/$section'
            params={{ section: 'overview' }}
            className={primaryClassName}
          >
            {t('Go to Dashboard')}
            <CarbonIcons.ArrowRight data-icon='inline-end' aria-hidden='true' />
          </Link>
        ) : (
          <Link
            to={registrationOpen ? '/sign-up' : '/sign-in'}
            className={primaryClassName}
          >
            {primaryLabel}
            <CarbonIcons.ArrowRight data-icon='inline-end' aria-hidden='true' />
          </Link>
        )}
        {pricingLink ? (
          <Link
            to={pricingLink.requiresAuth ? '/sign-in' : '/pricing'}
            search={pricingLink.requiresAuth ? { redirect: '/pricing' } : {}}
            className={outlineClassName}
          >
            {t('Models & pricing')}
          </Link>
        ) : null}
      </div>
      {hasDocs ? (
        <Link
          to='/docs/guides/$slug'
          params={{ slug: 'quick-start' }}
          className={cn(
            'text-muted-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 self-start text-sm underline decoration-border underline-offset-4',
            props.align === 'end' && 'xl:self-end'
          )}
        >
          {t('Quick start guide')}
          <CarbonIcons.ArrowRight className='size-4' aria-hidden='true' />
        </Link>
      ) : null}
      {!props.isAuthenticated && status && !registrationOpen ? (
        <p className='text-muted-foreground text-sm'>
          {t('Registration is currently closed. Existing users can sign in.')}
        </p>
      ) : null}
    </div>
  )
}
