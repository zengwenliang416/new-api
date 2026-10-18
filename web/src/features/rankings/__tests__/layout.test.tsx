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
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { Rankings } from '..'
import { RankingsHero } from '../components/rankings-hero'
import type { RankingsSnapshot } from '../types'

// Canvas rendering belongs to browser QA; these tests exercise page layout.
vi.mock('@visactor/react-vchart', () => ({ VChart: () => null }))
vi.mock('@visactor/vchart', () => ({
  ThemeManager: { setCurrentTheme: vi.fn() },
}))

let client: QueryClient | undefined

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useSystemConfigStore.getState().setLoading(false)
})

afterEach(() => {
  cleanup()
  client?.clear()
  client = undefined
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
})

describe('rankings layout and period navigation', () => {
  it('keeps the page heading available to screen readers without a large visible title', () => {
    render(<RankingsHero period='week' onPeriodChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Rankings' })).toHaveClass(
      'sr-only'
    )
    expect(
      screen.getByText(
        'Discover the most-used models and rising vendors on the platform, updated from live usage data.'
      )
    ).toBeVisible()
  })

  it('selects focused periods with Enter or Space after arrow-key navigation', async () => {
    const onPeriodChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <RankingsHero period='week' onPeriodChange={onPeriodChange} />
    )

    await user.tab()
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveFocus()
    expect(onPeriodChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onPeriodChange).toHaveBeenLastCalledWith('month')

    rerender(<RankingsHero period='month' onPeriodChange={onPeriodChange} />)
    expect(screen.getByRole('tab', { name: 'Month' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveAttribute(
      'aria-selected',
      'false'
    )
    await user.keyboard('{ArrowLeft}')
    expect(screen.getByRole('tab', { name: 'Week' })).toHaveFocus()
    await user.keyboard(' ')
    expect(onPeriodChange).toHaveBeenLastCalledWith('week')
  })

  it('keeps click selection controlled by the current period', async () => {
    const onPeriodChange = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <RankingsHero period='week' onPeriodChange={onPeriodChange} />
    )

    await user.click(screen.getByRole('tab', { name: 'Today' }))
    expect(onPeriodChange).toHaveBeenCalledWith('today')
    rerender(<RankingsHero period='today' onPeriodChange={onPeriodChange} />)
    expect(screen.getByRole('tab', { name: 'Today' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
  })

  it('allows period labels to scroll within a narrow screen without shrinking the controls', () => {
    render(<RankingsHero period='week' onPeriodChange={vi.fn()} />)

    expect(screen.getByRole('tablist', { name: 'Period' })).toHaveClass(
      'w-full',
      'max-w-full',
      'overflow-x-auto',
      'justify-start'
    )
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('shrink-0', 'flex-none')
    }
  })

  it('uses the available content width with compact gutters on narrow screens', async () => {
    client = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const snapshot: RankingsSnapshot = {
      models: [],
      vendors: [],
      top_movers: [],
      top_droppers: [],
      models_history: { points: [], models: [], buckets: 0 },
      vendor_share_history: { points: [], vendors: [], buckets: 0 },
    }
    client.setQueryData(['rankings', 'week'], {
      success: true,
      data: snapshot,
    })
    client.setQueryData(['status'], {})
    client.setQueryData(['notice'], { success: true, data: '' })
    const rootRoute = createRootRoute()
    const rankingsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/rankings/',
      component: Rankings,
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([rankingsRoute]),
      history: createMemoryHistory({ initialEntries: ['/rankings/'] }),
    })
    render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    )

    expect(await screen.findByRole('main')).toHaveClass(
      'w-full',
      'min-w-0',
      'max-w-[1800px]',
      'px-6',
      'xl:px-8',
      'pt-20'
    )
  })
})
