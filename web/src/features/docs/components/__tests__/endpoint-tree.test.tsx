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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'

import { EndpointTree } from '@/features/docs/components/endpoint-tree'
import { ENDPOINT_MAP } from '@/features/docs/data/api-endpoints'
import { API_NAV_GROUPS } from '@/features/docs/data/api-nav-groups'
import { filterNavGroups } from '@/features/docs/lib/search-endpoints'

const identity = (key: string) => key

describe('endpoint tree navigation', () => {
  test('expands the active endpoint group and collapses the others', () => {
    render(
      <EndpointTree
        activeEndpointId='chat-completions'
        activeQuery=''
        groups={API_NAV_GROUPS}
        onEndpointSelect={vi.fn()}
      />
    )

    expect(
      screen.getByRole('button', { name: /ChatCompletions/ })
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.queryByText('Create image generation')
    ).not.toBeInTheDocument()
  })

  test('navigates into a collapsed group and selects an endpoint', async () => {
    const onEndpointSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <EndpointTree
        activeEndpointId='chat-completions'
        activeQuery=''
        groups={API_NAV_GROUPS}
        onEndpointSelect={onEndpointSelect}
      />
    )

    await user.click(screen.getByRole('button', { name: /^Embeddings/ }))
    await user.click(
      await screen.findByRole('button', {
        name: /OpenAI-compatible format/,
      })
    )
    await user.click(
      await screen.findByRole('button', { name: /Create embedding/ })
    )

    expect(onEndpointSelect).toHaveBeenCalledWith('embeddings-create')
  })

  test('toggles all groups through the expand and collapse control', async () => {
    const user = userEvent.setup()
    render(
      <EndpointTree
        activeEndpointId='chat-completions'
        activeQuery=''
        groups={API_NAV_GROUPS}
        onEndpointSelect={vi.fn()}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Expand All' }))
    expect(await screen.findByText('List models')).toBeInTheDocument()
    expect(screen.getByText('Create image generation')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Collapse All' }))
    expect(screen.queryByText('List models')).not.toBeInTheDocument()
    expect(
      screen.queryByText('Create image generation')
    ).not.toBeInTheDocument()
  })

  test('auto-expands filtered results and shows an empty state without matches', async () => {
    const { rerender } = render(
      <EndpointTree
        activeEndpointId='chat-completions'
        activeQuery='rerank'
        groups={filterNavGroups(
          API_NAV_GROUPS,
          ENDPOINT_MAP,
          identity,
          'rerank'
        )}
        onEndpointSelect={vi.fn()}
      />
    )

    expect(await screen.findByText('Create rerank request')).toBeInTheDocument()

    rerender(
      <EndpointTree
        activeEndpointId='chat-completions'
        activeQuery='zzz-no-match'
        groups={filterNavGroups(
          API_NAV_GROUPS,
          ENDPOINT_MAP,
          identity,
          'zzz-no-match'
        )}
        onEndpointSelect={vi.fn()}
      />
    )

    expect(await screen.findByText('No endpoints found')).toBeInTheDocument()
    expect(screen.queryByText('Create rerank request')).not.toBeInTheDocument()
  })
})
