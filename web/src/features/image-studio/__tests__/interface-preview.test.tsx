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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { ImageStudio } from '..'

describe('image interface preview', () => {
  it('lets visitors inspect temporary settings while generation remains visibly unavailable', async () => {
    const user = userEvent.setup()
    const view = render(<ImageStudio />)
    expect(
      screen.getByText(
        'Interface preview only. Image generation is not connected yet.'
      )
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
    await user.click(
      screen.getByRole('button', {
        name: 'Golden-hour mountains, ultra-wide view',
      })
    )
    expect(screen.getByRole('textbox', { name: 'Image prompt' })).toHaveValue(
      'Golden-hour mountains, ultra-wide view'
    )
    await user.click(screen.getByRole('combobox', { name: 'API key' }))
    await user.click(
      await screen.findByRole('option', { name: 'Preview API key' })
    )
    await user.click(screen.getByRole('combobox', { name: 'Image model' }))
    await user.click(
      await screen.findByRole('option', { name: 'gpt-image-1.5' })
    )
    await user.click(screen.getByRole('combobox', { name: 'Image size' }))
    await user.click(await screen.findByRole('option', { name: '1536x1024' }))
    await user.click(screen.getByRole('combobox', { name: 'Image quality' }))
    await user.click(await screen.findByRole('option', { name: 'High' }))
    await user.click(screen.getByRole('combobox', { name: 'Image count' }))
    await user.click(await screen.findByRole('option', { name: '×4' }))
    await user.click(
      screen.getByRole('switch', { name: 'Asynchronous generation' })
    )
    expect(
      screen.getByRole('switch', { name: 'Asynchronous generation' })
    ).toBeChecked()
    expect(
      screen.getByRole('combobox', { name: 'Image model' })
    ).toHaveTextContent('gpt-image-1.5')
    expect(
      screen.getByRole('combobox', { name: 'Image size' })
    ).toHaveTextContent('1536x1024')
    expect(
      screen.getByRole('combobox', { name: 'Image quality' })
    ).toHaveTextContent('High')
    expect(
      screen.getByRole('combobox', { name: 'Image count' })
    ).toHaveTextContent('×4')
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
    expect(screen.getByText('No images yet')).toBeVisible()

    view.unmount()
    render(<ImageStudio />)
    expect(screen.getByRole('textbox', { name: 'Image prompt' })).toHaveValue(
      ''
    )
    expect(screen.getByRole('combobox', { name: 'API key' })).toHaveTextContent(
      'Select an API key'
    )
    expect(
      screen.getByRole('switch', { name: 'Asynchronous generation' })
    ).not.toBeChecked()
  })

  it('opens and closes the reference layout without presenting an upload or generation success', async () => {
    const user = userEvent.setup()
    render(<ImageStudio embedded />)
    await user.click(screen.getByRole('button', { name: 'Reference image' }))
    expect(
      await screen.findByRole('dialog', { name: 'Reference image' })
    ).toBeVisible()
    expect(
      screen.getByText(
        'Interface preview only. Image uploads are not connected yet.'
      )
    ).toBeVisible()
    expect(screen.getByText('Reference image preview')).toBeVisible()
    await user.keyboard('{Escape}')
    expect(
      await screen.findByRole('button', { name: 'Reference image' })
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeDisabled()
  })

  it('keeps filters usable and preserves wrapping controls without inventing gallery results', async () => {
    const user = userEvent.setup()
    render(<ImageStudio />)
    await user.type(
      screen.getByRole('searchbox', { name: 'Search image prompts' }),
      'mountain'
    )
    await user.click(
      screen.getByRole('combobox', { name: 'Image orientation' })
    )
    await user.click(await screen.findByRole('option', { name: 'Landscape' }))
    expect(
      screen.getByRole('searchbox', { name: 'Search image prompts' })
    ).toHaveValue('mountain')
    expect(
      screen.getByRole('combobox', { name: 'Image orientation' })
    ).toHaveTextContent('Landscape')
    expect(screen.getByRole('group', { name: 'Image settings' })).toHaveClass(
      'flex-wrap'
    )
    expect(
      screen.getByText(
        'Generated images will appear here after the image service is connected.'
      )
    ).toBeVisible()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
