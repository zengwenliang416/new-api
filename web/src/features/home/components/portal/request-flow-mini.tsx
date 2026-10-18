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
import { motion, useReducedMotion, useScroll } from 'motion/react'
import { useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

import { CarbonIcons } from './icons'

const FLOW_CHANNELS = ['OpenAI', 'Claude', 'Gemini', 'DeepSeek', 'Qwen', 'GLM']

/**
 * Compact request-flow visual used inside the routing bento card.
 */
export function RequestFlowMini() {
  const { t } = useTranslation()
  const reducedMotion = useReducedMotion()
  const lineRef = useRef<HTMLDivElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: lineRef,
    offset: ['start 0.92', 'start 0.45'],
  })

  return (
    <div className='mt-5 select-none'>
      <div className='flex items-center gap-3'>
        <div className='border-border/40 bg-muted/30 flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2'>
          <CarbonIcons.Roadmap className='size-3.5 text-[color:var(--home-accent)]' />
          <span className='text-foreground/90 font-mono text-xs font-semibold'>
            {t('Your request')}
          </span>
        </div>
        <div ref={lineRef} className='relative h-px flex-1 overflow-hidden'>
          <div className='bg-border/50 absolute inset-0' />
          <motion.span
            className='absolute inset-0 origin-left bg-[var(--home-accent)] opacity-40'
            style={reducedMotion ? undefined : { scaleX: scrollYProgress }}
            aria-hidden='true'
          />
          <span
            className='flow-dash absolute inset-0 bg-[var(--home-accent)]'
            aria-hidden='true'
          />
        </div>
      </div>
      <div className='mt-4 grid grid-cols-3 gap-2'>
        {FLOW_CHANNELS.map((channel, index) => (
          <div
            key={channel}
            className='flow-chip border-border/30 bg-muted/20 text-muted-foreground flex items-center justify-center rounded-lg border px-2 py-2 text-xs transition-colors duration-300 hover:border-[color-mix(in_oklch,var(--home-accent)_30%,transparent)] hover:bg-[color-mix(in_oklch,var(--home-accent)_5%,transparent)]'
            style={{ '--flow-stagger': `${0.45 * index}s` } as CSSProperties}
          >
            {channel}
          </div>
        ))}
      </div>
    </div>
  )
}
