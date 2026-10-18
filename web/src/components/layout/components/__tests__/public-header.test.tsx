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
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { DirectionProvider } from '@/context/direction-provider'
import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { AuthenticatedLayout } from '../authenticated-layout'
import { PublicHeader } from '../public-header'
import { PublicLayout } from '../public-layout'

const clients: QueryClient[] = []

function renderLayout(content: ReactNode, path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  client.setQueryData(['status'], {})
  client.setQueryData(['notice'], { success: true, data: '' })
  const rootRoute = createRootRoute({ component: () => content })
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
  const otherRoute = createRoute({ getParentRoute: () => rootRoute, path: '$' })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, otherRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  render(
    <QueryClientProvider client={client}>
      <DirectionProvider>
        <RouterProvider router={router} />
      </DirectionProvider>
    </QueryClientProvider>
  )
}

async function renderHeader(path = '/') {
  renderLayout(<PublicHeader />, path)
  return screen.findByRole('button', { name: 'Toggle navigation menu' })
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useSystemConfigStore.getState().setLoading(false)
  document.body.style.overflow = ''
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

describe('layout brand surfaces', () => {
  test('uses the compact content surface for public pages unless the home surface is requested', async () => {
    useSystemConfigStore.getState().setConfig({ siteBrand: 'motioncover' })
    renderLayout(
      <PublicLayout>
        <h1>Public content</h1>
      </PublicLayout>
    )

    const heading = await screen.findByRole('heading', {
      name: 'Public content',
    })
    const surface = heading.closest('[data-public-brand]')
    expect(surface).toHaveAttribute('data-public-brand', 'motioncover')
    expect(surface).toHaveAttribute('data-public-surface', 'content')
    expect(surface).toContainElement(screen.getByRole('banner'))
  })

  test('keeps the home surface on the shared public shell when explicitly selected', async () => {
    useSystemConfigStore.getState().setConfig({ siteBrand: 'motioncover' })
    renderLayout(
      <PublicLayout surface='home'>
        <h1>Home content</h1>
      </PublicLayout>
    )

    const heading = await screen.findByRole('heading', { name: 'Home content' })
    expect(heading.closest('[data-public-brand]')).toHaveAttribute(
      'data-public-surface',
      'home'
    )
  })

  test('applies the configured console brand to the shared header, sidebar, and page content', async () => {
    useSystemConfigStore.getState().setConfig({ siteBrand: 'motioncover' })
    renderLayout(
      <AuthenticatedLayout>
        <h1>Console content</h1>
      </AuthenticatedLayout>,
      '/dashboard'
    )

    const heading = await screen.findByRole('heading', {
      name: 'Console content',
    })
    const surface = heading.closest('[data-console-brand]')
    expect(surface).toHaveAttribute('data-console-brand', 'motioncover')
    expect(surface).toContainElement(screen.getByRole('banner'))
    expect(surface).toContainElement(screen.getByRole('main'))
    expect(surface).toContainElement(
      screen.getAllByRole('button', { name: 'Toggle Sidebar' })[0]
    )
    expect(surface).not.toHaveAttribute('data-public-brand')
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
  document.body.style.overflow = ''
  document.documentElement.removeAttribute('dir')
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 })
})

describe('public header navigation', () => {
  test('keeps the closed mobile navigation inert and exposes its toggle state', async () => {
    const toggle = await renderHeader()

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const panel = document.querySelector(
      `[id="${toggle.getAttribute('aria-controls')}"]`
    )
    expect(panel).toHaveAttribute('inert')
    expect(panel).toHaveAttribute('aria-hidden', 'true')

    await userEvent.setup().click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel).not.toHaveAttribute('inert')
    expect(panel).toHaveAttribute('aria-hidden', 'false')
  })

  test('allows an expanded mobile menu to grow and scroll vertically while body scrolling is locked', async () => {
    const toggle = await renderHeader()
    await userEvent.setup().click(toggle)
    const panel = document.querySelector<HTMLElement>(
      `[id="${toggle.getAttribute('aria-controls')}"]`
    )
    assert(panel, 'Mobile navigation panel must exist')

    expect(document.body.style.overflow).toBe('hidden')
    expect(panel).toHaveClass('overflow-y-auto', 'overflow-x-hidden')
    expect(panel.firstElementChild).toHaveClass('min-h-full')
    expect(panel.firstElementChild).not.toHaveClass('h-full')
    expect(within(panel).getByRole('link', { name: 'Sign in' })).toBeVisible()
  })

  test('closes the mobile menu with Escape and returns focus and prior scroll state', async () => {
    document.body.style.overflow = 'auto'
    const toggle = await renderHeader()
    const user = userEvent.setup()
    await user.click(toggle)
    const panel = document.querySelector<HTMLElement>(
      `[id="${toggle.getAttribute('aria-controls')}"]`
    )
    assert(panel, 'Mobile navigation panel must exist')
    within(panel).getByRole('link', { name: 'Docs' }).focus()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveFocus()
    expect(document.body.style.overflow).toBe('auto')
  })

  test('closes an expanded mobile menu when the desktop navigation becomes available', async () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>()
    const originalMatchMedia = window.matchMedia
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      if (query !== '(min-width: 1024px)') return originalMatchMedia(query)
      return {
        ...originalMatchMedia(query),
        addEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void
        ) => listeners.add(listener),
        removeEventListener: (
          _type: string,
          listener: (event: MediaQueryListEvent) => void
        ) => listeners.delete(listener),
      } as MediaQueryList
    })
    const toggle = await renderHeader()
    await userEvent.setup().click(toggle)

    act(() => {
      for (const listener of listeners) {
        listener({ matches: true } as MediaQueryListEvent)
      }
    })

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(document.body.style.overflow).toBe('')
  })

  test('retains a readable desktop navigation width after scrolling', async () => {
    await renderHeader()
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 50 })

    fireEvent.scroll(window)

    expect(screen.getByRole('banner').firstElementChild).toHaveClass(
      'max-w-6xl'
    )
  })

  test('orders desktop actions as notifications, language, theme, and sign in', async () => {
    await renderHeader()
    const header = within(screen.getByRole('banner'))
    const notifications = header.getByRole('button', { name: 'Notifications' })
    const language = header.getByRole('button', { name: 'Change language' })
    const theme = header.getAllByRole('button', { name: 'Toggle theme' })[0]
    const signIn = header.getByRole('button', { name: 'Sign in' })

    expect(notifications.compareDocumentPosition(language)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(language.compareDocumentPosition(theme)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
    expect(theme.compareDocumentPosition(signIn)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  test.each([
    ['/', 'Home'],
    ['/docs/guides/quick-start', 'Docs'],
    ['/docs-extra', null],
  ])(
    'highlights only the matching navigation section at %s',
    async (path, activeTitle) => {
      await renderHeader(path)
      const header = within(screen.getByRole('banner'))

      for (const title of ['Home', 'Docs']) {
        const link = header.getByRole('link', { name: title })
        if (title === activeTitle) {
          expect(link).toHaveAttribute('aria-current', 'page')
          expect(link).toHaveClass('bg-muted')
        } else {
          expect(link).not.toHaveAttribute('aria-current')
          expect(link).not.toHaveClass('bg-muted')
        }
      }
    }
  )
})
