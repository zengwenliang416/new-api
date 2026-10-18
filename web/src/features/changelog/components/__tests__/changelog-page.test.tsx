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
import { act, render, screen, within } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { ChangelogPage } from '../changelog-page'

vi.mock('@/components/layout', () => ({
  PublicLayout: (props: { children: ReactNode }) => <div>{props.children}</div>,
}))

beforeAll(() => {
  i18next.addResourceBundle('zhCN', 'translation', {}, true, true)
  i18next.addResourceBundle('fr', 'translation', {}, true, true)
})

afterEach(async () => {
  await act(() => i18next.changeLanguage('en'))
})

describe('changelog page', () => {
  it('lists months newest first with anchors, a single latest badge, and every update', () => {
    render(<ChangelogPage />)

    expect(screen.getByRole('note')).toHaveTextContent('Sample release notes')
    expect(screen.getByRole('note')).toHaveTextContent(
      "These entries preview the page layout and are not this site's release history."
    )

    const months = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(months).toEqual([
      'October 2026',
      'September 2026',
      'August 2026',
      'July 2026',
      'June 2026',
    ])

    const monthNav = screen.getByRole('navigation', {
      name: 'Browse updates by month',
    })
    expect(within(monthNav).getAllByRole('link')).toHaveLength(5)
    expect(
      within(monthNav).getByRole('link', { name: 'October 2026' })
    ).toHaveAttribute('href', '#updates-2026-10')
    expect(
      within(monthNav).getByRole('link', { name: 'June 2026' })
    ).toHaveAttribute('href', '#updates-2026-06')

    const latestSection = document.querySelector('#updates-2026-10')
    expect(latestSection).not.toBeNull()
    expect(
      within(latestSection as HTMLElement).getByText('Latest updates')
    ).toBeVisible()
    expect(screen.getAllByText('Latest updates')).toHaveLength(1)
    expect(document.querySelector('#updates-2026-06')).not.toBeNull()

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(15)
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: '2026-10-04: Model mapping on API keys',
      })
    ).toBeVisible()
  })

  it('formats month names with the active interface language', async () => {
    render(<ChangelogPage />)
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
      'October 2026'
    )

    await act(() => i18next.changeLanguage('zhCN'))
    expect(screen.getByRole('link', { name: '2026年10月' })).toHaveAttribute(
      'href',
      '#updates-2026-10'
    )
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
      '2026年10月'
    )

    await act(() => i18next.changeLanguage('fr'))
    expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
      'octobre 2026'
    )
  })
})
