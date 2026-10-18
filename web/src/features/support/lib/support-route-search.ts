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
import z from 'zod'

import type { SupportPageSearch } from '../types'

/**
 * Search-param string that also accepts numeric values, because the router's
 * default search parser JSON-parses numeric-looking strings.
 */
export const supportSearchString = z
  .union([z.string(), z.number()])
  .optional()
  .catch(undefined)
  .transform((value) => (value == null ? undefined : String(value)))

/** Search-param flag accepting `1`, `true`, or a boolean. */
export const supportSearchUnread = z
  .union([z.boolean(), z.string(), z.number()])
  .optional()
  .catch(undefined)
  .transform((value) =>
    value === true || value === '1' || value === 'true' ? true : undefined
  )

/**
 * Serialize page state into route search values, dropping defaults and
 * undefined entries so the URL stays clean.
 */
export function toSupportRouteSearch(
  search: SupportPageSearch
): Record<string, string> {
  const routeSearch: Record<string, string> = {}
  if (search.ticket) routeSearch.ticket = search.ticket
  if (search.status) routeSearch.status = search.status
  if (search.sort) routeSearch.sort = search.sort
  if (search.unread) routeSearch.unread = '1'
  if (search.q) routeSearch.q = search.q
  if (search.category) routeSearch.category = search.category
  if (search.priority) routeSearch.priority = search.priority
  if (search.verification) routeSearch.verification = search.verification
  if (search.user_id) routeSearch.user_id = search.user_id
  return routeSearch
}
