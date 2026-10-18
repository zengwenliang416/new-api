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
import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'

type DocsSearchFormProps = {
  activeQuery: string
  className?: string
  onQueryChange: React.ChangeEventHandler<HTMLInputElement>
  onSearch: (event: React.FormEvent<HTMLFormElement>) => void
  query: string
  searchInputRef?: React.RefObject<HTMLInputElement | null>
}

export function DocsSearchForm(props: DocsSearchFormProps) {
  const { t } = useTranslation()

  return (
    <form
      className={cn('flex flex-col gap-2', props.className)}
      onSubmit={props.onSearch}
    >
      <div className='relative'>
        <HugeiconsIcon
          icon={Search01Icon}
          className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2'
          aria-hidden='true'
        />
        <Input
          ref={props.searchInputRef}
          value={props.query}
          onChange={props.onQueryChange}
          className='h-9 pr-20 pl-9'
          placeholder={t('Search models, chat, audio, /v1/rerank...')}
          aria-label={t('Search API documentation')}
        />
        <KbdGroup className='absolute top-1/2 right-2 -translate-y-1/2'>
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </KbdGroup>
      </div>
      <Button
        type='submit'
        variant='outline'
        size='sm'
        className='justify-center'
      >
        <HugeiconsIcon icon={Search01Icon} data-icon='inline-start' />
        {t(props.activeQuery ? 'Update search' : 'Search')}
      </Button>
    </form>
  )
}
