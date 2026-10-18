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
import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState, type ReactNode } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { useStatus } from '@/hooks/use-status'
import { api } from '@/lib/api'
import { useSystemConfigStore } from '@/stores/system-config-store'

import { SettingsPageProvider } from '../../components/settings-page-context'
import { useUpdateOption } from '../../hooks/use-update-option'
import { SupportWorkerSettingsSection } from '../support-worker-settings-section'

function Fixture(props: { translationEnabled?: boolean }) {
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
        <SupportWorkerSettingsSection
          defaultValues={{
            SupportWorkerUrl: 'https://support.example.test',
            SupportWorkerJwtSecret: '',
            SupportWorkerCallbackSecret: '',
            SupportWorkerSiteID: 'default',
            SupportWorkerSessionTTLMinutes: 30,
            SupportWorkerTranslationEnabled: props.translationEnabled,
          }}
        />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(api, 'put').mockResolvedValue({ data: { success: true } })
})

afterEach(() => {
  useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  window.localStorage.clear()
})

test('missing translation configuration leaves translation disabled with provider guidance', () => {
  render(<Fixture />)

  const toggle = screen.getByRole('switch', {
    name: 'Enable ticket translation',
  })
  expect(toggle).not.toBeChecked()
  expect(toggle).toHaveAccessibleDescription(
    'Enable only after a translation provider has been configured for the Support Worker.'
  )
})

test.each([
  { initial: false, saved: true },
  { initial: true, saved: false },
])(
  'changing translation from $initial to $saved saves the boolean without clearing stored secrets',
  async ({ initial, saved }) => {
    const user = userEvent.setup()
    render(<Fixture translationEnabled={initial} />)

    const toggle = screen.getByRole('switch', {
      name: 'Enable ticket translation',
    })
    toggle.focus()
    await user.keyboard(' ')
    expect(toggle).toHaveAttribute('aria-checked', String(saved))
    await user.click(
      screen.getByRole('button', { name: 'Save Support Worker settings' })
    )

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledExactlyOnceWith('/api/option/', {
        key: 'SupportWorkerTranslationEnabled',
        value: saved,
      })
    )
  }
)

test('refreshed server settings reset the translation switch to the saved value', async () => {
  const view = render(<Fixture translationEnabled />)
  expect(
    screen.getByRole('switch', { name: 'Enable ticket translation' })
  ).toBeChecked()

  view.rerender(<Fixture translationEnabled={false} />)

  await waitFor(() =>
    expect(
      screen.getByRole('switch', { name: 'Enable ticket translation' })
    ).not.toBeChecked()
  )
  expect(api.put).not.toHaveBeenCalled()
})

test.each([
  {
    key: 'SystemName',
    value: 'New API Support',
    initial: { system_name: 'New API' },
    updated: { system_name: 'New API Support' },
  },
  {
    key: 'SupportWorkerTranslationEnabled',
    value: true,
    initial: { ticket_translation_enabled: false },
    updated: { ticket_translation_enabled: true },
  },
  {
    key: 'SupportWorkerUrl',
    value: 'https://support.example.test',
    initial: { ticket_enabled: false },
    updated: { ticket_enabled: true },
  },
])('saving $key refreshes subscribed site status', async (setting) => {
  vi.spyOn(api, 'get')
    .mockResolvedValueOnce({
      data: { success: true, data: setting.initial },
    })
    .mockResolvedValue({
      data: { success: true, data: setting.updated },
    })
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  })
  const { result, unmount } = renderHook(
    () => ({
      update: useUpdateOption(),
      status: useStatus().status,
    }),
    {
      wrapper: (props: { children: ReactNode }) => (
        <QueryClientProvider client={client}>
          {props.children}
        </QueryClientProvider>
      ),
    }
  )
  await waitFor(() => expect(result.current.status).toEqual(setting.initial))

  await act(() =>
    result.current.update.mutateAsync({
      key: setting.key,
      value: setting.value,
    })
  )

  await waitFor(() => expect(result.current.status).toEqual(setting.updated))
  expect(api.get).toHaveBeenLastCalledWith('/api/status')
  unmount()
  client.clear()
})
