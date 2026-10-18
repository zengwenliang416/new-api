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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import z from 'zod'

import { SupportPage } from '@/features/support'
import {
  SUPPORT_SORT_VALUES,
  SUPPORT_STATUS_VALUES,
} from '@/features/support/constants'
import {
  supportSearchString,
  supportSearchUnread,
  toSupportRouteSearch,
} from '@/features/support/lib'

export const Route = createFileRoute('/_authenticated/support/')({
  validateSearch: z.object({
    ticket: supportSearchString,
    status: z.enum(SUPPORT_STATUS_VALUES).optional().catch(undefined),
    sort: z.enum(SUPPORT_SORT_VALUES).optional().catch(undefined),
    unread: supportSearchUnread,
    q: supportSearchString,
  }),
  component: SupportCenterRoute,
})

function SupportCenterRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <SupportPage
      scope='user'
      search={search}
      onSearchChange={(next) => {
        void navigate({
          to: '/support',
          search: toSupportRouteSearch(next),
          replace: true,
        })
      }}
    />
  )
}
