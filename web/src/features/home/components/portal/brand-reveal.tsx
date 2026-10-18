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
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { getBrand, isDefaultSystemName } from '@/lib/brands'

const DEFAULT_FOREGROUND = '#020617'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function setFont(
  context: CanvasRenderingContext2D,
  fontSize: number,
  weight = 900
) {
  context.font = `${weight} ${fontSize}px "Public Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif`
}

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startSize: number
): number {
  setFont(context, startSize)
  const measuredWidth = context.measureText(text).width
  const size =
    measuredWidth > maxWidth
      ? (startSize * maxWidth) / measuredWidth
      : startSize
  setFont(context, size)
  return size
}

function drawCenteredText(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  baselineY: number
) {
  const textWidth = context.measureText(text).width
  context.fillText(text, (width - textWidth) / 2, baselineY)
}

function drawBrandWordmark(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  brandId: string,
  systemName: string,
  colors: { background: string; foreground: string }
) {
  context.clearRect(0, 0, width, height)
  context.save()
  context.textBaseline = 'alphabetic'
  context.fillStyle = colors.foreground
  if (brandId === 'hlool') {
    fitFontSize(context, systemName, 0.92 * width, 0.76 * height)
    drawCenteredText(context, systemName, width, 0.78 * height)
  } else {
    fitFontSize(context, systemName, 0.9 * width, 0.64 * height)
    drawCenteredText(context, systemName, width, 0.73 * height)
  }
  context.restore()
}

interface RevealGrid {
  columns: number
  rows: number
  cellSize: number
  offsetX: Float32Array
  offsetY: Float32Array
}

function buildGrid(
  width: number,
  height: number,
  cellSize: number
): RevealGrid {
  const columns = Math.ceil(width / cellSize)
  const rows = Math.ceil(height / cellSize)
  return {
    columns,
    rows,
    cellSize,
    offsetX: new Float32Array(columns * rows),
    offsetY: new Float32Array(columns * rows),
  }
}

/**
 * Full-width brand wordmark with pointer-driven canvas distortion.
 *
 * The wordmark is rasterized to an offscreen canvas, then drawn tile by tile
 * with per-cell offsets that decay between frames and get pushed around by the
 * pointer and page scroll velocity.
 */
export function BrandReveal() {
  const { t } = useTranslation()
  const config = useSystemConfig()
  const siteBrand = config.siteBrand
  const systemName = isDefaultSystemName(config.systemName)
    ? getBrand(siteBrand).revealLabel
    : config.systemName
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const staticRef = useRef<HTMLDivElement | null>(null)
  const reducedMotion = useReducedMotion() ?? false
  const { scrollY } = useScroll()
  const scrollVelocity = useVelocity(scrollY)
  const springVelocity = useSpring(scrollVelocity, {
    damping: 50,
    stiffness: 380,
  })
  const skew = useTransform(springVelocity, [-2800, 0, 2800], [2.4, 0, -2.4])

  useEffect(() => {
    const canvas = canvasRef.current
    const staticLayer = staticRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const offscreen = document.createElement('canvas')
    const offscreenContext = offscreen.getContext('2d')
    if (!offscreenContext) return
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    staticLayer?.setAttribute('data-canvas-active', 'true')

    let frameId = 0
    let canvasWidth = 0
    let canvasHeight = 0
    let dpr = 1
    let grid = buildGrid(1, 1, 16)
    let colors = {
      background: getBrand(siteBrand).revealBackground,
      foreground: DEFAULT_FOREGROUND,
    }
    let lastPointerX = 0
    let lastPointerY = 0
    let pointerInside = false
    let running = false
    let visible = false

    const readColors = () => {
      const styles = getComputedStyle(
        canvas.closest('.home-brand-reveal-fixed') || canvas
      )
      colors = {
        background:
          styles.backgroundColor || getBrand(siteBrand).revealBackground,
        foreground: styles.color || DEFAULT_FOREGROUND,
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      readColors()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvasWidth = Math.max(1, Math.floor(rect.width * dpr))
      canvasHeight = Math.max(1, Math.floor(rect.height * dpr))
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      offscreen.width = canvasWidth
      offscreen.height = canvasHeight
      const cellSize = Math.round(
        clamp((rect.width / 76) * dpr, 14 * dpr, 30 * dpr)
      )
      grid = buildGrid(canvasWidth, canvasHeight, cellSize)
      drawBrandWordmark(
        offscreenContext,
        canvasWidth,
        canvasHeight,
        siteBrand,
        systemName,
        colors
      )
      context.drawImage(offscreen, 0, 0)
    }

    const startLoop = () => {
      if (running || !visible || motionQuery.matches) return
      running = true
      frameId = window.requestAnimationFrame(tick)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!visible) {
        pointerInside = false
        return
      }
      const rect = canvas.getBoundingClientRect()
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      if (!isInside) {
        pointerInside = false
        return
      }
      const x = (event.clientX - rect.left) * dpr
      const y = (event.clientY - rect.top) * dpr
      const deltaX = pointerInside ? x - lastPointerX : 0
      const deltaY = pointerInside ? y - lastPointerY : 0
      lastPointerX = x
      lastPointerY = y
      pointerInside = true

      const push = Math.min(Math.hypot(deltaX, deltaY), 80 * dpr)
      const radius = 0.36 * Math.min(canvasWidth, canvasHeight)
      const fromCol = clamp(
        Math.floor((x - radius) / grid.cellSize),
        0,
        grid.columns - 1
      )
      const toCol = clamp(
        Math.ceil((x + radius) / grid.cellSize),
        0,
        grid.columns - 1
      )
      const fromRow = clamp(
        Math.floor((y - radius) / grid.cellSize),
        0,
        grid.rows - 1
      )
      const toRow = clamp(
        Math.ceil((y + radius) / grid.cellSize),
        0,
        grid.rows - 1
      )
      const maxOffset = 0.95 * grid.cellSize

      for (let row = fromRow; row <= toRow; row++) {
        for (let col = fromCol; col <= toCol; col++) {
          const distance = Math.hypot(
            x - (col * grid.cellSize + grid.cellSize / 2),
            y - (row * grid.cellSize + grid.cellSize / 2)
          )
          if (distance > radius) continue
          const index = row * grid.columns + col
          const falloff = (1 - distance / radius) ** 2
          const noise = (Math.random() - 0.5) * push * 0.22
          grid.offsetX[index] = clamp(
            grid.offsetX[index] + (0.9 * deltaX + noise) * falloff,
            -maxOffset,
            maxOffset
          )
          grid.offsetY[index] = clamp(
            grid.offsetY[index] + (0.75 * deltaY - noise) * falloff,
            -maxOffset,
            maxOffset
          )
        }
      }
      startLoop()
    }

    const tick = () => {
      context.clearRect(0, 0, canvasWidth, canvasHeight)
      let energy = 0
      for (let row = 0; row < grid.rows; row++) {
        for (let col = 0; col < grid.columns; col++) {
          const index = row * grid.columns + col
          const sourceX = col * grid.cellSize
          const sourceY = row * grid.cellSize
          const tileWidth = Math.min(grid.cellSize, canvasWidth - sourceX)
          const tileHeight = Math.min(grid.cellSize, canvasHeight - sourceY)
          grid.offsetX[index] *= 0.88
          grid.offsetY[index] *= 0.88
          if (Math.abs(grid.offsetX[index]) < 0.04) grid.offsetX[index] = 0
          if (Math.abs(grid.offsetY[index]) < 0.04) grid.offsetY[index] = 0
          energy +=
            Math.abs(grid.offsetX[index]) + Math.abs(grid.offsetY[index])
          context.drawImage(
            offscreen,
            sourceX,
            sourceY,
            tileWidth,
            tileHeight,
            sourceX + grid.offsetX[index],
            sourceY + grid.offsetY[index],
            tileWidth,
            tileHeight
          )
        }
      }
      if (energy === 0) {
        running = false
        return
      }
      frameId = window.requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)

    const mutationObserver = new MutationObserver(() => {
      readColors()
      drawBrandWordmark(
        offscreenContext,
        canvasWidth,
        canvasHeight,
        siteBrand,
        systemName,
        colors
      )
      context.clearRect(0, 0, canvasWidth, canvasHeight)
      context.drawImage(offscreen, 0, 0)
    })
    mutationObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    const section = canvas.closest('.home-brand-reveal')
    let intersectionObserver: IntersectionObserver | null = null
    if (section) {
      intersectionObserver = new IntersectionObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        visible = entry.isIntersecting
        if (visible) {
          startLoop()
        } else {
          running = false
          window.cancelAnimationFrame(frameId)
        }
      })
      intersectionObserver.observe(section)
    } else {
      visible = true
      startLoop()
    }

    if (!motionQuery.matches) {
      window.addEventListener('pointermove', onPointerMove)
    }

    return () => {
      running = false
      intersectionObserver?.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      mutationObserver.disconnect()
      window.cancelAnimationFrame(frameId)
      staticLayer?.removeAttribute('data-canvas-active')
    }
  }, [siteBrand, systemName])

  return (
    <section
      className='home-brand-reveal'
      aria-label={t('Brand reveal design')}
    >
      <div
        className='home-brand-reveal-fixed'
        data-brand-reveal-theme={siteBrand}
      >
        <motion.div
          className='absolute inset-0'
          style={reducedMotion ? undefined : { skewY: skew }}
        >
          <div
            ref={staticRef}
            className='home-brand-reveal-static'
            aria-hidden='true'
          >
            <span className='home-brand-reveal-word'>{systemName}</span>
          </div>
          <canvas
            ref={canvasRef}
            className='home-brand-reveal-canvas'
            aria-hidden='true'
          />
        </motion.div>
        <h2 className='sr-only'>{systemName}</h2>
      </div>
    </section>
  )
}
