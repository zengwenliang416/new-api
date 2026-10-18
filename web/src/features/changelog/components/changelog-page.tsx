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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toIntlLocale } from '@/i18n/languages'

import { CHANGELOG_MONTHS } from '../data/updates'

export function ChangelogPage() {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const monthFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      }),
    [locale]
  )

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl px-1 pt-10 pb-16 sm:px-6 sm:pt-16 sm:pb-24'>
        <header className='flex max-w-2xl flex-col gap-4 pb-10 sm:pb-14'>
          <h1 className='text-3xl font-semibold tracking-tight text-balance sm:text-4xl'>
            {t('Changelog')}
          </h1>
          <p className='text-muted-foreground text-base leading-7 text-pretty'>
            {t('New features and everyday improvements, all in one place.')}
          </p>
          <p className='text-muted-foreground text-sm leading-6'>
            {t('Grouped by month, with the latest updates first.')}
          </p>
          <div role='note' className='bg-muted/40 border px-3 py-2 text-sm'>
            <p className='font-medium'>{t('Sample release notes')}</p>
            <p className='text-muted-foreground mt-1 leading-6'>
              {t(
                "These entries preview the page layout and are not this site's release history."
              )}
            </p>
          </div>
        </header>

        <Separator />

        <div className='grid items-start gap-10 pt-8 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-12 md:pt-12'>
          <nav
            aria-label={t('Browse updates by month')}
            className='md:sticky md:top-24'
          >
            <p className='mb-3 text-sm font-medium'>
              {t('Browse updates by month')}
            </p>
            <ul className='flex flex-wrap gap-2 md:flex-col md:gap-1'>
              {CHANGELOG_MONTHS.map((group) => (
                <li key={group.month}>
                  <a
                    href={`#updates-${group.month}`}
                    className='text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none md:w-full'
                  >
                    {monthFormat.format(
                      new Date(`${group.month}-01T00:00:00Z`)
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <ol className='flex min-w-0 flex-col'>
            {CHANGELOG_MONTHS.map((group, index) => (
              <li
                key={group.month}
                className='before:bg-border relative pb-12 pl-7 before:absolute before:top-3 before:bottom-0 before:left-1 before:w-px last:pb-0 last:before:hidden sm:pl-10'
              >
                <span
                  aria-hidden='true'
                  className='bg-foreground ring-background absolute top-2 left-0 size-[9px] rounded-full ring-4'
                />
                <section
                  id={`updates-${group.month}`}
                  aria-labelledby={`updates-${group.month}-heading`}
                  className='scroll-mt-24'
                >
                  <div className='mb-7 flex flex-wrap items-center gap-3'>
                    <h2
                      id={`updates-${group.month}-heading`}
                      className='text-xl font-semibold text-balance'
                    >
                      <time dateTime={group.month}>
                        {monthFormat.format(
                          new Date(`${group.month}-01T00:00:00Z`)
                        )}
                      </time>
                    </h2>
                    {index === 0 && (
                      <Badge variant='secondary'>{t('Latest updates')}</Badge>
                    )}
                  </div>

                  <div className='flex flex-col gap-7'>
                    {group.updates.map((update) => (
                      <article
                        key={update.title}
                        className='flex flex-col gap-2'
                      >
                        <h3 className='text-base font-medium text-balance'>
                          {t(update.title)}
                        </h3>
                        <ul className='text-muted-foreground marker:text-muted-foreground/60 flex list-disc flex-col gap-1.5 pl-4 text-sm leading-7 text-pretty'>
                          {update.items.map((item) => (
                            <li key={item}>{t(item)}</li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </section>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </PublicLayout>
  )
}
