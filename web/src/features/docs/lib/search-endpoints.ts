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
import type { ApiEndpoint, ApiNavGroup } from './types'

type Translate = (key: string) => string

function endpointSearchText(
  endpoint: ApiEndpoint,
  group: ApiNavGroup,
  translate: Translate
): string {
  const fieldText = endpoint.requestFields
    .map(
      (field) =>
        `${field.name} ${field.type} ${translate(field.descriptionKey)}`
    )
    .join(' ')
  return [
    endpoint.method,
    endpoint.path,
    endpoint.samplePath ?? '',
    translate(endpoint.titleKey),
    translate(endpoint.navTitleKey ?? endpoint.titleKey),
    translate(endpoint.summaryKey),
    translate(endpoint.descriptionKey),
    translate(endpoint.groupTitleKey),
    translate(endpoint.formatKey),
    translate(group.titleKey),
    translate(group.descriptionKey),
    fieldText,
    endpoint.keywords.join(' '),
  ]
    .join(' ')
    .toLowerCase()
}

export function filterNavGroups(
  groups: ApiNavGroup[],
  endpointMap: Record<string, ApiEndpoint>,
  translate: Translate,
  query: string
): ApiNavGroup[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return groups
  const filtered: ApiNavGroup[] = []
  for (const group of groups) {
    const groupMatches =
      `${translate(group.titleKey)} ${translate(group.descriptionKey)}`
        .toLowerCase()
        .includes(normalized)
    const children = group.children
      .map((child) => {
        const childMatches = translate(child.titleKey)
          .toLowerCase()
          .includes(normalized)
        const endpointIds = child.endpointIds.filter((endpointId) => {
          if (groupMatches || childMatches) return true
          const endpoint = endpointMap[endpointId]
          if (!endpoint) return false
          return endpointSearchText(endpoint, group, translate).includes(
            normalized
          )
        })
        return { ...child, endpointIds }
      })
      .filter((child) => child.endpointIds.length > 0)
    if (children.length > 0) filtered.push({ ...group, children })
  }
  return filtered
}

export function countMatchingEndpoints(groups: ApiNavGroup[]): number {
  const endpointIds = new Set<string>()
  for (const group of groups) {
    for (const child of group.children) {
      for (const endpointId of child.endpointIds) endpointIds.add(endpointId)
    }
  }
  return endpointIds.size
}
