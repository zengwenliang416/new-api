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
import { ArrowLeft01Icon, ServerStack01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { ScrollArea } from '@/components/ui/scroll-area'

import type { ApiNavGroup } from '../lib/types'
import { DocsSearchForm } from './docs-search-form'
import { EndpointTree } from './endpoint-tree'

type EndpointsPanelProps = {
  activeEndpointId: string
  activeQuery: string
  filteredNavGroups: ApiNavGroup[]
  matchingEndpointCount: number
  onEndpointSelect: (endpointId: string) => void
  onQueryChange: React.ChangeEventHandler<HTMLInputElement>
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void
  query: string
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export function EndpointsPanel(props: EndpointsPanelProps) {
  const { t } = useTranslation()

  return (
    <aside className='bg-sidebar/30 hidden min-h-0 border-r lg:flex'>
      <div className='flex h-full min-h-0 w-full flex-col'>
        <div className='border-b p-4'>
          <Link
            to='/docs'
            className='text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1 text-xs transition-colors'
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className='size-3.5' />
            {t('Back to docs')}
          </Link>
          <div className='flex items-center gap-2'>
            <HugeiconsIcon
              icon={ServerStack01Icon}
              className='size-4'
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <div className='text-sm font-semibold'>{t('Endpoints')}</div>
              <div className='text-muted-foreground text-xs'>
                {t('{{count}} endpoints', {
                  count: props.matchingEndpointCount,
                })}
              </div>
            </div>
          </div>
          <DocsSearchForm
            className='mt-4'
            query={props.query}
            activeQuery={props.activeQuery}
            searchInputRef={props.searchInputRef}
            onSearch={props.onSearch}
            onQueryChange={props.onQueryChange}
          />
        </div>
        <ScrollArea className='min-h-0 flex-1'>
          <EndpointTree
            groups={props.filteredNavGroups}
            activeQuery={props.activeQuery}
            activeEndpointId={props.activeEndpointId}
            onEndpointSelect={props.onEndpointSelect}
          />
        </ScrollArea>
      </div>
    </aside>
  )
}
