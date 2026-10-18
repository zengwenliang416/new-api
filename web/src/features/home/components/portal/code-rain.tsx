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
import { useEffect, useRef } from 'react'

import { useTheme } from '@/context/theme-provider'
import { cn } from '@/lib/utils'

const CODE_RAIN_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}[]()<>/\\=+*$#@%&:;._-'

function randomLineContent(width: number): string {
  const length = 2 * Math.ceil(width / 8.68)
  let content = ''
  for (let index = 0; index < length; index++) {
    content +=
      Math.random() < 0.13
        ? ' '
        : CODE_RAIN_CHARS[Math.floor(Math.random() * CODE_RAIN_CHARS.length)]
  }
  return content
}

interface CodeRainLine {
  alpha: number
  content: string
  speed: number
  x: number
  y: number
}

interface CodeRainProps {
  paused?: boolean
  className?: string
}

/**
 * Decorative canvas of drifting code characters behind the hero title.
 *
 * Lines scroll left; pointer distance from the horizontal center modulates the
 * overall speed and a soft radial light follows the pointer.
 */
export function CodeRain(props: CodeRainProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const { resolvedTheme } = useTheme()
  const reducedMotion = useReducedMotion() ?? false
  const paused = props.paused === true

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const isDark = resolvedTheme === 'dark'
    const characterColor = isDark ? '198, 219, 255' : '28, 56, 112'
    const accentColor = isDark ? '59, 130, 246' : '37, 99, 235'
    const focus = { x: 0, y: 0 }
    let speed = 0.85
    let frameId = 0
    let canvasHeight = 1
    let canvasWidth = 1
    let lines: CodeRainLine[] = []
    let running = false
    let targetSpeed = 0.85

    const draw = () => {
      context.clearRect(0, 0, canvasWidth, canvasHeight)
      context.font =
        '500 14px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
      context.textBaseline = 'top'
      speed += (targetSpeed - speed) * 0.055
      for (const line of lines) {
        line.x += line.speed * speed
        const textWidth = context.measureText(line.content).width
        if (line.x < -textWidth / 2) line.x += textWidth / 2
        context.fillStyle = `rgba(${characterColor}, ${line.alpha})`
        context.fillText(line.content, line.x, line.y)
      }
      context.save()
      context.globalCompositeOperation = 'destination-in'
      const fade = context.createLinearGradient(0, 0, canvasWidth, 0)
      fade.addColorStop(0, 'rgba(0, 0, 0, 0)')
      fade.addColorStop(canvasWidth < 768 ? 0.08 : 0.16, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(canvasWidth < 768 ? 0.92 : 0.84, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = fade
      context.fillRect(0, 0, canvasWidth, canvasHeight)
      context.restore()
      context.save()
      context.globalCompositeOperation = 'lighter'
      const glow = context.createRadialGradient(
        focus.x,
        focus.y,
        0,
        focus.x,
        focus.y,
        0.34 * Math.max(canvasWidth, canvasHeight)
      )
      glow.addColorStop(0, `rgba(${accentColor}, ${isDark ? 0.18 : 0.1})`)
      glow.addColorStop(0.48, `rgba(${accentColor}, ${isDark ? 0.07 : 0.035})`)
      glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = glow
      context.fillRect(0, 0, canvasWidth, canvasHeight)
      context.restore()
      if (!running || reducedMotion || paused) return
      frameId = window.requestAnimationFrame(draw)
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      canvasWidth = Math.max(1, rect.width)
      canvasHeight = Math.max(1, rect.height)
      focus.x = 0.62 * canvasWidth
      focus.y = 0.36 * canvasHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(canvasWidth * dpr)
      canvas.height = Math.round(canvasHeight * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      lines = Array.from(
        { length: Math.ceil(canvasHeight / 20) + 2 },
        (_, row) => ({
          alpha: 0.22 * Math.random() + (isDark ? 0.08 : 0.05),
          content: randomLineContent(canvasWidth),
          speed: -(0.44 * Math.random() + 0.34),
          x: -(Math.random() * canvasWidth),
          y: 20 * row,
        })
      )
      draw()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      focus.x = event.clientX - rect.left
      focus.y = event.clientY - rect.top
      const halfWidth = canvasWidth / 2
      targetSpeed = 0.55 + 2.6 * Math.abs((focus.x - halfWidth) / halfWidth)
    }

    resize()
    const intersectionObserver = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const shouldRun = entry.isIntersecting && !reducedMotion && !paused
      if (shouldRun && !running) {
        running = true
        frameId = window.requestAnimationFrame(draw)
      } else if (!shouldRun && running) {
        running = false
        window.cancelAnimationFrame(frameId)
      }
    })
    intersectionObserver.observe(canvas)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => {
      running = false
      intersectionObserver.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      if (frameId) window.cancelAnimationFrame(frameId)
    }
  }, [resolvedTheme, reducedMotion, paused])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full',
        props.className
      )}
    />
  )
}
