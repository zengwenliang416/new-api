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

type DocsCodeBlockProps = {
  code: string
  copyLabel: string
  label: string
}

export function DocsCodeBlock(props: DocsCodeBlockProps) {
  const { t } = useTranslation()

  return (
    <div className='bg-background overflow-hidden rounded-lg border'>
      <div className='bg-muted/60 flex items-center justify-between gap-2 border-b px-3 py-2'>
        <span className='text-muted-foreground truncate text-xs font-medium'>
          {props.label}
        </span>
        <CopyButton
          value={props.code}
          size='icon'
          variant='ghost'
          className='size-7'
          tooltip={props.copyLabel}
          successTooltip={t('Copied!')}
          aria-label={props.copyLabel}
        />
      </div>
      <pre className='max-h-96 overflow-auto p-3 text-xs leading-5'>
        <code>{props.code}</code>
      </pre>
    </div>
  )
}
