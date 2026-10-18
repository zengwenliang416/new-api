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
import { useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

const PLAY_DURATION_MS = 5056
const FADE_DURATION_MS = 220

const motionAssetCache = new Map<string, Promise<Blob>>()

type MotionState = 'idle' | 'loading' | 'playing' | 'fading'

function loadMotionAsset(url: string): Promise<Blob> {
  const cached = motionAssetCache.get(url)
  if (cached) return cached
  const request = fetch(url, { cache: 'force-cache' }).then((response) => {
    if (!response.ok) {
      throw new Error(`Unable to load brand motion asset: ${response.status}`)
    }
    return response.blob()
  })
  motionAssetCache.set(url, request)
  return request
}

interface UseMotionBadgeOptions {
  enabled?: boolean
  motionUrl?: string
}

/**
 * Plays a short animated badge once per pointer entry.
 *
 * Loads the animation asset (cached per URL), swaps it in while playing, and
 * falls back to the static badge for reduced motion, save-data users, and
 * touch-only devices.
 */
export function useMotionBadge(options: UseMotionBadgeOptions = {}) {
  const enabled = options.enabled ?? true
  const motionUrl = options.motionUrl ?? ''
  const reducedMotion = useReducedMotion() ?? false
  const [state, setState] = useState<MotionState>('idle')
  const [motionKey, setMotionKey] = useState(0)
  const [motionPlaybackUrl, setMotionPlaybackUrl] = useState('')
  const tokenRef = useRef(0)
  const stateRef = useRef<MotionState>('idle')
  const fadeTimerRef = useRef<number | null>(null)
  const playTimerRef = useRef<number | null>(null)
  const objectUrlRef = useRef('')

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const revokeObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = ''
      setMotionPlaybackUrl('')
    }
  }, [])

  const reset = useCallback(() => {
    tokenRef.current += 1
    if (playTimerRef.current) {
      window.clearTimeout(playTimerRef.current)
      playTimerRef.current = null
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
    revokeObjectUrl()
  }, [revokeObjectUrl])

  const stopAndReset = useCallback(() => {
    reset()
    stateRef.current = 'idle'
    setState('idle')
  }, [reset])

  const play = useCallback(() => {
    setMotionKey((key) => key + 1)
    stateRef.current = 'playing'
    setState('playing')
    playTimerRef.current = window.setTimeout(() => {
      playTimerRef.current = null
      stateRef.current = 'fading'
      setState('fading')
      fadeTimerRef.current = window.setTimeout(() => {
        fadeTimerRef.current = null
        stateRef.current = 'idle'
        setState('idle')
        revokeObjectUrl()
      }, FADE_DURATION_MS)
    }, PLAY_DURATION_MS)
  }, [revokeObjectUrl])

  const startMotion = useCallback(() => {
    if (typeof window === 'undefined') return
    const pointerAllowsHover = window.matchMedia(
      '(hover: hover) and (pointer: fine)'
    ).matches
    const saveData =
      (navigator as Navigator & { connection?: { saveData?: boolean } })
        .connection?.saveData ?? false
    if (
      !enabled ||
      !motionUrl ||
      reducedMotion ||
      stateRef.current !== 'idle' ||
      saveData ||
      !pointerAllowsHover
    ) {
      return
    }

    stateRef.current = 'loading'
    setState('loading')
    tokenRef.current += 1
    const token = tokenRef.current

    loadMotionAsset(motionUrl)
      .then((blob) => {
        if (tokenRef.current !== token || stateRef.current !== 'loading') return
        revokeObjectUrl()
        const objectUrl = URL.createObjectURL(blob)
        objectUrlRef.current = objectUrl
        setMotionPlaybackUrl(objectUrl)
        play()
      })
      .catch(() => {
        if (tokenRef.current !== token) return
        stateRef.current = 'idle'
        setState('idle')
      })
  }, [enabled, motionUrl, reducedMotion, play, revokeObjectUrl])

  useEffect(() => {
    if (!enabled || reducedMotion) {
      stopAndReset()
    }
  }, [enabled, reducedMotion, stopAndReset])

  useEffect(() => stopAndReset, [motionUrl, stopAndReset])

  return {
    motionFading: state === 'fading',
    motionKey,
    motionPlaybackUrl,
    motionVisible:
      !!motionPlaybackUrl && (state === 'playing' || state === 'fading'),
    startMotion,
    staticHidden: state === 'loading' || state === 'playing',
  }
}
