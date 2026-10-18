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
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, type AxiosAdapter } from 'axios'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  afterEach,
  beforeEach,
  expect,
  test,
  vi,
  type MockInstance,
} from 'vitest'

import { useUpdateOption } from '@/features/system-settings/hooks/use-update-option'
import { api } from '@/lib/http-client'
import { createAppQueryClient } from '@/lib/query-client'
import { useAuthStore } from '@/stores/auth-store'

import {
  SUPPORT_SESSION_QUERY_KEY,
  SUPPORT_SUMMARY_QUERY_KEY,
  useSupportSession,
} from '../../hooks/use-support-session'
import type { SupportSession } from '../../types'
import { SupportPage } from '../support-page'

const session: SupportSession = {
  worker_url: 'https://support.example.invalid',
  token: 'fixture-session',
  user: { id: 7, email: 'owner@example.invalid' },
  notify: { configured: true, label: 'email', target: 'owner@example.invalid' },
}
const originalAdapter = api.defaults.adapter
let queryClient: QueryClient
let sessionPayload: unknown
let sessionStatus: number
let summaryMessage: string | null
let summaryStatus: number
let notify: MockInstance<typeof toast.error>
const redirectToServerError = vi.fn()

beforeEach(() => {
  useAuthStore.getState().auth.setUser({
    id: 7,
    username: 'owner',
    role: 1,
  })
  queryClient = createAppQueryClient(redirectToServerError)
  queryClient.setQueryData(['status'], { ticket_translation_enabled: false })
  sessionPayload = { success: true, data: session }
  sessionStatus = 200
  summaryMessage = null
  summaryStatus = 403
  notify = vi.spyOn(toast, 'error').mockReturnValue('support-error')
  const adapter: AxiosAdapter = async (config) => {
    const isSession = config.url === '/api/support/session'
    const response = {
      data: isSession ? sessionPayload : { success: true },
      status: isSession ? sessionStatus : 200,
      statusText: 'OK',
      headers: {},
      config,
    }
    if (response.status >= 400) {
      throw new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        config,
        undefined,
        response
      )
    }
    return response
  }
  api.defaults.adapter = adapter
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const isSummary = String(input).includes('/api/tickets/summary')
      if (isSummary && summaryMessage) {
        return new Response(
          JSON.stringify({ success: false, message: summaryMessage }),
          { status: summaryStatus }
        )
      }
      const data = isSummary
        ? { unread_count: 2, status_counts: { open: 2 } }
        : { items: [], next_cursor: null }
      return new Response(JSON.stringify({ success: true, data }), {
        headers: { 'Content-Type': 'application/json' },
      })
    })
  )
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  api.defaults.adapter = originalAdapter
  useAuthStore.getState().auth.reset()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function QueryProvider(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {props.children}
    </QueryClientProvider>
  )
}

function renderSupportPage() {
  return render(
    <SupportPage scope='user' search={{}} onSearchChange={vi.fn()} />,
    { wrapper: QueryProvider }
  )
}

test('an optional header session check remains silent when the worker is not configured', async () => {
  sessionPayload = {
    success: false,
    message: 'support worker is not configured',
  }
  const { result } = renderHook(() => useSupportSession('user'), {
    wrapper: QueryProvider,
  })

  await waitFor(() => expect(result.current.error).not.toBeNull())

  expect(notify).not.toHaveBeenCalled()
  expect(result.current.session).toBeNull()
  expect(fetch).not.toHaveBeenCalled()
})

test('a support page with no configured worker explains the unavailable feature without offering ticket actions', async () => {
  sessionPayload = {
    success: false,
    message: 'support worker is not configured',
  }
  renderSupportPage()

  expect(await screen.findByText('Support Center is not enabled')).toBeVisible()
  expect(
    screen.getByText('Please contact your site administrator for assistance.')
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'New ticket' })).toBeNull()
  expect(screen.queryByPlaceholderText('Search tickets')).toBeNull()
  expect(notify).not.toHaveBeenCalled()
})

test('retrying an unavailable support page obtains a session and restores ticket creation', async () => {
  sessionPayload = {
    success: false,
    message: 'support worker is not configured',
  }
  renderSupportPage()
  await screen.findByText('Support Center is not enabled')
  sessionPayload = { success: true, data: session }

  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))

  const buttons = await screen.findAllByRole('button', { name: 'New ticket' })
  await userEvent.setup().click(buttons[0])
  expect(
    await screen.findByRole('button', { name: 'Submit ticket' })
  ).toBeVisible()
  expect(screen.queryByText('Support Center is not enabled')).toBeNull()
  expect(notify).not.toHaveBeenCalled()
})

test('an unresolved support session shows loading instead of an empty ticket workspace', async () => {
  let finish!: (payload: unknown) => void
  const pending = new Promise<unknown>((resolve) => {
    finish = resolve
  })
  api.defaults.adapter = async (config) => ({
    data: await pending,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  renderSupportPage()

  try {
    expect(await screen.findByText('Loading...')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'New ticket' })).toBeNull()
  } finally {
    await act(async () => finish({ success: true, data: session }))
  }
  expect(
    await screen.findAllByRole('button', { name: 'New ticket' })
  ).not.toHaveLength(0)
})

test.each([
  [200, 'support worker jwt secret is not configured'],
  [200, 'Support user verification failed'],
  [200, 'user is disabled'],
  [403, 'Support admin verification failed'],
])(
  'a configured support session failure (%s, %s) stays visible as an error',
  async (status, message) => {
    sessionStatus = status
    sessionPayload = { success: false, message }
    renderSupportPage()

    expect(await screen.findByText(message)).toBeVisible()
    expect(screen.queryByText('Support Center is not enabled')).toBeNull()
    expect(screen.queryByRole('button', { name: 'New ticket' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible()
  }
)

test('a background summary failure remains silent and visible in the hook error result', async () => {
  const { result } = renderHook(() => useSupportSession('user'), {
    wrapper: QueryProvider,
  })
  await waitFor(() => expect(result.current.unreadCount).toBe(2))
  summaryMessage = 'Support admin verification failed'

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
  })

  await waitFor(() =>
    expect(result.current.error?.message).toBe(
      'Support admin verification failed'
    )
  )
  expect(notify).not.toHaveBeenCalled()
})

test('a summary failure is visible in the support page while ticket actions remain usable', async () => {
  summaryMessage = 'Support admin verification failed'
  renderSupportPage()

  expect(await screen.findByText(summaryMessage)).toBeVisible()
  expect(
    screen.getAllByRole('button', { name: 'New ticket' })
  ).not.toHaveLength(0)
  expect(notify).not.toHaveBeenCalled()
})

test('saving worker configuration refreshes an unavailable session without a page reload', async () => {
  sessionPayload = {
    success: false,
    message: 'support worker is not configured',
  }
  const { result } = renderHook(
    () => ({ support: useSupportSession('user'), update: useUpdateOption() }),
    { wrapper: QueryProvider }
  )
  await waitFor(() => expect(result.current.support.error).not.toBeNull())
  sessionPayload = { success: true, data: session }

  await act(async () => {
    await result.current.update.mutateAsync({
      key: 'SupportWorkerUrl',
      value: session.worker_url,
    })
  })

  await waitFor(() => expect(result.current.support.session).not.toBeNull())
  expect(result.current.support.error).toBeNull()
})

test('disabling a previously configured worker hides stale ticket actions', async () => {
  renderSupportPage()
  await screen.findAllByRole('button', { name: 'New ticket' })
  sessionPayload = {
    success: false,
    message: 'support worker is not configured',
  }

  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: SUPPORT_SESSION_QUERY_KEY })
  })

  expect(await screen.findByText('Support Center is not enabled')).toBeVisible()
  expect(screen.queryByRole('button', { name: 'New ticket' })).toBeNull()
})

test.each(['session', 'summary'])(
  'a support %s HTTP 500 stays inside the support page without a global redirect or toast',
  async (request) => {
    if (request === 'session') {
      sessionStatus = 500
      sessionPayload = {
        success: false,
        message: 'Support worker request failed',
      }
    } else {
      summaryMessage = 'Support worker request failed'
      summaryStatus = 500
    }
    renderSupportPage()

    expect(
      await screen.findByText('Support worker request failed')
    ).toBeVisible()
    expect(screen.queryByText('Support Center is not enabled')).toBeNull()
    expect(redirectToServerError).not.toHaveBeenCalled()
    expect(notify).not.toHaveBeenCalled()
  }
)

test('an ordinary HTTP 500 query retains the global server-error redirect', async () => {
  api.defaults.adapter = async (config) => {
    throw new AxiosError(
      'Internal server error',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        data: { success: false, message: 'Internal server error' },
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        config,
      }
    )
  }

  await expect(
    queryClient.fetchQuery({
      queryKey: ['ordinary-request'],
      queryFn: () => api.get('/ordinary-request'),
      retry: false,
      meta: { errorToast: false },
    })
  ).rejects.toThrow('Internal server error')

  expect(redirectToServerError).toHaveBeenCalledOnce()
})
