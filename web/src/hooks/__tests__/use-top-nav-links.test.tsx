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
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { useAuthStore } from '@/stores/auth-store'

import { useTopNavLinks } from '../use-top-nav-links'

afterEach(() => {
  useAuthStore.getState().auth.reset()
})

function navLinksFor(
  headerNav?: Record<string, unknown> | string,
  status: Record<string, unknown> = {}
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let stored = ''
  if (typeof headerNav === 'string') {
    stored = headerNav
  } else if (headerNav) {
    stored = JSON.stringify(headerNav)
  }
  client.setQueryData(['status'], { HeaderNavModules: stored, ...status })
  function Wrapper(props: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        {props.children}
      </QueryClientProvider>
    )
  }
  return renderHook(() => useTopNavLinks(), { wrapper: Wrapper })
}

describe('changelog top nav link', () => {
  it('shows the changelog link between Docs and About by default', () => {
    const { result } = navLinksFor({})

    expect(result.current.map((link) => link.title)).toEqual([
      'Home',
      'Console',
      'Models & pricing',
      'Hot',
      'Docs',
      'Changelog',
      'About',
    ])
    expect(
      result.current.find((link) => link.title === 'Changelog')?.href
    ).toBe('/changelog')
  })

  it('hides only the changelog link when the module is disabled', () => {
    const { result } = navLinksFor({ changelog: false })

    const titles = result.current.map((link) => link.title)
    expect(titles).not.toContain('Changelog')
    expect(titles).toEqual(expect.arrayContaining(['Docs', 'About']))
  })

  it('fails open when the stored configuration cannot be parsed', () => {
    const { result } = navLinksFor('not-json')

    expect(result.current.map((link) => link.title)).toContain('Changelog')
  })
})

describe('portal documentation navigation', () => {
  it('uses the integrated docs for the portal with the built-in project docs URL', () => {
    const { result } = navLinksFor(
      {},
      { site_brand: 'shuai', docs_link: 'https://docs.newapi.pro' }
    )
    expect(result.current.find((link) => link.title === 'Docs')).toMatchObject({
      href: '/docs',
    })
  })

  it('preserves an explicitly configured external docs destination', () => {
    const { result } = navLinksFor(
      {},
      { site_brand: 'shuai', docs_link: 'https://docs.example.org' }
    )
    expect(result.current.find((link) => link.title === 'Docs')).toMatchObject({
      href: 'https://docs.example.org',
      external: true,
    })
  })

  it('keeps the original project navigation when that brand is selected', () => {
    const { result } = navLinksFor(
      {},
      { site_brand: 'new-api', docs_link: 'https://docs.newapi.pro' }
    )
    expect(result.current.find((link) => link.title === 'Docs')).toMatchObject({
      href: 'https://docs.newapi.pro',
      external: true,
    })
    expect(result.current.some((link) => link.title === 'Model Square')).toBe(
      true
    )
  })
})
