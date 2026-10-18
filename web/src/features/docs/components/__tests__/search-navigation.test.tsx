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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DocsApiPage } from '../docs-api-page'

const clients: QueryClient[] = []
let desktop = false
const originalGetAnimations = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)
const originalScrollTo = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'scrollTo'
)

async function renderDocumentation() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  clients.push(client)
  client.setQueryData(['status'], {})
  client.setQueryData(['notice'], { success: true, data: '' })
  const root = createRootRoute({ component: DocsApiPage })
  const route = createRoute({
    getParentRoute: () => root,
    path: '/docs/api',
  })
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/docs/api'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return screen.findByRole('button', { name: 'Endpoints' })
}

beforeEach(() => {
  desktop = false
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useSystemConfigStore.getState().setLoading(false)
  window.history.replaceState(null, '', '/')
  const originalMatchMedia = window.matchMedia
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    ...originalMatchMedia(query),
    matches:
      query === '(min-width: 1024px)'
        ? desktop
        : originalMatchMedia(query).matches,
  }))
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: vi.fn(),
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
  window.history.replaceState(null, '', '/')
  document.body.style.overflow = ''
  for (const [name, descriptor] of [
    ['getAnimations', originalGetAnimations],
    ['scrollTo', originalScrollTo],
  ] as const) {
    if (descriptor) {
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, name)
    }
  }
})

describe('API documentation search navigation', () => {
  test.each(['Control', 'Meta'])(
    '%s+K on a narrow viewport opens and focuses the visible search, then Escape returns to the trigger',
    async (modifier) => {
      const user = userEvent.setup()
      const trigger = await renderDocumentation()
      await user.keyboard(`{${modifier}>}k{/${modifier}}`)

      const sheet = await screen.findByRole('dialog', { name: 'Endpoints' })
      await waitFor(() => {
        expect(
          within(sheet).getByRole('textbox', {
            name: 'Search API documentation',
          })
        ).toHaveFocus()
      })
      await user.keyboard('{Escape}')
      await waitFor(() => {
        expect(
          screen.queryByRole('dialog', { name: 'Endpoints' })
        ).not.toBeInTheDocument()
        expect(trigger).toHaveFocus()
      })
    }
  )

  test('selecting a filtered endpoint closes the sheet, updates the article, and restores focus', async () => {
    const user = userEvent.setup()
    const trigger = await renderDocumentation()
    await user.click(trigger)
    const sheet = await screen.findByRole('dialog', { name: 'Endpoints' })
    const search = within(sheet).getByRole('textbox', {
      name: 'Search API documentation',
    })
    await waitFor(() => expect(search).toHaveFocus())
    await user.type(search, '/v1/rerank')
    await user.keyboard('{Enter}')
    await user.click(
      await within(sheet).findByRole('button', {
        name: /Create rerank request/,
      })
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Endpoints' })
      ).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole('heading', { level: 1, name: 'Create rerank request' })
    ).toBeVisible()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  test('pressing the shortcut again in an open sheet returns focus to its search input', async () => {
    const user = userEvent.setup()
    await renderDocumentation()
    await user.click(screen.getByRole('button', { name: 'Endpoints' }))
    const sheet = await screen.findByRole('dialog', { name: 'Endpoints' })
    await user.click(within(sheet).getByRole('button', { name: 'Search' }))
    await user.keyboard('{Control>}k{/Control}')
    expect(
      within(sheet).getByRole('textbox', { name: 'Search API documentation' })
    ).toHaveFocus()
  })

  test('desktop shortcuts focus the sidebar search without opening the mobile sheet', async () => {
    desktop = true
    const user = userEvent.setup()
    await renderDocumentation()
    await user.keyboard('{Meta>}k{/Meta}')

    expect(
      screen.getByRole('textbox', { name: 'Search API documentation' })
    ).toHaveFocus()
    expect(
      screen.queryByRole('dialog', { name: 'Endpoints' })
    ).not.toBeInTheDocument()
  })
})
