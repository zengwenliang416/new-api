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
import { useState } from 'react'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

import { ENDPOINT_MAP } from '../../data/api-endpoints'
import { buildCodeSamples } from '../../lib/build-code-samples'
import { EndpointCodePanel } from '../endpoint-code-panel'

const getAnimations = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'getAnimations'
)
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
    configurable: true,
    value: () => [],
  })
})
afterAll(() => {
  if (getAnimations) {
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', getAnimations)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'getAnimations')
  }
})

function Examples() {
  const [language, setLanguage] = useState('cURL')
  const [status, setStatus] = useState('200')
  const endpoint = ENDPOINT_MAP['models-list']
  return (
    <EndpointCodePanel
      endpoint={endpoint}
      codeSamples={buildCodeSamples(endpoint, 'https://gateway.example')}
      activeCodeLanguage={language}
      onCodeLanguageChange={setLanguage}
      activeResponseStatus={status}
      onResponseStatusChange={setStatus}
    />
  )
}

describe('endpoint examples at narrow widths', () => {
  test('keeps the examples in the base layout and copies the selected language', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<Examples />)
    const panel = screen.getByRole('complementary')
    expect(panel).not.toHaveClass('hidden')
    await user.click(within(panel).getByRole('tab', { name: 'Python' }))
    await user.click(within(panel).getByRole('button', { name: 'Copy code' }))
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('import requests')
    )
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('https://gateway.example/v1/models')
    )
  })

  test('switches error responses and copies the visible response independently', async () => {
    const user = userEvent.setup()
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    render(<Examples />)
    await user.click(screen.getByRole('tab', { name: '401' }))
    expect(screen.getByRole('tab', { name: '401' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    await user.click(screen.getByRole('button', { name: 'Copy response' }))
    expect(writeText).toHaveBeenCalledWith(
      ENDPOINT_MAP['models-list'].responseExamples.find(
        (response) => response.status === '401'
      )?.body
    )
  })
})
