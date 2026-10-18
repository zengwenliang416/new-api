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
  useTransform,
  type MotionValue,
} from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { toIntlLocale } from '@/i18n/languages'
import { DEFAULT_BRAND } from '@/lib/brands'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { CarbonIcons } from './icons'

const DRAW_RANGE_IN: [number, number] = [0.06, 0.26]
const DOT_RANGE_IN: [number, number] = [0.07, 0.26]
const DRAW_RANGE_OUT: [number, number] = [0.36, 0.52]
const DOT_RANGE_OUT: [number, number] = [0.37, 0.52]
const CHANNEL_LIT = [0.52, 0.58, 0.64]
const RETURN_RANGE_IN: [number, number] = [0.78, 0.9]
const RETURN_RANGE_OUT: [number, number] = [0.68, 0.78]
const TIMING_RANGE: [number, number] = [0.7, 0.92]

const FLOW_STEPS = [
  {
    key: 'Send',
    desc: 'Use a compatible endpoint and key; some clients may require configuration changes.',
  },
  {
    key: 'Route',
    desc: 'The gateway selects an available configured upstream using current routing and health signals.',
  },
  {
    key: 'Observe',
    desc: 'Usage records show latency, tokens, and cost when those metrics are available.',
  },
] as const

const PIPELINE_CHANNELS = ['OpenAI', 'Claude', 'Gemini'] as const

interface ProgressLineProps {
  progress: MotionValue<number>
  interactive: boolean
  drawRange: [number, number]
  dotRange: [number, number]
  returnRange?: [number, number]
}

function ProgressLine(props: ProgressLineProps) {
  const draw = useTransform(props.progress, props.drawRange, [0, 1])
  const dotLeft = useTransform(props.progress, props.dotRange, ['0%', '100%'])
  const dotOpacity = useTransform(
    props.progress,
    [
      props.dotRange[0],
      props.dotRange[0] + 0.02,
      props.dotRange[1] - 0.02,
      props.dotRange[1],
    ],
    [0, 1, 1, 0]
  )
  const returnRange = props.returnRange ?? [0, 0.01]
  const returnLeft = useTransform(props.progress, returnRange, ['100%', '0%'])
  const returnOpacity = useTransform(
    props.progress,
    [
      returnRange[0],
      returnRange[0] + 0.02,
      returnRange[1] - 0.02,
      returnRange[1],
    ],
    [0, 1, 1, 0]
  )

  if (!props.interactive) {
    return (
      <div className='relative h-px flex-1 bg-white/15'>
        <div className='absolute inset-0 bg-[var(--home-accent)]' />
      </div>
    )
  }

  return (
    <div className='relative h-px flex-1 bg-white/15'>
      <motion.span
        aria-hidden='true'
        className='absolute inset-0 origin-left bg-[var(--home-accent)]'
        style={{ scaleX: draw }}
      />
      <motion.span
        aria-hidden='true'
        className='absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--home-accent)] shadow-[0_0_10px_color-mix(in_oklch,var(--home-accent)_70%,transparent)]'
        style={{ left: dotLeft, opacity: dotOpacity }}
      />
      {props.returnRange ? (
        <motion.span
          aria-hidden='true'
          className='absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]'
          style={{ left: returnLeft, opacity: returnOpacity }}
        />
      ) : null}
    </div>
  )
}

interface FlowNodeProps {
  name: string
  litAt: number
  progress: MotionValue<number>
  interactive: boolean
}

function FlowNode(props: FlowNodeProps) {
  const lit = useTransform(
    props.progress,
    [props.litAt, props.litAt + 0.05, 1],
    [0, 1, 1]
  )
  const color = useTransform(
    props.progress,
    [props.litAt, props.litAt + 0.05],
    ['rgba(255, 255, 255, 0.75)', 'rgba(255, 255, 255, 0.95)']
  )

  if (!props.interactive) {
    return (
      <div className='rounded-lg border border-[var(--home-accent)] bg-[color-mix(in_oklch,var(--home-accent)_14%,transparent)] px-3 py-2 text-center text-xs font-semibold text-white/95'>
        {props.name}
      </div>
    )
  }

  return (
    <div className='relative rounded-lg border border-white/15 px-3 py-2 text-center text-xs font-semibold'>
      <motion.span
        aria-hidden='true'
        className='absolute inset-0 rounded-lg border border-[var(--home-accent)] bg-[color-mix(in_oklch,var(--home-accent)_14%,transparent)] shadow-[0_0_20px_color-mix(in_oklch,var(--home-accent)_30%,transparent)]'
        style={{ opacity: lit }}
      />
      <motion.span className='relative' style={{ color }}>
        {props.name}
      </motion.span>
    </div>
  )
}

/**
 * Dark sticky section that walks one request through the gateway.
 */
export function RequestFlowSection() {
  const { t, i18n } = useTranslation()
  const config = useSystemConfig()
  const reducedMotion = useReducedMotion()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)

  const [desktop, setDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const interactive = desktop && !reducedMotion
  const sectionRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })
  const returnScale = useTransform(scrollYProgress, [0.72, 0.9], [0.85, 1.3])
  const returnRingOpacity = useTransform(
    scrollYProgress,
    [0.72, 0.78, 0.95],
    [0, 0.55, 0]
  )
  const latency = useTransform(scrollYProgress, TIMING_RANGE, [0, 187])
  const latencyLabel = useTransform(latency, (value) => `${Math.round(value)}`)
  const tokens = useTransform(scrollYProgress, TIMING_RANGE, [0, 2148])
  const tokensLabel = useTransform(tokens, (value) =>
    formatNumber(Math.round(value), locale)
  )
  const systemLogo = config.logoDark || DEFAULT_BRAND.logoDark

  return (
    <section
      ref={sectionRef}
      className={cn('relative z-10', interactive && 'lg:h-[190svh]')}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-[#060a13] text-white',
          interactive && 'sticky top-0 flex min-h-svh flex-col justify-center'
        )}
      >
        <div
          aria-hidden='true'
          className='absolute inset-0'
          style={{
            background:
              'radial-gradient(circle at 50% 42%, color-mix(in oklch, var(--home-accent) 16%, transparent) 0, transparent 46%)',
          }}
        />
        <div className='relative mx-auto w-full max-w-[80rem] px-4 py-16 sm:px-6 lg:px-8 lg:py-24'>
          <div className='flex flex-wrap items-end justify-between gap-6'>
            <div className='max-w-[28rem]'>
              <h2 className='text-3xl leading-tight font-bold tracking-tight md:text-4xl'>
                {t('Follow one request')}
              </h2>
              <p className='mt-3 text-sm leading-relaxed text-white/75'>
                {t(
                  'Request flow illustration. Values below are examples, not live measurements.'
                )}
              </p>
            </div>
            <div className='flex items-center gap-8 font-mono'>
              <div>
                <div className='text-xs font-medium text-white/70'>
                  {t('Latency')}
                </div>
                <div className='mt-1 text-2xl font-semibold text-white tabular-nums md:text-3xl'>
                  {interactive ? (
                    <motion.span>{latencyLabel}</motion.span>
                  ) : (
                    '187'
                  )}
                  <span className='ml-1 text-sm text-white/70'>ms</span>
                </div>
              </div>
              <div>
                <div className='text-xs font-medium text-white/70'>
                  {t('Tokens')}
                </div>
                <div className='mt-1 text-2xl font-semibold text-[color:var(--home-accent)] tabular-nums md:text-3xl'>
                  {interactive ? (
                    <motion.span>{tokensLabel}</motion.span>
                  ) : (
                    formatNumber(2148, locale)
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className='mt-10 flex items-center gap-2 sm:gap-4 lg:mt-14'>
            <div className='flex w-16 shrink-0 flex-col items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-2 py-2.5 sm:w-auto sm:flex-row sm:px-4'>
              <CarbonIcons.Screen
                className='size-4 text-white/75'
                aria-hidden='true'
              />
              <span className='max-w-full text-center text-xs font-semibold [overflow-wrap:anywhere] text-white/85 sm:text-sm'>
                {t('Your app')}
              </span>
            </div>
            <ProgressLine
              progress={scrollYProgress}
              interactive={interactive}
              drawRange={DRAW_RANGE_IN}
              dotRange={DOT_RANGE_IN}
              returnRange={RETURN_RANGE_IN}
            />
            <div className='relative max-w-[42%] min-w-0 sm:max-w-[50%]'>
              {interactive ? (
                <motion.span
                  aria-hidden='true'
                  className='absolute -inset-3 rounded-2xl border border-[var(--home-accent)]'
                  style={{ scale: returnScale, opacity: returnRingOpacity }}
                />
              ) : null}
              <div className='relative flex min-w-0 flex-col items-center gap-2 rounded-xl border border-white/20 bg-white/[0.07] px-3 py-3 sm:flex-row sm:gap-2.5 sm:px-4'>
                <img
                  src={systemLogo}
                  alt=''
                  className='size-6 shrink-0 rounded-md object-contain sm:size-7'
                />
                <span className='min-w-0 text-center text-xs font-semibold break-words sm:text-sm'>
                  {config.systemName}
                </span>
              </div>
            </div>
            <ProgressLine
              progress={scrollYProgress}
              interactive={interactive}
              drawRange={DRAW_RANGE_OUT}
              dotRange={DOT_RANGE_OUT}
              returnRange={RETURN_RANGE_OUT}
            />
            <div className='flex w-16 shrink-0 flex-col gap-2 sm:w-28'>
              {PIPELINE_CHANNELS.map((channel, index) => (
                <FlowNode
                  key={channel}
                  name={channel}
                  litAt={CHANNEL_LIT[index]}
                  progress={scrollYProgress}
                  interactive={interactive}
                />
              ))}
            </div>
          </div>
          <div className='mt-12 grid gap-8 lg:grid-cols-3'>
            {FLOW_STEPS.map((step, index) => (
              <div key={step.key} className='flex items-start gap-4'>
                <span className='font-mono text-xs font-semibold text-[color:var(--home-accent)]'>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className='text-base font-semibold text-white'>
                    {t(step.key)}
                  </h3>
                  <p className='mt-2 text-sm leading-relaxed text-white/75'>
                    {t(step.desc)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
