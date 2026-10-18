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
import { DEFAULT_ENDPOINT_ID, ENDPOINT_MAP } from '../data/api-endpoints'
import type { ApiEndpoint } from './types'

export function getEndpoint(endpointId: string): ApiEndpoint {
  return ENDPOINT_MAP[endpointId] ?? ENDPOINT_MAP[DEFAULT_ENDPOINT_ID]
}

export function getEndpointUrl(
  endpoint: ApiEndpoint,
  apiBaseUrl: string
): string {
  return `${apiBaseUrl}${endpoint.samplePath ?? endpoint.path}`
}

export function getEndpointNavLabel(endpoint: ApiEndpoint): string {
  return endpoint.navTitleKey ?? endpoint.titleKey
}

export function endpointChildKey(groupId: string, childId: string): string {
  return `${groupId}:${childId}`
}

export { DEFAULT_ENDPOINT_ID }
