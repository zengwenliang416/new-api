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

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { EndpointField } from '../lib/types'

type EndpointFieldRowProps = {
  depth: number
  field: EndpointField
}

function EndpointFieldRow(props: EndpointFieldRowProps) {
  const { t } = useTranslation()
  const { field } = props

  return (
    <div>
      <div
        className={cn(
          'grid gap-2 border-t py-3 first:border-t-0 md:grid-cols-[minmax(9rem,12rem)_minmax(0,1fr)]',
          props.depth > 0 && 'ml-4'
        )}
      >
        <div className='min-w-0'>
          <div className='flex min-w-0 flex-wrap items-center gap-2'>
            <code className='text-foreground font-mono text-sm'>
              {field.name}
            </code>
            {field.required ? (
              <Badge variant='secondary'>{t('Required')}</Badge>
            ) : (
              <Badge variant='outline'>{t('Optional')}</Badge>
            )}
          </div>
          <code className='text-muted-foreground mt-1 block font-mono text-xs'>
            {field.type}
          </code>
        </div>
        <div className='flex min-w-0 flex-col gap-2'>
          <p className='text-muted-foreground text-sm leading-6'>
            {t(field.descriptionKey)}
          </p>
          <div className='flex flex-wrap gap-2'>
            {field.defaultValue ? (
              <Badge variant='outline'>
                {t('Default')} {field.defaultValue}
              </Badge>
            ) : null}
            {field.range ? (
              <Badge variant='outline'>
                {t('Range')} {field.range}
              </Badge>
            ) : null}
            {field.location ? (
              <Badge variant='outline'>{field.location}</Badge>
            ) : null}
          </div>
        </div>
      </div>
      {field.children?.map((child) => (
        <EndpointFieldRow
          key={`${field.name}-${child.name}-${child.type}`}
          field={child}
          depth={props.depth + 1}
        />
      ))}
    </div>
  )
}

type EndpointFieldListProps = {
  fields: EndpointField[]
}

export function EndpointFieldList(props: EndpointFieldListProps) {
  return (
    <div className='flex flex-col gap-0'>
      {props.fields.map((field) => (
        <EndpointFieldRow
          key={`${field.name}-${field.type}`}
          field={field}
          depth={0}
        />
      ))}
    </div>
  )
}
