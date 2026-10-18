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
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { resolveApiEndpoint } from '../../lib/api-endpoint'
import { ApiEndpointBox } from './api-endpoint-box'
import { CodeRain } from './code-rain'
import { HeroActions } from './hero-actions'
import { HeroTitleBadge } from './hero-title-badge'

const SYSTEM_NAME_PLACEHOLDER = /\{\{\s*systemName\s*\}\}/g

interface HeroSectionProps {
  playEntryAnimation: boolean
  entryAnimationStarted: boolean
  onEntryAnimationStart: () => void
  isAuthenticated: boolean
  className?: string
}

/**
 * Landing hero: API endpoint box, animated title, tagline, and actions.
 */
export function HeroSection(props: HeroSectionProps) {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const { status } = useStatus()
  const config = useSystemConfig()
  const [entryPoint, setEntryPoint] = useState({ x: '50%', y: '30%' })
  const sectionRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  const parallaxY = useTransform(scrollYProgress, [0, 1], [0, 72])

  const configuredTitle = config.homeHeroTitle?.trim()
  const title = configuredTitle || config.systemName
  const configuredPoweredBy = config.homeHeroPoweredBy?.trim()
  const tagline = configuredPoweredBy
    ? configuredPoweredBy.replace(SYSTEM_NAME_PLACEHOLDER, config.systemName)
    : t('Your AI models, one gateway.')
  const apiEndpoint = useMemo(() => resolveApiEndpoint(status), [status])

  const started = props.entryAnimationStarted === true
  const onEntryAnimationStart = props.onEntryAnimationStart
  const playEntry = props.playEntryAnimation === true && !reducedMotion
  const entryStyle = playEntry
    ? ({
        '--home-entry-x': entryPoint.x,
        '--home-entry-y': entryPoint.y,
      } as CSSProperties)
    : undefined

  const handleEntryStart = useCallback(
    (event?: PointerEvent<HTMLElement>) => {
      if (!playEntry || started) return
      if (event) {
        const rect = event.currentTarget.getBoundingClientRect()
        setEntryPoint({
          x: `${event.clientX - rect.left}px`,
          y: `${event.clientY - rect.top}px`,
        })
      }
      onEntryAnimationStart?.()
    },
    [started, onEntryAnimationStart, playEntry]
  )

  useEffect(() => {
    if (!playEntry || started) return
    const timer = window.setTimeout(() => onEntryAnimationStart?.(), 120)
    return () => window.clearTimeout(timer)
  }, [started, onEntryAnimationStart, playEntry])

  return (
    <section
      ref={sectionRef}
      className={cn(
        'bg-background relative isolate z-10 overflow-hidden px-4 pt-24 pb-12 sm:px-6 sm:pt-28 lg:px-8 lg:pb-16',
        playEntry && 'home-entry-hero',
        playEntry && started && 'home-entry-started',
        props.className
      )}
      style={entryStyle}
      onPointerEnter={playEntry ? handleEntryStart : undefined}
    >
      <motion.div
        aria-hidden='true'
        className='pointer-events-none absolute inset-0 -z-10'
        style={reducedMotion ? undefined : { y: parallaxY }}
      >
        <CodeRain className='[mask-image:linear-gradient(to_bottom,black_0%,black_20%,transparent_80%)] opacity-30' />
        <div
          className={cn(
            'absolute inset-0 bg-[radial-gradient(ellipse_at_70%_10%,color-mix(in_oklch,var(--home-accent)_10%,transparent),transparent_60%)]',
            playEntry && 'home-entry-reveal-layer home-entry-ambient-layer'
          )}
        />
      </motion.div>
      {playEntry ? (
        <div aria-hidden='true' className='home-entry-ripple-ring' />
      ) : null}
      <div className='mx-auto flex min-h-[calc(85svh-9rem)] w-full max-w-[80rem] flex-col justify-end lg:min-h-[calc(100svh-11rem)]'>
        <ApiEndpointBox apiEndpoint={apiEndpoint} />
        <div className='mt-8 grid min-w-0 items-end gap-8 lg:mt-12 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:gap-14'>
          <h1
            className={cn(
              'min-w-0 leading-[1.02] font-semibold tracking-[-0.028em] text-balance',
              title.length > 12
                ? 'text-[clamp(2.1rem,5.4vw,4.5rem)]'
                : 'text-[clamp(2.6rem,7.5vw,6rem)]'
            )}
          >
            <HeroTitleBadge
              logoDarkUrl={config.logoDark}
              logoLightUrl={config.logoLight}
              motionDarkUrl={config.homeHeroBadgeMotionDark}
              motionLightUrl={config.homeHeroBadgeMotionLight}
            >
              {title}
            </HeroTitleBadge>
            <span className='text-foreground/75 mt-4 block text-[0.55em] leading-[1.18] tracking-[-0.018em] [overflow-wrap:anywhere]'>
              {tagline}
            </span>
          </h1>
          <div className='flex min-w-0 flex-col gap-6 xl:text-right'>
            <p className='text-foreground/85 max-w-[34rem] text-lg leading-relaxed text-pretty sm:text-xl xl:ml-auto'>
              {t(
                'Manage model access, usage, and costs for your coding tools and applications.'
              )}
            </p>
            <HeroActions
              isAuthenticated={props.isAuthenticated === true}
              align='end'
            />
          </div>
        </div>
      </div>
    </section>
  )
}
