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
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { PlaygroundEmptyState } from '../components/chat/playground-empty-state'
import { PlaygroundInput } from '../components/input/playground-input'
import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'

const initialConfig = useSystemConfigStore.getState()

beforeEach(() => {
  useSystemConfigStore.getState().setConfig({
    systemName: 'MotionCover AI',
    siteBrand: 'motioncover',
    logoLight: '/branding/motioncover-logo-light-20260824.png',
  })
})

afterEach(() => {
  useSystemConfigStore.setState(initialConfig, true)
})

it('the empty conversation shows the configured brand and keeps all starter prompts in one wrapping column', async () => {
  const user = userEvent.setup()
  const onSelectPrompt = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <PlaygroundEmptyState onSelectPrompt={onSelectPrompt} />
    </QueryClientProvider>
  )

  expect(screen.getByRole('img', { name: 'MotionCover AI' })).toHaveAttribute(
    'src',
    '/branding/motioncover-logo-light-20260824.png'
  )
  expect(
    screen.getByRole('heading', { name: 'What would you like to ask today?' })
  ).toBeVisible()
  const prompts = screen.getByRole('group', { name: 'Quick questions' })
  expect(prompts).toHaveClass('flex-col', 'min-w-0', 'w-full')
  const buttons = within(prompts).getAllByRole('button')
  expect(buttons).toHaveLength(4)
  for (const button of buttons) {
    expect(button).toHaveClass('max-w-full', 'whitespace-normal')
    await user.click(button)
    expect(onSelectPrompt).toHaveBeenLastCalledWith(button.textContent)
  }
})

it('the flat composer keeps entered text usable and submits through the existing callback', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(
    <TooltipProvider>
      <PlaygroundInput
        config={DEFAULT_CONFIG}
        groups={[{ value: 'default', label: 'Default', ratio: 1 }]}
        groupValue='default'
        models={[{ value: 'gpt-4o', label: 'GPT-4o' }]}
        modelValue='gpt-4o'
        onGroupChange={vi.fn()}
        onModelChange={vi.fn()}
        onConfigChange={vi.fn()}
        onParameterEnabledChange={vi.fn()}
        parameterEnabled={DEFAULT_PARAMETER_ENABLED}
        onSubmit={onSubmit}
      />
    </TooltipProvider>
  )

  const input = screen.getByRole('textbox')
  expect(input).toHaveClass('min-w-0')
  expect(input.closest('[data-slot="input-group"]')).toHaveClass(
    'min-w-0',
    'rounded-none',
    'shadow-none'
  )
  await user.type(input, 'A useful question{Enter}')
  expect(onSubmit).toHaveBeenCalledWith('A useful question')
  expect(input).toHaveValue('')
})
