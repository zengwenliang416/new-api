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
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { IntelligencePage } from '../intelligence-page'
import { InvitationPage } from '../invitation-page'
import { PerformancePage } from '../performance-page'

describe('console preview pages', () => {
  it('switches the performance time range with the keyboard and labels every graph as a preview', async () => {
    const user = userEvent.setup()
    render(<PerformancePage />)

    const range = screen.getByRole('tab', { name: '7d' })
    range.focus()
    await user.keyboard('{Enter}')

    expect(range).toHaveAttribute('aria-selected', 'true')
    expect(screen.getAllByText('Preview range: 7d')).toHaveLength(4)
    expect(screen.getAllByText('Example timeline')).toHaveLength(4)
    expect(
      screen.getByRole('button', { name: 'Refresh unavailable in preview' })
    ).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Example layouts only. Live data and actions are not connected.'
    )
  })

  it('filters example performance groups without presenting the sample models as available', async () => {
    const user = userEvent.setup()
    render(<PerformancePage />)

    await user.click(
      screen.getByRole('combobox', { name: 'Model group filter' })
    )
    await user.click(screen.getByRole('option', { name: 'Image models' }))

    expect(screen.getAllByRole('article')).toHaveLength(1)
    const card = screen.getByRole('article', { name: 'Image models' })
    const models = within(card).getByRole('button', { name: 'View models' })
    expect(models).toHaveAttribute('aria-expanded', 'false')
    models.focus()
    await user.keyboard('{Enter}')
    expect(models).toHaveAttribute('aria-expanded', 'true')
    expect(within(card).getByText('example-image-model')).toBeVisible()
    expect(
      within(card).getByText('Example models. Availability is not connected.')
    ).toBeVisible()

    await user.click(
      screen.getByRole('combobox', { name: 'Model group filter' })
    )
    await user.click(screen.getByRole('option', { name: 'All groups' }))
    expect(screen.getAllByRole('article')).toHaveLength(4)
  })

  it('opens cache definitions in the shared dialog and restores focus on dismissal', async () => {
    const user = userEvent.setup()
    render(<PerformancePage />)

    const trigger = screen.getByRole('button', {
      name: 'Cache statistics explained',
    })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', {
      name: 'Cache statistics explained',
    })
    expect(
      within(dialog).getByText(
        'This preview has no cache statistics or pricing data.'
      )
    ).toBeVisible()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('keeps performance cards in one column on mobile and two columns on wide screens', () => {
    render(<PerformancePage />)

    const groups = screen.getByLabelText('Performance group previews')
    expect(groups).toHaveClass('min-w-0', 'grid-cols-1', 'lg:grid-cols-2')
    const filter = screen.getByRole('combobox', { name: 'Model group filter' })
    expect(filter).toHaveClass('w-full', 'sm:w-48')
    expect(filter.parentElement).toHaveClass('flex-wrap')
  })

  it('changes the intelligence preview range without enabling a live refresh', async () => {
    const user = userEvent.setup()
    render(<IntelligencePage />)

    await user.click(screen.getByRole('tab', { name: '3d' }))

    expect(screen.getByRole('tab', { name: '3d' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    expect(screen.getAllByText('Preview range: 3d')).toHaveLength(4)
    expect(screen.getAllByText('Not connected')).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: 'Refresh unavailable in preview' })
    ).toBeDisabled()
  })

  it('shows sample check details and an explicit missing response instead of a fabricated evaluation result', async () => {
    const user = userEvent.setup()
    render(<IntelligencePage />)

    const card = screen.getByRole('article', { name: 'Reasoning models' })
    await user.click(
      within(card).getByRole('button', { name: 'View sample check' })
    )
    const dialog = await screen.findByRole('dialog', {
      name: 'Example check details',
    })
    expect(dialog).toHaveAccessibleDescription(
      'This is a layout preview, not a completed model evaluation.'
    )
    expect(
      within(dialog).getByText(
        'Draw a small sailboat on a calm lake using SVG.'
      )
    ).toBeVisible()

    await user.click(
      within(dialog).getByRole('tab', { name: 'Model response' })
    )

    expect(
      within(dialog).getByRole('tab', { name: 'Model response' })
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      within(dialog).getByText(
        'No model response. Evaluation is not connected.'
      )
    ).toBeVisible()
  })

  it('stacks monitoring timelines above the illustration on mobile and shows the illustration beside them on desktop', () => {
    render(<IntelligencePage />)

    const card = screen.getByRole('article', { name: 'Reasoning models' })
    const image = within(card).getByRole('img', {
      name: 'Sample drawing preview',
    })
    expect(image.parentElement?.parentElement?.parentElement).toHaveClass(
      'grid-cols-1',
      'lg:grid-cols-5',
      'min-w-0'
    )
  })

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
