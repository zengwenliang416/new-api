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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, test, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../../components/settings-page-context'
import { ModelProbeSettingsSection } from '../settings-section'
import {
  DEFAULT_MODEL_PROBE_SETTINGS,
  type ModelProbeCandidates,
  type ModelProbeSettings,
  type ModelProbeTarget,
} from '../types'

const target: ModelProbeTarget = {
  group: 'default',
  model: 'example-model',
  effort: 'medium',
  kinds: ['math', 'drawing'],
  enabled: true,
  token_id: 11,
}
const candidates: ModelProbeCandidates = {
  groups: [
    { group: 'default', name: 'Default group' },
    { group: 'vip', name: 'VIP group' },
  ],
  users: [
    { id: 1, username: 'probe', display_name: 'Probe account one' },
    { id: 2, username: 'other', display_name: 'Other account' },
  ],
  tokens: [
    { id: 11, user_id: 1, name: 'Matching token', group: 'default' },
    { id: 12, user_id: 2, name: 'Other owner token', group: 'default' },
    { id: 13, user_id: 1, name: 'Other group token', group: 'vip' },
  ],
  defaults: {
    math_prompt: 'Built-in logic question',
    math_answer: '21',
    drawing_prompt: 'Draw a sheep with {{vehicle}} in {{scene}}',
    instructions: 'Built-in instructions',
    user_agent: 'probe-client',
  },
  drawing_catalog: { vehicles: ['bike'], scenes: ['park'] },
}

function Fixture(props: { settings?: Partial<ModelProbeSettings> }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false, gcTime: 0 },
        },
      })
  )
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  return (
    <QueryClientProvider client={client}>
      <div ref={setContainer} />
      <SettingsPageProvider actionsContainer={container}>
        <ModelProbeSettingsSection
          defaultValues={{ ...DEFAULT_MODEL_PROBE_SETTINGS, ...props.settings }}
        />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.spyOn(api, 'get').mockResolvedValue({
    data: { success: true, data: candidates },
  })
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
  vi.spyOn(api, 'post').mockResolvedValue({
    data: { success: true, data: { scanned: 3, changed: 1 } },
  })
})

test('new settings remain disabled and show defaults without saving or starting probes', async () => {
  render(<Fixture />)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Add probe target' })
    ).toBeEnabled()
  )
  expect(
    screen.getByRole('switch', { name: 'Enable intelligence monitoring' })
  ).not.toBeChecked()
  expect(
    screen.getByRole('switch', { name: 'Allow public probe results' })
  ).not.toBeChecked()
  expect(
    screen.getByRole('textbox', { name: 'Logic question prompt' })
  ).toHaveValue('')
  expect(
    screen.getByRole('textbox', { name: 'Logic question prompt' })
  ).toHaveAttribute('placeholder', candidates.defaults.math_prompt)
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  expect(api.put).not.toHaveBeenCalled()
  expect(api.post).not.toHaveBeenCalled()
})

test('enabling probes without an account or target shows field errors and sends no request', async () => {
  const user = userEvent.setup()
  render(<Fixture />)
  const toggle = screen.getByRole('switch', {
    name: 'Enable intelligence monitoring',
  })
  await waitFor(() => expect(toggle).toBeEnabled())
  toggle.focus()
  await user.keyboard(' ')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByText('Select a probe account')).toBeVisible()
  expect(
    screen.getByText('Add and enable at least one probe target')
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})

test('saving a configured target uses one bulk request with token IDs and preserves empty prompt overrides', async () => {
  const user = userEvent.setup()
  render(
    <Fixture
      settings={{
        'model_probe_setting.probe_user_id': 1,
        'model_probe_setting.targets': JSON.stringify([target]),
      }}
    />
  )
  const toggle = screen.getByRole('switch', {
    name: 'Enable intelligence monitoring',
  })
  await waitFor(() => expect(toggle).toBeEnabled())
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/option/bulk', {
      options: {
        ...DEFAULT_MODEL_PROBE_SETTINGS,
        'model_probe_setting.enabled': true,
        'model_probe_setting.probe_user_id': 1,
        'model_probe_setting.targets': JSON.stringify([target]),
      },
    })
  )
  expect(api.post).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  )
})

test('the token picker only offers tokens owned by the selected account in the target group', async () => {
  const user = userEvent.setup()
  render(
    <Fixture
      settings={{
        'model_probe_setting.probe_user_id': 1,
        'model_probe_setting.targets': JSON.stringify([target]),
      }}
    />
  )
  const picker = await screen.findByRole('combobox', {
    name: 'Probe API token',
  })
  await waitFor(() => expect(picker).toBeEnabled())
  await user.click(picker)
  await user.keyboard('{ArrowDown}')
  expect(
    await screen.findByRole('option', { name: 'Matching token' })
  ).toBeVisible()
  expect(
    screen.queryByRole('option', { name: 'Other owner token' })
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('option', { name: 'Other group token' })
  ).not.toBeInTheDocument()
})

test('a stale token belonging to another account cannot be used to enable monitoring', async () => {
  const user = userEvent.setup()
  render(
    <Fixture
      settings={{
        'model_probe_setting.probe_user_id': 1,
        'model_probe_setting.targets': JSON.stringify([
          { ...target, token_id: 12 },
        ]),
      }}
    />
  )
  const toggle = screen.getByRole('switch', {
    name: 'Enable intelligence monitoring',
  })
  await waitFor(() => expect(toggle).toBeEnabled())
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(
    await screen.findByText(
      'Select an API token belonging to the probe account and target group'
    )
  ).toBeVisible()
  expect(api.put).not.toHaveBeenCalled()
})

test('turning monitoring off remains possible when its token is no longer a candidate', async () => {
  const user = userEvent.setup()
  render(
    <Fixture
      settings={{
        'model_probe_setting.enabled': true,
        'model_probe_setting.probe_user_id': 1,
        'model_probe_setting.targets': JSON.stringify([
          { ...target, token_id: 99 },
        ]),
      }}
    />
  )
  const toggle = screen.getByRole('switch', {
    name: 'Enable intelligence monitoring',
  })
  await waitFor(() => expect(toggle).toBeEnabled())
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      '/api/option/bulk',
      expect.objectContaining({
        options: expect.objectContaining({
          'model_probe_setting.enabled': false,
        }),
      })
    )
  )
})

test('candidate loading failure disables saving and retry restores the account controls', async () => {
  vi.mocked(api.get).mockRejectedValueOnce(new Error('Candidates unavailable'))
  const user = userEvent.setup()
  render(<Fixture />)
  expect(await screen.findByText('Candidates unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: 'Probe account' })
    ).toBeEnabled()
  )
})

test('a rejected save keeps edits visible and does not mark them saved', async () => {
  vi.mocked(api.put).mockResolvedValueOnce({
    data: { success: false, message: 'Configuration rejected' },
  })
  const user = userEvent.setup()
  render(<Fixture />)
  const input = screen.getByRole('spinbutton', {
    name: 'Probe interval (minutes)',
  })
  await waitFor(() => expect(input).toBeEnabled())
  await user.tripleClick(input)
  await user.keyboard('45')
  await user.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Configuration rejected'
  )
  expect(input).toHaveValue(45)
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
})

test('re-evaluation requires confirmation and uses the saved seven-day window', async () => {
  const user = userEvent.setup()
  render(<Fixture />)
  await user.click(
    screen.getByRole('button', {
      name: 'Re-evaluate logic results from the last 7 days',
    })
  )
  const dialog = screen.getByRole('alertdialog')
  expect(api.post).not.toHaveBeenCalled()
  await user.click(within(dialog).getByRole('button', { name: 'Re-evaluate' }))
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledExactlyOnceWith(
      '/api/model_probe/admin/reevaluate',
      null,
      { params: { hours: 168 } }
    )
  )
  await waitFor(() =>
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  )
})

test('invalid stored targets are reported instead of silently overwriting them with an empty array', () => {
  render(<Fixture settings={{ 'model_probe_setting.targets': '{invalid' }} />)
  expect(screen.getByText('Invalid saved probe targets')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Save Changes' })
  ).not.toBeInTheDocument()
  expect(api.put).not.toHaveBeenCalled()
})
