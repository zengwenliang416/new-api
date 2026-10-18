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
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'

import { Workspace } from '..'

function renderWorkspace() {
  return render(
    <TooltipProvider>
      <Workspace />
    </TooltipProvider>
  )
}

describe('Workspace interface preview', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  test('typing and pressing Enter keep the draft visible without sending a request or reading or writing saved conversations', async () => {
    const user = userEvent.setup()
    localStorage.setItem('workspace:v1:user:7', 'previous-conversations')
    localStorage.setItem('playground_messages', 'existing-playground')
    const read = vi.spyOn(Storage.prototype, 'getItem')
    const write = vi.spyOn(Storage.prototype, 'setItem')
    const get = vi
      .spyOn(api, 'get')
      .mockRejectedValue(new Error('Unexpected request'))
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValue(new Error('Unexpected request'))
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Unexpected request'))
    const view = renderWorkspace()

    expect(screen.getByRole('note')).toHaveTextContent(
      'Interface preview. Messages are not sent or saved.'
    )
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.type(
      screen.getByRole('textbox', { name: 'Message' }),
      'Preview only{Enter}'
    )
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue(
      'Preview only'
    )
    expect(screen.queryByRole('log')).not.toBeInTheDocument()
    view.unmount()
    expect(read).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    read.mockRestore()
    expect(localStorage.getItem('workspace:v1:user:7')).toBe(
      'previous-conversations'
    )
    expect(localStorage.getItem('playground_messages')).toBe(
      'existing-playground'
    )
  })

  test('creating, renaming, searching, switching and deleting conversations only change this mounted preview', async () => {
    const user = userEvent.setup()
    const view = renderWorkspace()
    expect(screen.getByText('No conversations yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New conversation' }))
    await user.click(
      screen.getByRole('button', {
        name: 'Conversation actions for New conversation',
      })
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Rename' }))
    const name = await screen.findByRole('textbox', {
      name: 'Conversation name',
    })
    await user.clear(name)
    await user.type(name, 'First preview')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'A draft to switch back to' },
    })
    await user.click(screen.getByRole('button', { name: 'New conversation' }))
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
    await user.type(
      screen.getByRole('searchbox', { name: 'Search conversations' }),
      'first'
    )
    expect(
      screen.queryByRole('button', {
        name: 'Open conversation New conversation',
      })
    ).not.toBeInTheDocument()
    await user.click(
      screen.getByRole('button', { name: 'Open conversation First preview' })
    )
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue(
      'A draft to switch back to'
    )
    expect(
      screen.getByRole('button', { name: 'Open conversation First preview' })
    ).toHaveAttribute('aria-current', 'true')
    await user.click(
      screen.getByRole('button', {
        name: 'Conversation actions for First preview',
      })
    )
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
    const confirmation = await screen.findByRole('alertdialog')
    expect(confirmation).toHaveTextContent(
      'This preview conversation will be removed.'
    )
    await user.click(
      within(confirmation).getByRole('button', { name: 'Delete' })
    )
    expect(
      screen.queryByRole('button', { name: 'Open conversation First preview' })
    ).not.toBeInTheDocument()
    view.unmount()
    renderWorkspace()
    expect(screen.getByText('No conversations yet')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('')
  })

  test('the desktop conversation sidebar becomes an accessible drawer on small screens', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    expect(
      screen.getByRole('complementary', { name: 'Conversation sidebar' })
    ).toHaveClass('hidden', 'w-64', 'lg:block')
    const trigger = screen.getByRole('button', { name: 'Open conversations' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    const drawer = await screen.findByRole('dialog', { name: 'Conversations' })
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await user.click(
      within(drawer).getByRole('button', { name: 'New conversation' })
    )
    await waitFor(() =>
      expect(trigger).toHaveAttribute('aria-expanded', 'false')
    )
  })

  test('a starter prompt fills the preview input and the send action remains disabled', async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await user.click(screen.getByRole('button', { name: 'Explain a concept' }))
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue(
      'Explain a difficult concept with a simple example.'
    )
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Parameters' }))
    expect(await screen.findByText('Parameter settings')).toBeInTheDocument()
  })

  test('gallery and image mode controls can be composed without enabling a sender', () => {
    const view = render(
      <TooltipProvider>
        <Workspace
          headerActions={<Button>My images</Button>}
          modeControls={<Button>Image preview</Button>}
        />
      </TooltipProvider>
    )
    expect(
      screen.getByRole('button', { name: 'My images' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Image preview' })
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    view.rerender(
      <TooltipProvider>
        <Workspace content={<div>Image interface preview</div>} />
      </TooltipProvider>
    )
    expect(screen.getByText('Image interface preview')).toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Message' })
    ).not.toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(
      'Interface preview. Messages are not sent or saved.'
    )
  })
})
