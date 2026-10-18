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
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { DocsApiPage } from '../docs-api-page'
import { DocsAssistantPreview } from '../docs-assistant-preview'
import { DocsCredentialPreview } from '../docs-credential-preview'
import { DocsGuidePage } from '../docs-guide-page'
import { DocsHomePage } from '../docs-home-page'
import { DocsShell } from '../docs-shell'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight
const clients: QueryClient[] = []
const originalGetAnimations = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(
    new Error('Preview must stay offline')
  )
  vi.spyOn(XMLHttpRequest.prototype, 'open')
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  localStorage.clear()
  if (originalGetAnimations) {
    Object.defineProperty(
      HTMLElement.prototype,
      'getAnimations',
      originalGetAnimations
    )
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalWidth,
  })
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: originalHeight,
  })
})

async function renderDocsPage(page: ReactNode) {
  localStorage.clear()
  useAuthStore.getState().auth.reset()
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  useSystemConfigStore.getState().setLoading(false)
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  clients.push(client)
  client.setQueryData(['status'], {})
  client.setQueryData(['notice'], { success: true, data: '' })
  const root = createRootRoute({ component: () => page })
  const route = createRoute({ getParentRoute: () => root, path: '/docs' })
  const router = createRouter({
    routeTree: root.addChildren([route]),
    history: createMemoryHistory({ initialEntries: ['/docs'] }),
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  return screen.findByRole('button', { name: 'Ask AI' })
}

describe('documentation interface previews', () => {
  test('opens the assistant with input focus and restores the launcher after closing', async () => {
    const user = userEvent.setup()
    render(<DocsAssistantPreview />)
    const launcher = screen.getByRole('button', { name: 'Ask AI' })
    await user.click(launcher)

    const panel = await screen.findByRole('dialog', {
      name: 'Docs AI assistant',
    })
    await waitFor(() =>
      expect(
        within(panel).getByRole('textbox', { name: 'Ask AI' })
      ).toHaveFocus()
    )
    expect(
      within(panel).getByText(
        'UI preview only. AI answers are not connected yet.'
      )
    ).toBeVisible()
    await user.click(within(panel).getByRole('button', { name: 'Close' }))

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(launcher).toHaveFocus()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled()
  })

  test('suggestions fill the draft, sending remains disabled, and clear only resets the draft', async () => {
    const user = userEvent.setup()
    render(<DocsAssistantPreview />)
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const panel = await screen.findByRole('dialog', {
      name: 'Docs AI assistant',
    })
    const input = within(panel).getByRole('textbox', { name: 'Ask AI' })
    const suggestions = [
      'Claude Code cannot connect — how do I fix it?',
      'What does a 429 error mean here?',
      'Which base URL should my SDK use?',
    ]
    for (const question of suggestions) {
      await user.click(within(panel).getByRole('button', { name: question }))
      expect(input).toHaveValue(question)
      expect(input).toHaveFocus()
    }
    expect(within(panel).getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(within(panel).queryByRole('log')).not.toBeInTheDocument()
    await user.click(
      within(panel).getByRole('button', { name: 'Clear conversation' })
    )
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('Escape closes the nonmodal assistant and returns keyboard focus', async () => {
    const user = userEvent.setup()
    render(<DocsAssistantPreview />)
    const launcher = screen.getByRole('button', { name: 'Ask AI' })
    await user.click(launcher)
    await screen.findByRole('dialog', { name: 'Docs AI assistant' })
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(launcher).toHaveFocus()
  })

  test('the page remains interactive while the assistant preview stays open', async () => {
    const user = userEvent.setup()
    const onPageAction = vi.fn()
    render(
      <>
        <button type='button' onClick={onPageAction}>
          Page action
        </button>
        <DocsAssistantPreview />
      </>
    )
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    await screen.findByRole('dialog', { name: 'Docs AI assistant' })
    await user.click(screen.getByRole('button', { name: 'Page action' }))
    expect(onPageAction).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('dialog', { name: 'Docs AI assistant' })
    ).toBeVisible()
  })

  test('a narrow viewport bounds both panel dimensions and lets suggestions scroll independently', async () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 320,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 480,
    })
    const user = userEvent.setup()
    render(<DocsAssistantPreview />)
    await user.click(screen.getByRole('button', { name: 'Ask AI' }))
    const panel = await screen.findByRole('dialog', {
      name: 'Docs AI assistant',
    })
    expect(panel).toHaveClass(
      'w-[min(24rem,calc(100vw-2rem))]',
      'h-[min(34rem,calc(100dvh-3rem))]'
    )
    expect(
      within(panel).getByRole('region', { name: 'Suggested questions' })
    ).toHaveClass('min-h-0', 'overflow-y-auto')
    expect(within(panel).getByRole('button', { name: 'Close' })).toBeVisible()
    expect(within(panel).getByRole('textbox', { name: 'Ask AI' })).toBeVisible()
  })

  test('the credential bar stays disabled and explicitly identifies its preview boundary', async () => {
    const user = userEvent.setup()
    render(<DocsCredentialPreview />)
    const selector = screen.getByRole('combobox', { name: 'Select an API key' })
    expect(selector).toBeDisabled()
    expect(
      screen.getByText('UI preview only. API keys are not read or injected.')
    ).toBeVisible()
    await user.click(selector)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(XMLHttpRequest.prototype.open).not.toHaveBeenCalled()
  })

  test.each([
    ['home', <DocsHomePage key='home' />],
    ['API reference', <DocsApiPage key='api' />],
    [
      'guide',
      <DocsShell key='guide' active='quick-start'>
        <DocsGuidePage slug='quick-start' />
      </DocsShell>,
    ],
  ])(
    'exposes one assistant launcher on the %s documentation page',
    async (_name, page) => {
      await renderDocsPage(page)
      expect(screen.getAllByRole('button', { name: 'Ask AI' })).toHaveLength(1)
    }
  )

  test('the guide places its disabled credential preview after Markdown copy without changing copied content', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    await renderDocsPage(
      <DocsShell active='quick-start'>
        <DocsGuidePage slug='quick-start' />
      </DocsShell>
    )
    const copy = screen.getByRole('button', { name: 'Copy Markdown' })
    const selector = screen.getByRole('combobox', { name: 'Select an API key' })
    expect(
      copy.compareDocumentPosition(selector) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    await user.click(copy)
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('NEW_API_KEY')
    )
    expect(writeText).not.toHaveBeenCalledWith(
      expect.stringContaining('UI preview only')
    )
  })
})
