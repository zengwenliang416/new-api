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

import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import type { ApiNavGroup } from '../lib/types'
import { DocsSearchForm } from './docs-search-form'
import { EndpointTree } from './endpoint-tree'

type EndpointsSheetProps = {
  activeEndpointId: string
  activeQuery: string
  filteredNavGroups: ApiNavGroup[]
  matchingEndpointCount: number
  onEndpointSelect: (endpointId: string) => void
  onOpenChange: (open: boolean) => void
  onQueryChange: React.ChangeEventHandler<HTMLInputElement>
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void
  open: boolean
  query: string
  searchInputRef?: React.RefObject<HTMLInputElement | null>
  triggerRef?: React.RefObject<HTMLButtonElement | null>
}

export function EndpointsSheet(props: EndpointsSheetProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent
        side='left'
        className='w-[min(24rem,92vw)] sm:max-w-md'
        initialFocus={props.searchInputRef}
        finalFocus={props.triggerRef}
      >
        <SheetHeader>
          <SheetTitle>{t('Endpoints')}</SheetTitle>
          <SheetDescription>
            {t('Search and switch between AI model API endpoints.')}
          </SheetDescription>
        </SheetHeader>
        <div className='px-4'>
          <DocsSearchForm
            searchInputRef={props.searchInputRef}
            query={props.query}
            activeQuery={props.activeQuery}
            onSearch={props.onSearch}
            onQueryChange={props.onQueryChange}
          />
        </div>
        <ScrollArea className='min-h-0 flex-1 px-2'>
          <EndpointTree
            groups={props.filteredNavGroups}
            activeQuery={props.activeQuery}
            activeEndpointId={props.activeEndpointId}
            onEndpointSelect={props.onEndpointSelect}
          />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
