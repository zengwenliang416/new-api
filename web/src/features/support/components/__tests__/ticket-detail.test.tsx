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
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from '@tanstack/react-query'
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { createSupportTicket } from '../../api'
import type {
  SupportMessage,
  SupportSession,
  SupportTicketCreatePayload,
  SupportTicketDetail,
} from '../../types'
import { CreateTicketForm } from '../create-ticket-form'
import { TicketDetail } from '../ticket-detail'

const session: SupportSession = {
  worker_url: 'https://support.example.invalid',
  token: 'fixture-session',
  user: { id: 7, email: 'owner@example.invalid' },
  notify: { configured: true, label: 'email', target: 'owner@example.invalid' },
}

function message(id: number, body: string, language = 'en'): SupportMessage {
  return {
    id,
    body,
    sender_type: 'user',
    sender_lang: language,
    created_at: 1_700_000_000_000,
    attachments: [],
  }
}

function ticket(id: number): SupportTicketDetail {
  return {
    ticket: {
      id,
      user_id: 7,
      title: `Ticket ${id}`,
      status: 'open',
      category: 'other',
      priority: 'normal',
      verification_level: 'not_verified',
      unread_user: false,
      unread_admin: false,
      created_at: 1_700_000_000_000,
      updated_at: 1_700_000_000_000,
    },
    messages: [message(id * 10, `Latest message for ticket ${id}`)],
    next_cursor: id === 1 ? 'before-message-10' : null,
  }
}

function workerResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

function deferredResponse() {
  let resolve!: (response: Response) => void
  const promise = new Promise<Response>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

let queryClient: QueryClient

beforeEach(() => {
  useAuthStore.getState().auth.reset()
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
  toast.dismiss()
  useAuthStore.getState().auth.reset()
  vi.unstubAllGlobals()
})

function detailView(ticketId: number, onDeleted = vi.fn()) {
  return (
    <QueryClientProvider client={queryClient}>
      <TicketDetail
        scope='user'
        ticketId={ticketId}
        session={session}
        translationEnabled
        onDeleted={onDeleted}
        onTicketData={vi.fn()}
      />
    </QueryClientProvider>
  )
}

describe('support conversation requests', () => {
  test('retrying a reply after a lost response reuses its request ID, while the next successful submission gets a new ID', async () => {
    const requests: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        requests.push(JSON.parse(String(init.body)))
        if (requests.length === 1) throw new TypeError('Lost response')
      }
      return workerResponse(ticket(1))
    })
    const user = userEvent.setup()
    render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.type(
      screen.getByRole('textbox', { name: 'Write a reply...' }),
      'Reply'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(
        screen.getByRole('textbox', { name: 'Write a reply...' })
      ).toHaveValue('')
    )

    await user.type(
      screen.getByRole('textbox', { name: 'Write a reply...' }),
      'Reply'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[0].client_request_id).toEqual(expect.any(String))
    expect(requests[1].client_request_id).toBe(requests[0].client_request_id)
    expect(requests[2].client_request_id).not.toBe(
      requests[0].client_request_id
    )
  })

  test.each(['body', 'attachment', 'ticket'] as const)(
    'changing the %s after a failed reply starts a new operation',
    async (change) => {
      const requests: { path: string; body: Record<string, unknown> }[] = []
      vi.stubGlobal(
        'URL',
        Object.assign(class extends URL {}, {
          createObjectURL: vi.fn(() => 'blob:fixture-image'),
          revokeObjectURL: vi.fn(),
        })
      )
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const path = new URL(String(input)).pathname
        if (path === '/api/uploads/images') {
          return workerResponse({ key: 'uploaded-image', name: 'proof.png' })
        }
        if (init?.method === 'POST') {
          requests.push({ path, body: JSON.parse(String(init.body)) })
          throw new TypeError('Lost response')
        }
        return workerResponse(ticket(Number(path.split('/').at(-1))))
      })
      const user = userEvent.setup()
      const view = render(detailView(1))
      await screen.findByRole('heading', { name: 'Ticket 1' })
      await user.type(
        screen.getByRole('textbox', { name: 'Write a reply...' }),
        'Reply'
      )
      await user.click(screen.getByRole('button', { name: 'Send' }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      )

      if (change === 'body') {
        await user.type(
          screen.getByRole('textbox', { name: 'Write a reply...' }),
          ' with details'
        )
      } else if (change === 'attachment') {
        await user.upload(
          view.container.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement,
          new File(['image'], 'proof.png', { type: 'image/png' })
        )
        await waitFor(() =>
          expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
        )
      } else {
        view.rerender(detailView(2))
        await screen.findByRole('heading', { name: 'Ticket 2' })
        await user.type(
          screen.getByRole('textbox', { name: 'Write a reply...' }),
          'Reply'
        )
      }
      await user.click(screen.getByRole('button', { name: 'Send' }))

      await waitFor(() => expect(requests).toHaveLength(2))
      expect(requests[0].body.client_request_id).toEqual(expect.any(String))
      expect(requests[1].body.client_request_id).not.toBe(
        requests[0].body.client_request_id
      )
      if (change === 'attachment') {
        expect(requests[1].body.attachments).toEqual([
          expect.objectContaining({ key: 'uploaded-image' }),
        ])
      }
      if (change === 'ticket') {
        expect(requests[1].path).toBe('/api/tickets/2/messages')
      }
    }
  )

  test('a reply completed after switching tickets preserves the selected conversation and its draft', async () => {
    const reply = deferredResponse()
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST') return reply.promise
        return workerResponse(ticket(Number(url.pathname.split('/').at(-1))))
      })
    const user = userEvent.setup()
    const view = render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.type(
      screen.getByPlaceholderText('Write a reply...'),
      'Reply to ticket 1'
    )
    await user.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1/messages'),
        expect.objectContaining({ method: 'POST' })
      )
    )

    view.rerender(detailView(2))
    await screen.findByRole('heading', { name: 'Ticket 2' })
    await user.type(
      screen.getByPlaceholderText('Write a reply...'),
      'Draft for ticket 2'
    )
    await act(async () => reply.resolve(workerResponse(ticket(1))))

    expect(screen.getByRole('heading', { name: 'Ticket 2' })).toBeVisible()
    expect(screen.getByPlaceholderText('Write a reply...')).toHaveValue(
      'Draft for ticket 2'
    )
    expect(
      screen.queryByText('Latest message for ticket 1')
    ).not.toBeInTheDocument()
  })

  test('a history response arriving after switching tickets cannot add the previous conversation or cursor', async () => {
    const history = deferredResponse()
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        const url = new URL(String(input))
        if (url.pathname.endsWith('/messages')) return history.promise
        return workerResponse(ticket(Number(url.pathname.split('/').at(-1))))
      })
    const user = userEvent.setup()
    const view = render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.click(
      screen.getByRole('button', { name: 'Load earlier messages' })
    )
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tickets/1/messages'),
        expect.anything()
      )
    )

    view.rerender(detailView(2))
    await screen.findByRole('heading', { name: 'Ticket 2' })
    await act(async () =>
      history.resolve(
        workerResponse({
          items: [message(1, 'Private history of ticket 1')],
          next_cursor: 'before-message-1',
        })
      )
    )

    expect(
      screen.queryByText('Private history of ticket 1')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Load earlier messages' })
    ).not.toBeInTheDocument()
  })

  test('deleting the previous ticket after switching does not clear the current selection or conversation', async () => {
    const deletion = deferredResponse()
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.method === 'DELETE') return deletion.promise
      const detail = ticket(
        Number(new URL(String(input)).pathname.split('/').at(-1))
      )
      if (detail.ticket.id === 1) detail.ticket.status = 'closed'
      return workerResponse(detail)
    })
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    const view = render(detailView(1, onDeleted))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Delete',
      })
    )

    view.rerender(detailView(2, onDeleted))
    await screen.findByRole('heading', { name: 'Ticket 2' })
    await act(async () => deletion.resolve(workerResponse(null)))

    expect(onDeleted).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'Ticket 2' })).toBeVisible()
  })

  test('the last history page removes the load button and remains exhausted after refreshing the detail', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (new URL(String(input)).pathname.endsWith('/messages')) {
        return workerResponse({
          items: [message(1, 'First message')],
          next_cursor: null,
        })
      }
      return workerResponse(ticket(1))
    })
    const user = userEvent.setup()
    render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.click(
      screen.getByRole('button', { name: 'Load earlier messages' })
    )
    await screen.findByText('First message')
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['support-ticket'] })
    })

    expect(
      screen.queryByRole('button', { name: 'Load earlier messages' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('First message')).toBeVisible()
  })

  test('history translations returned with a page are available without another translation request', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input) => {
        if (new URL(String(input)).pathname.endsWith('/messages')) {
          return workerResponse({
            items: [message(1, '原始历史消息', 'zh-CN')],
            translations: {
              1: { body: 'Translated history', status: 'reviewed' },
            },
            next_cursor: null,
          })
        }
        return workerResponse(ticket(1))
      })
    const user = userEvent.setup()
    render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.click(
      screen.getByRole('button', { name: 'Load earlier messages' })
    )
    await screen.findByText('原始历史消息')
    await user.click(screen.getByRole('button', { name: 'Show translation' }))

    expect(screen.getByText('Translated history')).toBeVisible()
    expect(
      fetch.mock.calls.some(([input]) => String(input).includes('/translate'))
    ).toBe(false)
  })

  test('a missing translation is requested on demand and a failed attempt can be retried', async () => {
    let translationAttempts = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (new URL(String(input)).pathname.endsWith('/translate')) {
        translationAttempts++
        if (translationAttempts === 1) {
          return new Response(
            JSON.stringify({ success: false, message: 'Translation failed' }),
            { status: 503 }
          )
        }
        return workerResponse({
          body: 'Requested translation',
          status: 'machine',
        })
      }
      const detail = ticket(1)
      detail.messages = [message(10, '需要翻译的消息', 'zh-CN')]
      return workerResponse(detail)
    })
    const user = userEvent.setup()
    render(detailView(1))
    await screen.findByRole('heading', { name: 'Ticket 1' })
    await user.click(screen.getByRole('button', { name: 'Show translation' }))
    await waitFor(() => expect(translationAttempts).toBe(1))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Show translation' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Show translation' }))

    expect(await screen.findByText('Requested translation')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Show original' }))
    expect(screen.getByText('需要翻译的消息')).toBeVisible()
    expect(translationAttempts).toBe(2)
  })

  test('an initial detail failure presents a retry action that restores the conversation', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValue(workerResponse(ticket(1)))
    const user = userEvent.setup()
    render(detailView(1))
    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('heading', { name: 'Ticket 1' })
    ).toBeVisible()
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

function CreateTicketHarness() {
  const mutation = useMutation({
    mutationFn: (payload: SupportTicketCreatePayload) =>
      createSupportTicket(session, payload),
  })
  return (
    <CreateTicketForm
      session={session}
      isSubmitting={mutation.isPending}
      onSubmit={async (payload) => {
        await mutation.mutateAsync(payload)
      }}
      onCancel={vi.fn()}
    />
  )
}

describe('support ticket submission requests', () => {
  test('retrying a ticket after a lost response reuses its request ID, while a successful submission clears it', async () => {
    const requests: Record<string, unknown>[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)))
      if (requests.length === 1) throw new TypeError('Lost response')
      return workerResponse(ticket(1))
    })
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <CreateTicketHarness />
      </QueryClientProvider>
    )
    await user.type(screen.getByRole('textbox', { name: 'Subject' }), 'Help')
    await user.type(screen.getByRole('textbox', { name: 'Details' }), 'Details')
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Submit ticket' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Submit ticket' })
      ).toBeEnabled()
    )
    await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

    await waitFor(() => expect(requests).toHaveLength(3))
    expect(requests[0].client_request_id).toEqual(expect.any(String))
    expect(requests[1].client_request_id).toBe(requests[0].client_request_id)
    expect(requests[2].client_request_id).not.toBe(
      requests[0].client_request_id
    )
  })

  test.each(['subject', 'attachment'] as const)(
    'changing the %s after a failed ticket submission starts a new operation',
    async (change) => {
      const requests: Record<string, unknown>[] = []
      vi.stubGlobal(
        'URL',
        Object.assign(class extends URL {}, {
          createObjectURL: vi.fn(() => 'blob:fixture-image'),
          revokeObjectURL: vi.fn(),
        })
      )
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        if (new URL(String(input)).pathname === '/api/uploads/images') {
          return workerResponse({ key: 'uploaded-image', name: 'proof.png' })
        }
        requests.push(JSON.parse(String(init?.body)))
        throw new TypeError('Lost response')
      })
      const user = userEvent.setup()
      const view = render(
        <QueryClientProvider client={queryClient}>
          <CreateTicketHarness />
        </QueryClientProvider>
      )
      await user.type(screen.getByRole('textbox', { name: 'Subject' }), 'Help')
      await user.type(
        screen.getByRole('textbox', { name: 'Details' }),
        'Details'
      )
      await user.click(screen.getByRole('button', { name: 'Submit ticket' }))
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Submit ticket' })
        ).toBeEnabled()
      )

      if (change === 'subject') {
        await user.type(
          screen.getByRole('textbox', { name: 'Subject' }),
          ' with upload'
        )
      } else {
        await user.upload(
          view.container.querySelector(
            'input[type="file"]'
          ) as HTMLInputElement,
          new File(['image'], 'proof.png', { type: 'image/png' })
        )
        await waitFor(() =>
          expect(
            screen.getByRole('button', { name: 'Submit ticket' })
          ).toBeEnabled()
        )
      }
      await user.click(screen.getByRole('button', { name: 'Submit ticket' }))

      await waitFor(() => expect(requests).toHaveLength(2))
      expect(requests[0].client_request_id).toEqual(expect.any(String))
      expect(requests[1].client_request_id).not.toBe(
        requests[0].client_request_id
      )
    }
  )
})
