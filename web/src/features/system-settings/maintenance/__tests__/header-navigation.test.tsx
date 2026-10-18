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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import { SettingsPageProvider } from '../../components/settings-page-context'
import {
  HEADER_NAV_DEFAULT,
  serializeHeaderNavModules,
  type HeaderNavModulesConfig,
} from '../config'
import { HeaderNavigationSection } from '../header-navigation-section'

let queryClient: QueryClient

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

function Fixture(props: { config?: HeaderNavModulesConfig }) {
  const config = props.config ?? HEADER_NAV_DEFAULT
  const [actions, setActions] = useState<HTMLDivElement | null>(null)
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsPageProvider actionsContainer={actions}>
        <div ref={setActions} />
        <HeaderNavigationSection
          config={config}
          initialSerialized={serializeHeaderNavModules(config)}
        />
      </SettingsPageProvider>
    </QueryClientProvider>
  )
}

describe('header navigation changelog toggle', () => {
  it('saves the changelog toggle without touching the other modules', async () => {
    const user = userEvent.setup()
    const put = vi.spyOn(api, 'put').mockResolvedValue({
      data: { success: true, message: '' },
    })
    render(<Fixture />)

    const changelog = screen.getByRole('switch', { name: 'Changelog' })
    expect(changelog).toBeChecked()
    expect(
      screen.getByText('Update history and service improvements.')
    ).toBeVisible()

    await user.click(changelog)
    expect(changelog).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save navigation' }))

    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [url, request] = put.mock.calls[0] as [
      string,
      { key: string; value: string },
    ]
    expect(url).toBe('/api/option/')
    expect(request).toMatchObject({ key: 'HeaderNavModules' })
    const saved = JSON.parse(request.value) as HeaderNavModulesConfig
    expect(saved.changelog).toBe(false)
    expect(saved.docs).toBe(true)
    expect(saved.about).toBe(true)
    expect(saved.pricing.enabled).toBe(true)
  })

  it('defaults to enabled for stored configurations without a changelog key', () => {
    const legacy: Record<string, unknown> = { ...HEADER_NAV_DEFAULT }
    delete legacy.changelog
    render(<Fixture config={legacy as HeaderNavModulesConfig} />)

    expect(screen.getByRole('switch', { name: 'Changelog' })).toBeChecked()
  })
})
