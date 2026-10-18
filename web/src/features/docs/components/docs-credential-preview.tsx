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
import { Key01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'

export function DocsCredentialPreview() {
  const { t } = useTranslation()
  const descriptionId = useId()

  return (
    <div className='bg-muted/40 flex flex-wrap items-center gap-3 border px-4 py-3'>
      <div className='flex items-center gap-2'>
        <HugeiconsIcon
          icon={Key01Icon}
          className='text-muted-foreground size-4'
          aria-hidden='true'
        />
        <span className='text-sm font-medium'>{t('API key injection')}</span>
      </div>
      <div className='min-w-0 flex-1 basis-48 sm:max-w-xs'>
        <Select disabled>
          <SelectTrigger
            className='h-9 w-full'
            aria-label={t('Select an API key')}
            aria-describedby={descriptionId}
          >
            <SelectValue placeholder={t('Select an API key')} />
          </SelectTrigger>
        </Select>
      </div>
      <p
        id={descriptionId}
        className='text-muted-foreground w-full text-xs leading-5'
      >
        {t('UI preview only. API keys are not read or injected.')}
      </p>
    </div>
  )
}
