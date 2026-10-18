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
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

let useMotionBadge: typeof import('../hooks/use-motion-badge').useMotionBadge
let reducedMotion = false
const mediaChanges = new EventTarget()
const fetchAsset = vi.fn<typeof fetch>()
const createObjectURL = vi.fn(() => 'blob:current-motion')
const revokeObjectURL = vi.fn()

function pendingAsset() {
  let resolveAsset!: (response: Response) => void
  let rejectAsset!: (reason: Error) => void
  const promise = new Promise<Response>((resolve, reject) => {
    resolveAsset = resolve
    rejectAsset = reject
  })
  return { promise, resolve: resolveAsset, reject: rejectAsset }
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  reducedMotion = false
  mediaChanges.dispatchEvent(new Event('change'))
  fetchAsset.mockReset()
  createObjectURL.mockReset().mockReturnValue('blob:current-motion')
  revokeObjectURL.mockReset()
  vi.stubGlobal('fetch', fetchAsset)
  vi.stubGlobal(
    'URL',
    Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL })
  )
  vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    get matches() {
      return query.includes('prefers-reduced-motion') ? reducedMotion : true
    },
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: mediaChanges.addEventListener.bind(mediaChanges),
    removeEventListener: mediaChanges.removeEventListener.bind(mediaChanges),
    dispatchEvent: mediaChanges.dispatchEvent.bind(mediaChanges),
  }))
  useMotionBadge = (await import('../hooks/use-motion-badge')).useMotionBadge
})

afterEach(() => {
  cleanup()
  reducedMotion = false
  mediaChanges.dispatchEvent(new Event('change'))
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('brand motion asset changes', () => {
  test.each(['resolve', 'reject'] as const)(
    'ignores a former theme request that later settles with %s while the current animation loads',
    async (outcome) => {
      const previous = pendingAsset()
      const current = pendingAsset()
      fetchAsset
        .mockReturnValueOnce(previous.promise)
        .mockReturnValueOnce(current.promise)
      const { result, rerender } = renderHook(
        (options) => useMotionBadge(options),
        { initialProps: { motionUrl: '/brand-light.webp' } }
      )
      act(() => result.current.startMotion())
      rerender({ motionUrl: '/brand-dark.webp' })
      act(() => result.current.startMotion())

      await act(async () => {
        if (outcome === 'resolve') previous.resolve(new Response('light'))
        else previous.reject(new Error('Previous asset unavailable'))
      })
      expect(result.current.motionVisible).toBe(false)
      expect(result.current.staticHidden).toBe(true)
      expect(createObjectURL).not.toHaveBeenCalled()

      await act(async () => current.resolve(new Response('dark')))
      expect(fetchAsset).toHaveBeenLastCalledWith('/brand-dark.webp', {
        cache: 'force-cache',
      })
      expect(result.current.motionPlaybackUrl).toBe('blob:current-motion')
      expect(result.current.motionVisible).toBe(true)
    }
  )

  test('releases a playing theme asset and lets the replacement play for its full duration', async () => {
    fetchAsset.mockImplementation(async () => new Response('motion'))
    createObjectURL
      .mockReturnValueOnce('blob:light-motion')
      .mockReturnValueOnce('blob:dark-motion')
    const { result, rerender } = renderHook(
      (options) => useMotionBadge(options),
      { initialProps: { motionUrl: '/brand-light.webp' } }
    )
    await act(async () => result.current.startMotion())
    expect(result.current.motionVisible).toBe(true)
    act(() => vi.advanceTimersByTime(1000))

    rerender({ motionUrl: '/brand-dark.webp' })
    expect(result.current.motionVisible).toBe(false)
    expect(result.current.staticHidden).toBe(false)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:light-motion')
    await act(async () => result.current.startMotion())
    act(() => vi.advanceTimersByTime(4056))
    expect(result.current.motionPlaybackUrl).toBe('blob:dark-motion')
    expect(result.current.motionVisible).toBe(true)
    expect(result.current.motionFading).toBe(false)

    act(() => vi.advanceTimersByTime(1000))
    expect(result.current.motionFading).toBe(true)
    act(() => vi.advanceTimersByTime(220))
    expect(result.current.motionVisible).toBe(false)
    expect(result.current.staticHidden).toBe(false)
  })

  test('keeps the static logo when switching to a brand without motion during loading', async () => {
    const previous = pendingAsset()
    fetchAsset.mockReturnValue(previous.promise)
    const { result, rerender } = renderHook(
      (options) => useMotionBadge(options),
      { initialProps: { motionUrl: '/brand-light.webp' } }
    )
    act(() => result.current.startMotion())
    rerender({ motionUrl: '' })
    expect(result.current.staticHidden).toBe(false)
    await act(async () => previous.resolve(new Response('previous-brand')))
    act(() => result.current.startMotion())
    expect(result.current.motionVisible).toBe(false)
    expect(result.current.motionPlaybackUrl).toBe('')
    expect(createObjectURL).not.toHaveBeenCalled()
  })

  test('keeps explicitly configured animation static when reduced motion is preferred', () => {
    reducedMotion = true
    mediaChanges.dispatchEvent(new Event('change'))
    const { result, rerender } = renderHook(
      (options) => useMotionBadge(options),
      { initialProps: { motionUrl: 'https://assets.example.com/custom.webp' } }
    )
    act(() => result.current.startMotion())
    rerender({ motionUrl: 'https://assets.example.com/custom-dark.webp' })
    act(() => result.current.startMotion())
    expect(result.current.staticHidden).toBe(false)
    expect(result.current.motionVisible).toBe(false)
    expect(fetchAsset).not.toHaveBeenCalled()
  })
})
