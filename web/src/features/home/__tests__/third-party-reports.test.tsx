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
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'

import { STATUS_QUERY_KEY } from '@/lib/status-query'

import { RulesSection } from '../components/portal/rules-section'
import { ThirdPartyReports } from '../components/portal/third-party-reports'
import {
  isThirdPartyReportsEnabled,
  parseThirdPartyReports,
} from '../lib/third-party-reports'

const clients: QueryClient[] = []

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  window.localStorage.clear()
})

function renderRules(status: Record<string, unknown>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  client.setQueryData(STATUS_QUERY_KEY, status)
  const rootRoute = createRootRoute({ component: RulesSection })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const report = {
  provider: 'Example audit',
  title: 'Configured report',
  url: 'https://reports.example.org/report',
  status: 'verified',
}

describe('configured report publication', () => {
  test.each([undefined, null, {}, { third_party_reports_enabled: false }])(
    'does not enable reports for absent or disabled configuration %o',
    (status) => {
      expect(isThirdPartyReportsEnabled(status)).toBe(false)
    }
  )

  test.each([undefined, 'unknown'])(
    'unknown status %s is reference material, never verification',
    (status) => {
      expect(
        parseThirdPartyReports({
          third_party_reports: [{ ...report, status }],
        })[0].status
      ).toBe('reference')
    }
  )

  test('excludes disabled entries and unsafe or invalid link targets', () => {
    const reports = parseThirdPartyReports({
      third_party_reports: [
        { ...report, enabled: false },
        { ...report, url: 'javascript:alert(1)' },
        { ...report, url: '/not-an-external-report' },
        { ...report, url: 'https://user:password@reports.example.org/' },
        { ...report, enabled: true },
      ],
    })
    expect(reports).toHaveLength(1)
    expect(reports[0].url).toBe(report.url)
  })

  test('shows no borrowed report when reports are enabled without a configured list', async () => {
    renderRules({ third_party_reports_enabled: true })
    await screen.findByRole('heading', {
      name: 'Clear routing, live pricing, published references',
    })
    expect(
      screen.queryByRole('heading', { name: 'Third-party report' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  test('shows the configured report with its explicit verification status', async () => {
    renderRules({
      third_party_reports_enabled: true,
      third_party_reports: [report],
    })
    const link = await screen.findByRole('link', { name: /Configured report/ })
    expect(link).toHaveAttribute('href', report.url)
    expect(screen.getByText('Verified')).toBeVisible()
  })

  test('expands and collapses additional configured reports from the keyboard', async () => {
    const reports = parseThirdPartyReports({
      third_party_reports: [1, 2, 3, 4].map((id) => ({
        ...report,
        id,
        title: `Report ${id}`,
      })),
    })
    render(<ThirdPartyReports reports={reports} />)
    expect(
      screen.queryByRole('link', { name: /Report 4/ })
    ).not.toBeInTheDocument()
    const user = userEvent.setup()
    const button = screen.getByRole('button', { name: 'View all reports' })
    button.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('link', { name: /Report 4/ })).toBeVisible()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{Enter}')
    expect(
      screen.queryByRole('link', { name: /Report 4/ })
    ).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})
