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
import { describe, expect, test } from 'vitest'

import { countMatchingEndpoints, filterNavGroups } from '../search-endpoints'
import type { ApiEndpoint, ApiNavGroup } from '../types'

function makeEndpoint(overrides: Partial<ApiEndpoint>): ApiEndpoint {
  return {
    id: 'endpoint',
    method: 'POST',
    path: '/v1/endpoint',
    titleKey: 'Endpoint',
    summaryKey: 'Endpoint summary',
    descriptionKey: 'Endpoint description',
    groupId: 'group',
    groupTitleKey: 'Group',
    formatKey: 'JSON',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [],
    responseExamples: [],
    analysisKeys: [],
    keywords: [],
    ...overrides,
  }
}

const endpoints = {
  'chat-completions': makeEndpoint({
    id: 'chat-completions',
    path: '/v1/chat/completions',
    titleKey: 'Chat completions',
    keywords: ['gpt'],
  }),
  'embeddings-create': makeEndpoint({
    id: 'embeddings-create',
    path: '/v1/embeddings',
    titleKey: 'Embeddings',
  }),
  'images-generations': makeEndpoint({
    id: 'images-generations',
    path: '/v1/images/generations',
    titleKey: 'Image generation',
    groupId: 'images',
  }),
}

const groups: ApiNavGroup[] = [
  {
    id: 'chat',
    icon: [],
    titleKey: 'Chat',
    descriptionKey: 'Chat endpoints',
    children: [
      {
        id: 'openai',
        titleKey: 'OpenAI compatible',
        endpointIds: ['chat-completions', 'embeddings-create'],
      },
    ],
  },
  {
    id: 'images',
    icon: [],
    titleKey: 'Images',
    descriptionKey: 'Image endpoints',
    children: [
      {
        id: 'basic',
        titleKey: 'Generation',
        endpointIds: ['images-generations'],
      },
    ],
  },
]

const identity = (key: string) => key

describe('filterNavGroups', () => {
  test('keeps every group for a blank query', () => {
    expect(filterNavGroups(groups, endpoints, identity, '   ')).toBe(groups)
  })

  test('keeps only endpoints whose path contains the query', () => {
    const result = filterNavGroups(groups, endpoints, identity, '/v1/embed')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('chat')
    expect(result[0].children[0].endpointIds).toEqual(['embeddings-create'])
  })

  test('matches translated endpoint titles', () => {
    const translate = (key: string) =>
      key === 'Image generation' ? '图像生成' : key

    const result = filterNavGroups(groups, endpoints, translate, '图像')

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('images')
  })

  test('matches endpoint keywords', () => {
    const result = filterNavGroups(groups, endpoints, identity, 'gpt')

    expect(result).toHaveLength(1)
    expect(result[0].children[0].endpointIds).toEqual(['chat-completions'])
  })

  test('keeps all endpoints when the group title matches', () => {
    const result = filterNavGroups(groups, endpoints, identity, 'chat')

    expect(result).toHaveLength(1)
    expect(result[0].children[0].endpointIds).toEqual([
      'chat-completions',
      'embeddings-create',
    ])
  })

  test('returns no groups when nothing matches', () => {
    expect(filterNavGroups(groups, endpoints, identity, 'zzz')).toEqual([])
  })
})

describe('countMatchingEndpoints', () => {
  test('counts unique endpoints across filtered groups', () => {
    expect(countMatchingEndpoints(groups)).toBe(3)
    expect(
      countMatchingEndpoints(
        filterNavGroups(groups, endpoints, identity, '/v1/chat')
      )
    ).toBe(1)
    expect(countMatchingEndpoints([])).toBe(0)
  })
})
