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

import { cn } from '@/lib/utils'

import { ImageComposer } from './components/image-composer'
import { ImageGallery } from './components/image-gallery'

export function ImageStudio(props: { embedded?: boolean; className?: string }) {
  const { t } = useTranslation()
  return (
    <div
      className={cn(
        'bg-card min-w-0 p-4 sm:p-5',
        !props.embedded && 'min-h-[calc(100dvh-6rem)] border shadow-sm',
        props.className
      )}
    >
      {!props.embedded && (
        <h1 className='mb-4 text-lg font-semibold'>{t('Image generation')}</h1>
      )}
      <ImageComposer />
      <ImageGallery />
    </div>
  )
}
