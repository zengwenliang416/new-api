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
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { toast } from 'sonner'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

import { createProbeArtifactDocument } from '../intelligence-artifact-document'
import { IntelligencePage } from '../intelligence-page'
import type {
  ProbeOverview,
  ProbeRun,
  ProbeStats,
  ProbeTarget,
} from '../intelligence-types'

let client: QueryClient
const stats: ProbeStats = {
  pass: 0,
  fail: 0,
  error: 0,
  total: 0,
  pass_rate: 0,
  avg_latency_ms: 0,
  slots: [],
}
const target: ProbeTarget = {
  group: 'default',
  group_name: 'Default group',
  group_description: 'Production models',
  group_ratio: 1,
  model: 'reasoning-model',
  effort: 'medium',
  kinds: ['math'],
  math: {
    ...stats,
    pass: 9,
    fail: 1,
    error: 5,
    total: 15,
    pass_rate: 60,
    avg_latency_ms: 1200,
    latest: {
      ts: 1700000000,
      started_at: 1700000000,
      run_id: 42,
      status: 'fail',
    },
    slots: [
      { ts: 1700000000, started_at: 1700000000, run_id: 42, status: 'fail' },
    ],
  },
  drawing: stats,
}
const overview: ProbeOverview = {
  enabled: true,
  targets: [target],
  server_now: 1700000000,
  next_run_ts: 1700001800,
  interval_seconds: 1800,
  math_answer: '21',
  drawing_catalog: { vehicles: [], scenes: [] },
}
const run: ProbeRun = {
  id: 42,
  kind: 'math',
  group: 'default',
  group_name: 'Default group',
  model: 'reasoning-model',
  status: 'fail',
  started_at: 1700000000,
  latency_ms: 1200,
  first_token_ms: 200,
  prompt_tokens: 20,
  completion_tokens: 5,
  attempts: 1,
  effort: 'medium',
  answer: '20',
  prompt: 'How many combinations?',
  output_text: '<script>unsafe()</script>Answer: 20',
  artifact_bytes: 0,
  vehicle: '',
  scene: '',
  error_kind: '',
}

function renderPage() {
  render(
    <QueryClientProvider client={client}>
      <IntelligencePage />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  useAuthStore.getState().auth.reset()
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

describe('live intelligence monitoring', () => {
  it('loads after StrictMode cancels its initial subscription without reusing an aborted request', async () => {
    const originalAdapter = api.defaults.adapter
    api.defaults.adapter = async (config) => ({
      config,
      data: {
        success: true,
        data: { ...overview, enabled: false, targets: [] },
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    })
    try {
      render(
        <StrictMode>
          <QueryClientProvider client={client}>
            <IntelligencePage />
          </QueryClientProvider>
        </StrictMode>
      )
      expect(await screen.findByText('Monitoring disabled')).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Retry' })
      ).not.toBeInTheDocument()
    } finally {
      cleanup()
      api.defaults.adapter = originalAdapter
    }
  })
  it('shows disabled and unconfigured states without fabricated targets or sample graphs', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: { ...overview, enabled: false, targets: [] },
      },
    })
    renderPage()
    expect(await screen.findByText('Monitoring disabled')).toBeVisible()
    expect(screen.getByText('No monitoring targets')).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByText('Example timeline')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Quality pass rate')).toHaveTextContent('—%')
    expect(
      screen.queryByRole('button', { name: 'Check now' })
    ).not.toBeInTheDocument()
  })

  it('excludes request errors from quality and refetches the selected range with the refresh control', async () => {
    const get = vi
      .spyOn(api, 'get')
      .mockResolvedValue({ data: { success: true, data: overview } })
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByLabelText('Quality pass rate')).toHaveTextContent(
      '90%'
    )
    const card = screen.getByRole('article', {
      name: 'Default group · reasoning-model',
    })
    expect(within(card).getByText('Normal capability')).toBeVisible()
    expect(within(card).getByText('Request failed: 5')).toBeVisible()
    await user.click(screen.getByRole('tab', { name: '3d' }))
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        '/api/model_probe/overview',
        expect.objectContaining({ params: { hours: 72, lang: 'en' } })
      )
    )
    expect(screen.getByRole('tab', { name: '3d' })).toHaveAttribute(
      'aria-selected',
      'true'
    )
    const requests = get.mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(get.mock.calls.length).toBeGreaterThan(requests))
  })

  it('keeps quality unknown when all checks fail in transport instead of marking the model degraded', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({
      data: {
        success: true,
        data: {
          ...overview,
          targets: [{ ...target, math: { ...stats, error: 3, total: 3 } }],
        },
      },
    })
    renderPage()
    expect(await screen.findByLabelText('Quality pass rate')).toHaveTextContent(
      '—%'
    )
    const card = screen.getByRole('article', {
      name: 'Default group · reasoning-model',
    })
    expect(within(card).getByText('No data')).toBeVisible()
    expect(within(card).getByText('Request failed: 3')).toBeVisible()
    expect(
      within(card).queryByText('Potential degradation')
    ).not.toBeInTheDocument()
  })

  it('uses the server clock for the next-check countdown when the browser clock differs', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1900000000000)
    vi.spyOn(api, 'get').mockResolvedValue({
      data: { success: true, data: overview },
    })
    renderPage()
    expect(await screen.findByText('Next check: 30:00')).toBeVisible()
  })

  it('shows a retryable error for a business failure instead of displaying success or sample data', async () => {
    vi.spyOn(api, 'get')
      .mockResolvedValueOnce({
        data: { success: false, message: 'Probe data unavailable' },
      })
      .mockResolvedValue({ data: { success: true, data: overview } })
    const user = userEvent.setup()
    renderPage()
    expect(
      await screen.findByText('Could not load intelligence monitoring')
    ).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('article', {
        name: 'Default group · reasoning-model',
      })
    ).toBeVisible()
  })

  it('opens a real run from the keyboard and renders model output as text', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data: url === '/api/model_probe/runs/42' ? run : overview,
      },
    }))
    const user = userEvent.setup()
    renderPage()
    const card = await screen.findByRole('article', {
      name: 'Default group · reasoning-model',
    })
    const block = within(card).getByRole('button', { name: /Failed/ })
    block.focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Check details' })
    expect(
      await within(dialog).findByText('How many combinations?')
    ).toBeVisible()
    await user.click(
      within(dialog).getByRole('tab', { name: 'Model response' })
    )
    expect(
      within(dialog).getByText('<script>unsafe()</script>Answer: 20')
    ).toBeVisible()
    expect(dialog.querySelector('script')).toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    )
    expect(block).toHaveFocus()
  })

  it.each([true, false])(
    'reports whether a configured admin check was newly queued (%s)',
    async (created) => {
      useAuthStore
        .getState()
        .auth.setUser({ id: 1, username: 'admin', role: 10 })
      vi.spyOn(api, 'get').mockResolvedValue({
        data: { success: true, data: overview },
      })
      const post = vi.spyOn(api, 'post').mockResolvedValue({
        data: {
          success: true,
          data: { task_id: 'probe-task', created, run_ids: [] },
        },
      })
      const notification = vi.spyOn(toast, 'success')
      const user = userEvent.setup()
      renderPage()
      const start = await screen.findByRole('button', { name: 'Check now' })
      await waitFor(() => expect(start).toBeEnabled())
      await user.click(start)
      await waitFor(() =>
        expect(post).toHaveBeenCalledWith('/api/model_probe/admin/run', {})
      )
      expect(post).toHaveBeenCalledTimes(1)
      expect(notification).toHaveBeenCalledWith(
        created ? 'Checks queued' : 'A check is already queued or running'
      )
    }
  )

  it('renders successful drawings in an opaque sandbox with no scripts or same-origin access', async () => {
    const slot = {
      ts: 1700000000,
      started_at: 1700000000,
      run_id: 41,
      status: 'pass' as const,
      has_artifact: true,
    }
    const data = {
      ...overview,
      targets: [
        {
          ...target,
          kinds: ['math', 'drawing'],
          drawing: {
            ...stats,
            pass: 1,
            total: 1,
            latest_pass: slot,
            slots: [slot],
          },
        },
      ],
    }
    vi.spyOn(api, 'get').mockImplementation(async (url) => ({
      data: {
        success: true,
        data:
          url === '/api/model_probe/artifact/41'
            ? {
                html: '<style>svg{fill:red}</style><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" /></svg>',
              }
            : data,
      },
    }))
    renderPage()
    const frame = await screen.findByTitle('Model drawing')
    expect(frame).toHaveAttribute('sandbox', '')
    expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer')
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'")
    const card = screen.getByRole('article', {
      name: 'Default group · reasoning-model',
    })
    expect(
      within(card).getByRole('button', { name: 'View check details' })
    ).toBeVisible()
  })
})

describe('generated drawing isolation', () => {
  it('fits a fixed-size drawing inside its viewport without cropping or stretching', () => {
    const html = createProbeArtifactDocument(
      '<svg width="960" height="640" viewBox="0 0 960 640" preserveAspectRatio="xMidYMid slice"><rect width="960" height="640" /><svg width="80" height="40" viewBox="0 0 8 4"><rect width="8" height="4" /></svg></svg>'
    )
    const document = new DOMParser().parseFromString(html ?? '', 'text/html')
    const svg = document.querySelector('body > svg')
    expect(svg?.getAttribute('viewBox')).toBe('0 0 960 640')
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid meet')

    // Check the sizing contract in a real stylesheet; jsdom does not lay out SVG.
    const style = window.document.createElement('style')
    style.textContent = document.querySelector('style')?.textContent ?? ''
    window.document.head.append(style)
    try {
      const rootRule = [...(style.sheet?.cssRules ?? [])].find((rule) =>
        svg?.matches((rule as CSSStyleRule).selectorText)
      ) as CSSStyleRule | undefined
      expect(rootRule?.style.getPropertyValue('width')).toBe('100%')
      expect(rootRule?.style.getPropertyValue('height')).toBe('100%')
      expect(rootRule?.style.getPropertyValue('display')).toBe('block')
      expect(
        document
          .querySelector('svg svg')
          ?.matches(rootRule?.selectorText ?? 'svg')
      ).toBe(false)
    } finally {
      style.remove()
    }
  })

  it.each([
    ['1200', '800', '0 0 1200 800'],
    ['800px', '1200px', '0 0 800 1200'],
    ['100%', '800', null],
    ['0', '800', null],
  ])(
    'uses absolute canvas dimensions %s by %s when viewBox is missing',
    (width, height, expected) => {
      const html = createProbeArtifactDocument(
        `<svg width="${width}" height="${height}"><rect width="12" height="12" /></svg>`
      )
      const document = new DOMParser().parseFromString(html ?? '', 'text/html')
      expect(document.querySelector('svg')?.getAttribute('viewBox')).toBe(
        expected
      )
    }
  )

  it('preserves nonzero drawing coordinates and nested SVG sizing', () => {
    const html = createProbeArtifactDocument(
      '<svg viewBox="-20 10 960 640"><svg x="20" y="30" width="80" height="40" viewBox="0 0 8 4" preserveAspectRatio="xMinYMin slice"><rect width="8" height="4" /></svg></svg>'
    )
    const document = new DOMParser().parseFromString(html ?? '', 'text/html')
    expect(document.querySelector('body > svg')?.getAttribute('viewBox')).toBe(
      '-20 10 960 640'
    )
    const nested = document.querySelector('svg svg')
    expect(nested?.getAttribute('width')).toBe('80')
    expect(nested?.getAttribute('height')).toBe('40')
    expect(nested?.getAttribute('viewBox')).toBe('0 0 8 4')
    expect(nested?.getAttribute('preserveAspectRatio')).toBe('xMinYMin slice')
  })

  it('strips active markup and remote image references while keeping SVG geometry', () => {
    const document = createProbeArtifactDocument(
      '<style>@keyframes move{to{transform:translateX(10px)}}circle{animation:move 1s infinite}</style><svg onload="steal()"><script>steal()</script><foreignObject><iframe src="https://evil.test"></iframe></foreignObject><image href="https://evil.test/image" /><a href="https://evil.test"><circle r="4" /></a><circle r="5" /></svg>'
    )
    expect(document).toContain('<circle r="5">')
    expect(document).not.toContain('@keyframes move')
    expect(document).not.toContain('<script')
    expect(document).not.toContain('onload')
    expect(document).not.toContain('foreignObject')
    expect(document).not.toContain('<image')
    expect(document).not.toContain('<iframe')
    expect(document).not.toContain('https://evil.test')
    expect(document).toContain("connect-src 'none'")
  })

  it('preserves backend-format safe SMIL animations, local paths and gradient references', () => {
    const html = createProbeArtifactDocument(
      `<!doctype html><html><head><style>html,body{margin:0}</style></head><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><path id="track" d="M0 0 L50 50"></path><linearGradient id="paint"><stop offset="0" stop-color="red"></stop></linearGradient></defs><circle id="lamb" cx="10" cy="10" r="5" fill="url(#paint)"><animate attributeName="cy" values="10;20;10" dur="2s" repeatCount="indefinite"></animate><animateTransform attributeName="transform" type="rotate" from="0 10 10" to="360 10 10" dur="4s" repeatCount="indefinite"></animateTransform><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#track"></mpath></animateMotion></circle><animate href="#lamb" attributeName="opacity" values="1;0.5;1" dur="1s"></animate></svg></body></html>`
    )
    const document = new DOMParser().parseFromString(html ?? '', 'text/html')
    expect(
      document
        .querySelector('animate[attributeName="cy"]')
        ?.getAttribute('values')
    ).toBe('10;20;10')
    expect(
      document.querySelector('animateTransform')?.getAttribute('attributeName')
    ).toBe('transform')
    expect(
      document.querySelector('animateTransform')?.getAttribute('repeatCount')
    ).toBe('indefinite')
    expect(
      document.querySelector('animateMotion mpath')?.getAttribute('href')
    ).toBe('#track')
    expect(
      document
        .querySelector('animate[attributeName="opacity"]')
        ?.getAttribute('href')
    ).toBe('#lamb')
    expect(document.querySelector('circle')?.getAttribute('fill')).toBe(
      'url(#paint)'
    )
  })

  it('rejects SMIL URL attribute mutations and external animation targets while retaining safe local targets', () => {
    const html = createProbeArtifactDocument(
      `<svg xmlns="http://www.w3.org/2000/svg"><circle id="shape" r="5"></circle><animate id="url-change" attributeName="href" values="javascript:alert(1)"></animate><animateTransform id="unsafe-transform" attributeName="style" values="background:url(https://evil.test)"></animateTransform><animate id="external-target" href="https://evil.test/shape" attributeName="opacity" values="1;0"></animate><animate id="javascript-target" href="javascript:alert(1)" attributeName="cx" values="1;2"></animate><animate id="external-paint" attributeName="fill" to="url(https://evil.test/paint)"></animate><animateMotion><mpath href="https://evil.test/path"></mpath></animateMotion><animate id="local-target" href="#shape" attributeName="r" values="5;10"></animate></svg>`
    )
    const document = new DOMParser().parseFromString(html ?? '', 'text/html')
    expect(document.querySelector('#url-change')).toBeNull()
    expect(document.querySelector('#unsafe-transform')).toBeNull()
    expect(
      document.querySelector('#external-target')?.getAttribute('href')
    ).toBeNull()
    expect(
      document.querySelector('#javascript-target')?.getAttribute('href')
    ).toBeNull()
    expect(
      document.querySelector('#external-paint')?.getAttribute('to')
    ).toBeNull()
    expect(document.querySelector('mpath')?.getAttribute('href')).toBeNull()
    expect(document.querySelector('#local-target')?.getAttribute('href')).toBe(
      '#shape'
    )
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('https://evil.test')
  })

  it('does not render HTML without an SVG artifact', () => {
    expect(createProbeArtifactDocument('<h1>Not a drawing</h1>')).toBeNull()
  })
})
