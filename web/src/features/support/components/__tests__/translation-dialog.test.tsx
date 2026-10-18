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
import { expect, test, vi } from 'vitest'

import type { SupportMessage } from '../../types'
import { TranslationDialog } from '../translation-dialog'

const message: SupportMessage = {
  id: 10,
  sender_type: 'user',
  body: 'Original customer message',
  created_at: 1_700_000_000_000,
  attachments: [],
}

test('the correction dialog labels the editor and saves the trimmed correction', async () => {
  const onSave = vi.fn()
  const user = userEvent.setup()
  render(
    <TranslationDialog
      open
      onOpenChange={vi.fn()}
      message={message}
      translation={{ body: 'Machine version', status: 'machine' }}
      languageLabel='English'
      isSaving={false}
      onSave={onSave}
    />
  )
  const dialog = within(
    screen.getByRole('dialog', { name: 'Correct translation' })
  )
  const editor = dialog.getByRole('textbox', {
    name: 'Enter the corrected translation',
  })
  expect(editor).toHaveValue('Machine version')
  await user.clear(editor)
  await user.type(editor, ' Corrected version ')
  await user.click(dialog.getByRole('button', { name: 'Save correction' }))

  expect(onSave).toHaveBeenCalledExactlyOnceWith('Corrected version')
})

test('a correction being saved cannot be submitted a second time', async () => {
  const onSave = vi.fn()
  const user = userEvent.setup()
  render(
    <TranslationDialog
      open
      onOpenChange={vi.fn()}
      message={message}
      translation={{ body: 'Corrected version', status: 'reviewed' }}
      languageLabel='English'
      isSaving
      onSave={onSave}
    />
  )
  const save = screen.getByRole('button', { name: 'Save correction' })
  expect(save).toBeDisabled()
  await user.click(save)

  expect(onSave).not.toHaveBeenCalled()
})
