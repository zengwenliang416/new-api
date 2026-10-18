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
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InvitationPage } from '../invitation-page'

describe('invitation preview page', () => {
  it('keeps invitation generation disabled and displays an unconfigured program with no reward promise', () => {
    render(<InvitationPage />)

    const generate = screen.getByRole('button', {
      name: 'Generate invitation code',
    })
    expect(generate).toBeDisabled()
    expect(generate).toHaveAccessibleDescription(
      'Invitation code generation is not connected.'
    )
    expect(
      screen.getByText(
        'Reward amounts, validity periods, and review rules have not been set.'
      )
    ).toBeVisible()
    const history = screen.getByRole('table', { name: 'Invitation history' })
    expect(
      within(history).getByText(
        'Invitation history is not connected in this preview.'
      )
    ).toBeVisible()
    expect(screen.getByLabelText('Invitation statistics')).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-3'
    )
  })
})
