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
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import z from 'zod'

import { SupportPage } from '@/features/support'
import {
  SUPPORT_CATEGORY_VALUES,
  SUPPORT_PRIORITY_VALUES,
  SUPPORT_SORT_VALUES,
  SUPPORT_STATUS_VALUES,
  SUPPORT_VERIFICATION_VALUES,
} from '@/features/support/constants'
import {
  supportSearchString,
  supportSearchUnread,
  toSupportRouteSearch,
} from '@/features/support/lib'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/support-admin/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.SUPPORT) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: z.object({
    ticket: supportSearchString,
    status: z.enum(SUPPORT_STATUS_VALUES).optional().catch(undefined),
    sort: z.enum(SUPPORT_SORT_VALUES).optional().catch(undefined),
    unread: supportSearchUnread,
    q: supportSearchString,
    category: z.enum(SUPPORT_CATEGORY_VALUES).optional().catch(undefined),
    priority: z.enum(SUPPORT_PRIORITY_VALUES).optional().catch(undefined),
    verification: z
      .enum(SUPPORT_VERIFICATION_VALUES)
      .optional()
      .catch(undefined),
    user_id: supportSearchString,
  }),
  component: SupportAdminRoute,
})

function SupportAdminRoute() {
  const search = Route.useSearch()
  const navigate = useNavigate()

  return (
    <SupportPage
      scope='admin'
      search={search}
      onSearchChange={(next) => {
        void navigate({
          to: '/support-admin',
          search: toSupportRouteSearch(next),
          replace: true,
        })
      }}
    />
  )
}
