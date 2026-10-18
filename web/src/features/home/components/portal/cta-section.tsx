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
import { useTranslation } from 'react-i18next'

import { HeroActions } from './hero-actions'

interface CtaSectionProps {
  isAuthenticated: boolean
}

/**
 * Closing call to action above the footer.
 */
export function CtaSection(props: CtaSectionProps) {
  const { t } = useTranslation()
  return (
    <section className='bg-background border-border/50 relative z-10 border-t px-4 py-14 sm:px-6 lg:px-8'>
      <div className='mx-auto flex max-w-[80rem] flex-col justify-between gap-8 lg:flex-row lg:items-center'>
        <div className='max-w-xl'>
          <h2 className='text-2xl font-semibold text-balance sm:text-3xl'>
            {t('Ready to connect your tools?')}
          </h2>
          <p className='text-muted-foreground mt-3 text-base leading-relaxed'>
            {t(
              'Choose a model, create a key, and follow your client setup guide.'
            )}
          </p>
        </div>
        <HeroActions isAuthenticated={props.isAuthenticated} align='end' />
      </div>
    </section>
  )
}
