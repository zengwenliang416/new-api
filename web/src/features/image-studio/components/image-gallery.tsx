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
import { ImageIcon, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ImageGallery() {
  const { t } = useTranslation()
  const titleId = useId()
  const [search, setSearch] = useState('')
  const [orientation, setOrientation] = useState('all')
  const options = [
    { label: t('All orientations'), value: 'all' },
    { label: t('Square'), value: 'square' },
    { label: t('Landscape'), value: 'landscape' },
    { label: t('Portrait'), value: 'portrait' },
  ]
  return (
    <section className='mt-5 min-w-0' aria-labelledby={titleId}>
      <div className='mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <h2
          id={titleId}
          className='text-muted-foreground text-sm font-semibold'
        >
          {t('Generated images')}
        </h2>
        <div className='flex min-w-0 flex-wrap gap-2 sm:flex-nowrap'>
          <div className='relative min-w-0 flex-1 sm:w-56'>
            <Search
              aria-hidden='true'
              className='text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4'
            />
            <Input
              type='search'
              aria-label={t('Search image prompts')}
              placeholder={t('Search image prompts')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className='h-9 rounded-sm pl-9'
            />
          </div>
          <Select
            value={orientation}
            items={options}
            onValueChange={(value) => {
              if (value) setOrientation(value)
            }}
          >
            <SelectTrigger
              aria-label={t('Image orientation')}
              className='h-9 rounded-sm'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {options.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <EmptyState
        icon={ImageIcon}
        title={t('No images yet')}
        description={t(
          'Generated images will appear here after the image service is connected.'
        )}
        bordered
        className='min-h-[300px] rounded-sm border-dashed'
      />
    </section>
  )
}
