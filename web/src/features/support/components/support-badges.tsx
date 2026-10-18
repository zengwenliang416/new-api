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

import {
  getTicketCategoryLabel,
  getTicketStatusLabel,
  getTicketVerificationLabel,
} from '../lib'
import type { SupportScope, TicketStatusFilter } from '../types'

export function TicketStatusBadge(props: {
  status: TicketStatusFilter
  scope: SupportScope
  className?: string
}) {
  const { t } = useTranslation()
  const { status, scope } = props
  const label = t(getTicketStatusLabel(status, scope))

  if (status === 'open') {
    return (
      <Badge variant='warning' className={props.className}>
        {label}
      </Badge>
    )
  }
  if (status === 'pending') {
    return (
      <Badge
        variant='secondary'
        className={cn(
          'border-transparent bg-info/10 text-info',
          props.className
        )}
      >
        {label}
      </Badge>
    )
  }
  return (
    <Badge
      variant='secondary'
      className={cn(
        'border-transparent bg-success/10 text-success',
        props.className
      )}
    >
      {label}
    </Badge>
  )
}

export function TicketVerificationBadge(props: {
  level: string
  className?: string
}) {
  const { t } = useTranslation()
  const label = t(getTicketVerificationLabel(props.level))
  const classes: Record<string, string> = {
    suspected: 'border-transparent bg-warning/10 text-warning',
    reproducible: 'border-transparent bg-info/10 text-info',
    confirmed: 'border-transparent bg-success/10 text-success',
  }
  const className = classes[props.level]
  if (!className) {
    return (
      <Badge variant='secondary' className={props.className}>
        {label}
      </Badge>
    )
  }
  return (
    <Badge variant='secondary' className={cn(className, props.className)}>
      {label}
    </Badge>
  )
}

export function TicketCategoryBadge(props: {
  category: string
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <Badge variant='outline' className={props.className}>
      {t(getTicketCategoryLabel(props.category))}
    </Badge>
  )
}
