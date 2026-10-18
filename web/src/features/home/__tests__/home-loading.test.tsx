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
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useSystemConfig } from '@/hooks/use-system-config'
import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { Home } from '..'

const clients: QueryClient[] = []
const apiClient = api as unknown as {
  get: (url: string) => Promise<{ data: unknown }>
}
const originalGet = apiClient.get

function SiteHome() {
  useSystemConfig({ autoLoad: true })
  return <Home />
}

function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const rootRoute = createRootRoute({ component: SiteHome })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  apiClient.get = originalGet
  localStorage.clear()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
})

describe('home configuration readiness', () => {
  test('waits for custom home content without flashing the default portal', async () => {
    let resolveContent!: (value: { data: unknown }) => void
    const pendingContent = new Promise<{ data: unknown }>((resolve) => {
      resolveContent = resolve
    })
    apiClient.get = async (url) => {
      if (url === '/api/home_page_content') return pendingContent
      if (url === '/api/status') {
        return { data: { success: true, data: { system_name: 'New API' } } }
      }
      if (url === '/api/notice') return { data: { success: true, data: '' } }
      throw new Error(`Unexpected GET ${url}`)
    }
    renderHome()
    expect(await screen.findByText('Loading...')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    await act(async () => {
      resolveContent({ data: { success: true, data: '# Configured home' } })
    })
    expect(
      await screen.findByRole('heading', { name: 'Configured home' })
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Clear routing, live pricing, published references',
      })
    ).not.toBeInTheDocument()
  })

  test('waits for live branding instead of rendering a stale operating identity', async () => {
    useSystemConfigStore
      .getState()
      .setConfig({ systemName: 'Stale Brand', siteBrand: 'shuai' })
    let resolveStatus!: (value: { data: unknown }) => void
    const pendingStatus = new Promise<{ data: unknown }>((resolve) => {
      resolveStatus = resolve
    })
    apiClient.get = async (url) => {
      if (url === '/api/status') return pendingStatus
      if (url === '/api/home_page_content' || url === '/api/notice') {
        return { data: { success: true, data: '' } }
      }
      throw new Error(`Unexpected GET ${url}`)
    }
    renderHome()
    expect(await screen.findByText('Loading...')).toBeVisible()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    await act(async () => {
      resolveStatus({
        data: {
          success: true,
          data: { system_name: 'New API', site_brand: 'shuai' },
        },
      })
    })
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'SHUAI API'
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'SHUAI API' })
    ).toBeInTheDocument()
    expect(screen.queryByText('Stale Brand')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'User Agreement' })
    ).not.toBeInTheDocument()
  })

  test('preserves explicitly configured hero text and exposes only enabled site terms', async () => {
    apiClient.get = async (url) => {
      if (url === '/api/status') {
        return {
          data: {
            success: true,
            data: {
              system_name: 'New API',
              site_brand: 'shuai',
              home_hero_title: 'Hlool API',
              home_hero_powered_by: 'Powered by {{systemName}}',
              user_agreement_enabled: true,
            },
          },
        }
      }
      if (url === '/api/home_page_content' || url === '/api/notice') {
        return { data: { success: true, data: '' } }
      }
      throw new Error(`Unexpected GET ${url}`)
    }
    renderHome()
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Hlool APIPowered by SHUAI API'
    )
    expect(
      screen.getByRole('heading', { level: 2, name: 'SHUAI API' })
    ).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', {
      name: 'User Agreement',
    })) {
      expect(link).toHaveAttribute('href', '/user-agreement')
    }
  })

  test('shows a retry action when live configuration fails instead of publishing stale portal content', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    useSystemConfigStore
      .getState()
      .setConfig({ systemName: 'Stale Brand', siteBrand: 'shuai' })
    let available = false
    apiClient.get = async (url) => {
      if (url === '/api/status') {
        if (!available) throw new Error('Status unavailable')
        return { data: { success: true, data: { system_name: 'New API' } } }
      }
      if (url === '/api/home_page_content' || url === '/api/notice') {
        return { data: { success: true, data: '' } }
      }
      throw new Error(`Unexpected GET ${url}`)
    }
    renderHome()
    const retry = await screen.findByRole('button', { name: 'Retry' })
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    available = true
    await userEvent.setup().click(retry)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'MotionCover AI'
    )
  })
})
