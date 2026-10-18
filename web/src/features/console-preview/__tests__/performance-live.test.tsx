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
import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'

import {
  codingInputMultipliers,
  compactPerformanceSeries,
  performanceStatus,
  type PerformanceModel,
  type PerformanceSnapshot,
} from '../performance-data'
import { PerformancePage } from '../performance-page'

const clients: QueryClient[] = []

afterEach(() => {
  for (const client of clients) client.clear()
  clients.length = 0
})

function modelFixture(): PerformanceModel {
  return {
    model_name: 'measured-model',
    request_count: 100,
    success_count: 95,
    success_rate: 95,
    avg_latency_ms: 1200,
    avg_ttft_ms: 250,
    avg_tps: 25,
    cache_observed: false,
    cache_hit_rate: 0,
    coding_cache_observed: true,
    coding_cache_hit_rate: 50,
    coding_input_weight: 1,
    coding_cost_observed: true,
    coding_cost_input_weight: 1,
    coding_observed_input_price: 5,
    coding_cache0_input_price: 10,
    coding_cache100_input_price: 0,
  }
}

function snapshotFixture(): PerformanceSnapshot {
  return {
    start_ts: 1700000000,
    end_ts: 1700086400,
    bucket_seconds: 300,
    groups: [
      {
        ...modelFixture(),
        success_count: 95,
        group: 'measured',
        name: 'Measured group',
        description: 'Measured traffic',
        ratio: 1,
        series: [
          {
            ts: 1700000000,
            request_count: 100,
            success_rate: 95,
            avg_latency_ms: 1200,
          },
        ],
        models: [modelFixture()],
      },
    ],
  }
}

function renderPerformance() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      <PerformancePage />
    </QueryClientProvider>
  )
}

describe('live performance page', () => {
  it('shows loading before measured availability arrives and leaves unobserved cache blank', async () => {
    let resolve!: (value: {
      data: { success: boolean; data: PerformanceSnapshot }
    }) => void
    const request = vi.spyOn(api, 'get').mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done
        })
    )
    renderPerformance()
    expect(screen.getByText('Loading...')).toBeVisible()
    resolve({ data: { success: true, data: snapshotFixture() } })

    const card = await screen.findByRole('article', { name: 'Measured group' })
    expect(request).toHaveBeenCalledWith(
      '/api/perf-metrics/groups',
      expect.objectContaining({ params: { hours: 24, lang: 'en' } })
    )
    expect(within(card).getByText('Operational')).toBeVisible()
    expect(within(card).getByText('95 / 100', { exact: false })).toBeVisible()
    expect(
      within(card).getByText('Cache hit rate').nextElementSibling
    ).toHaveTextContent('—')
    expect(screen.queryByText('Interface preview')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Performance groups')).toHaveClass(
      'grid-cols-1',
      'lg:grid-cols-2',
      'min-w-0'
    )
  })

  it('rejects a business failure and retries to display an empty result', async () => {
    const user = userEvent.setup()
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({
        data: { success: false, message: 'Metrics are disabled' },
      })
      .mockResolvedValueOnce({
        data: { success: true, data: { ...snapshotFixture(), groups: [] } },
      })
    renderPerformance()
    expect(await screen.findByText('Metrics are disabled')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No performance data')).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('changes the API window when the user selects seven days with the keyboard', async () => {
    const user = userEvent.setup()
    const request = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: snapshotFixture() } })
    renderPerformance()
    await screen.findByRole('article', { name: 'Measured group' })
    const range = screen.getByRole('tab', { name: '7d' })
    range.focus()
    await user.keyboard('{Enter}')
    await waitFor(() =>
      expect(request).toHaveBeenLastCalledWith(
        '/api/perf-metrics/groups',
        expect.objectContaining({ params: { hours: 168, lang: 'en' } })
      )
    )
    expect(range).toHaveAttribute('aria-selected', 'true')
  })

  it('refreshes real metrics when the refresh button is pressed', async () => {
    const user = userEvent.setup()
    const initial = snapshotFixture()
    const updated = snapshotFixture()
    updated.groups[0].success_rate = 60
    updated.groups[0].success_count = 60
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({ data: { success: true, data: initial } })
      .mockResolvedValueOnce({ data: { success: true, data: updated } })
    renderPerformance()
    const card = await screen.findByRole('article', { name: 'Measured group' })
    expect(within(card).getByText('Operational')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(await within(card).findByText('Unavailable')).toBeVisible()
  })

  it('filters the returned groups without creating example groups', async () => {
    const user = userEvent.setup()
    const snapshot = snapshotFixture()
    snapshot.groups.push({
      ...snapshot.groups[0],
      group: 'quiet',
      name: 'Quiet group',
      request_count: 0,
      success_count: 0,
      success_rate: 0,
      models: [],
      series: [],
    })
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: snapshot },
    })
    renderPerformance()
    await screen.findByRole('article', { name: 'Quiet group' })
    await user.click(
      screen.getByRole('combobox', { name: 'Model group filter' })
    )
    await user.click(screen.getByRole('option', { name: 'Quiet group' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(
      within(screen.getByRole('article', { name: 'Quiet group' })).getAllByText(
        'No data'
      ).length
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('article', { name: 'Measured group' })
    ).not.toBeInTheDocument()
  })

  it('shows the selected group model metrics in the shared dialog without another request', async () => {
    const user = userEvent.setup()
    const request = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: snapshotFixture() } })
    renderPerformance()
    const trigger = await screen.findByRole('button', { name: 'View models' })
    await user.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Model traffic' })
    expect(
      within(dialog).getByRole('cell', { name: 'measured-model' })
    ).toBeVisible()
    expect(within(dialog).getByRole('cell', { name: '95%' })).toBeVisible()
    expect(request).toHaveBeenCalledTimes(1)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('updates the reference multiplier locally and hides it for invalid cache rates', async () => {
    const user = userEvent.setup()
    const request = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: snapshotFixture() } })
    renderPerformance()
    const card = await screen.findByRole('article', { name: 'Measured group' })
    expect(
      within(card).getByText('Reference multiplier').nextElementSibling
    ).toHaveTextContent('5×')
    const input = screen.getByRole('spinbutton', {
      name: 'Reference cache rate',
    })
    await user.clear(input)
    await user.type(input, '50')
    expect(
      within(card).getByText('Reference multiplier').nextElementSibling
    ).toHaveTextContent('1×')
    await user.clear(input)
    await user.type(input, '100')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(
      within(card).getByText('Reference multiplier').nextElementSibling
    ).toHaveTextContent('—')
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('performance aggregation contract', () => {
  it('uses request weights when reducing adjacent timeline buckets', () => {
    expect(
      compactPerformanceSeries(
        [
          { ts: 100, request_count: 1, success_rate: 0, avg_latency_ms: 100 },
          {
            ts: 200,
            request_count: 9,
            success_rate: 100,
            avg_latency_ms: 1000,
          },
        ],
        1
      )
    ).toEqual([
      { ts: 100, request_count: 10, success_rate: 90, avg_latency_ms: 910 },
    ])
  })

  it('hides multipliers below 90 percent cost coverage and preserves observed zero cost', () => {
    const model = modelFixture()
    expect(
      codingInputMultipliers([{ ...model, coding_cost_input_weight: 0.89 }], 90)
    ).toEqual({ input: null, reference: null })
    expect(
      codingInputMultipliers([{ ...model, coding_cost_observed: false }], 90)
    ).toEqual({ input: null, reference: null })
    expect(
      codingInputMultipliers([{ ...model, coding_observed_input_price: 0 }], 90)
    ).toEqual({ input: 0, reference: 0 })
    expect(
      codingInputMultipliers([{ ...model, coding_cache0_input_price: 0 }], 90)
    ).toEqual({ input: null, reference: null })
  })

  it.each([
    [0, 0, 'nodata'],
    [100, 90, 'operational'],
    [100, 70, 'degraded'],
    [100, 69, 'unavailable'],
  ])(
    'classifies %s requests with %s percent success as %s',
    (requests, rate, status) => {
      expect(performanceStatus(requests, rate)).toBe(status)
    }
  )
})
