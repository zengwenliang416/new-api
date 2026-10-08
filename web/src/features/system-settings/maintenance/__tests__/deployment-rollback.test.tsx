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
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'
import { createAppQueryClient } from '@/lib/query-client'

import { DeploymentReleasePanel } from '../deployment-release'

const current = `docker.io/zengwenliang0416/new-api:${'a'.repeat(40)}`
const previous = `docker.io/zengwenliang0416/new-api:${'b'.repeat(40)}`

function releaseResponse(available: boolean) {
  return {
    data: {
      success: true,
      data: {
        current_image: current,
        previous_image: available ? previous : '',
        current_version: 'v1.0.0-rc.41+aaaaaaaaaaaa',
        previous_version: available ? 'v1.0.0-rc.41+bbbbbbbbbbbb' : '',
        rollback_available: available,
        rollback_state: 'idle',
        unavailable_reason: available ? '' : 'no_previous',
      },
    },
  }
}

function Wrapper(props: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      {props.children}
    </QueryClientProvider>
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('deployment rollback', () => {
  test('asks for confirmation before switching to the previous image', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get').mockResolvedValue(releaseResponse(true))
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '' },
    })
    render(<DeploymentReleasePanel />, { wrapper: Wrapper })

    expect(await screen.findByText(current)).toBeInTheDocument()
    expect(screen.getByText(previous)).toBeInTheDocument()
    const trigger = screen.getByRole('button', {
      name: 'Switch to the previous image',
    })
    await user.click(trigger)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveTextContent(
      'This restarts the API on the previous image. MySQL and stored data stay in place.'
    )
    await user.click(
      within(dialog).getByRole('button', { name: 'Switch to the previous image' })
    )
    expect(post).toHaveBeenCalledWith('/api/deploy/rollback')
  })

  test('does not offer a switch when no previous image is available', async () => {
    vi.spyOn(api, 'get').mockResolvedValue(releaseResponse(false))
    const post = vi.spyOn(api, 'post').mockResolvedValue({
      data: { success: true, message: '' },
    })
    render(<DeploymentReleasePanel />, { wrapper: Wrapper })
    expect(
      await screen.findByText('No previous image is available.')
    ).toBeInTheDocument()
    const trigger = screen.getByRole('button', {
      name: 'Switch to the previous image',
    })
    expect(trigger).toBeDisabled()
    expect(post).not.toHaveBeenCalled()
  })
})
