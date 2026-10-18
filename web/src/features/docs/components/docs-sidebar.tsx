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
import { ApiIcon, Home01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import { DOCS_GUIDES, GUIDE_CATEGORIES } from '../data/guides'

function itemClassName(active: boolean): string {
  return cn(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
    active
      ? 'bg-muted text-foreground font-medium'
      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
  )
}

type DocsSidebarProps = {
  active: string
  onNavigate?: () => void
}

export function DocsSidebar(props: DocsSidebarProps) {
  const { t } = useTranslation()

  return (
    <nav aria-label={t('Documentation')} className='flex flex-col gap-4 p-3'>
      <div className='flex flex-col gap-1'>
        <Link
          to='/docs'
          className={itemClassName(props.active === 'home')}
          onClick={props.onNavigate}
        >
          <HugeiconsIcon icon={Home01Icon} className='size-4 shrink-0' />
          <span>{t('Docs home')}</span>
        </Link>
        <Link
          to='/docs/api'
          className={itemClassName(false)}
          onClick={props.onNavigate}
        >
          <HugeiconsIcon icon={ApiIcon} className='size-4 shrink-0' />
          <span>{t('API reference')}</span>
        </Link>
      </div>
      {GUIDE_CATEGORIES.map((category) => {
        const guides = DOCS_GUIDES.filter(
          (guide) => guide.categoryId === category.id
        )
        if (guides.length === 0) return null
        return (
          <div key={category.id} className='flex flex-col gap-1'>
            <div className='text-muted-foreground flex items-center gap-2 px-2 text-xs font-semibold tracking-wide uppercase'>
              <HugeiconsIcon
                icon={category.icon}
                className='size-3.5 shrink-0'
              />
              {t(category.titleKey)}
            </div>
            {guides.map((guide) => (
              <Link
                key={guide.slug}
                to='/docs/guides/$slug'
                params={{ slug: guide.slug }}
                className={itemClassName(props.active === guide.slug)}
                onClick={props.onNavigate}
              >
                <span className='min-w-0 flex-1 truncate'>
                  {t(guide.titleKey)}
                </span>
                {guide.recommended && (
                  <Badge
                    variant='secondary'
                    className='h-4 shrink-0 px-1.5 text-[10px]'
                  >
                    {t('Recommended')}
                  </Badge>
                )}
              </Link>
            ))}
          </div>
        )
      })}
    </nav>
  )
}
