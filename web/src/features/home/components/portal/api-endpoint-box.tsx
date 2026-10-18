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

import { CopyButton } from '@/components/copy-button'

interface ApiEndpointBoxProps {
  apiEndpoint: string
}

/**
 * Hero box showing the API root URL with a copy action.
 */
export function ApiEndpointBox(props: ApiEndpointBoxProps) {
  const { t } = useTranslation()
  return (
    <div className='flex w-full max-w-xl flex-col gap-2'>
      <span className='text-muted-foreground text-sm font-medium'>
        {t('API root URL')}
      </span>
      <div className='border-border bg-background/90 flex min-h-14 min-w-0 items-center gap-3 border px-3 sm:px-4'>
        <code className='text-foreground min-w-0 flex-1 overflow-x-auto bg-transparent py-2 font-mono text-sm whitespace-nowrap'>
          {props.apiEndpoint}
        </code>
        <CopyButton
          value={props.apiEndpoint}
          variant='ghost'
          size='sm'
          tooltip={t('Copy API root URL')}
          successTooltip={t('Endpoint copied')}
          aria-label={t('Copy API root URL')}
          className='min-h-11 shrink-0 px-3'
        >
          {t('Copy')}
        </CopyButton>
      </div>
      <p className='text-muted-foreground text-sm leading-relaxed'>
        {t(
          'This copies the root URL. Add /v1 only when your client guide requires it.'
        )}
      </p>
    </div>
  )
}
