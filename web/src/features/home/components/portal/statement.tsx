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
import { Fragment, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface RevealWordProps {
  progress: MotionValue<number>
  range: [number, number]
  className?: string
  children: ReactNode
}

function RevealWord(props: RevealWordProps) {
  const reducedMotion = useReducedMotion()
  const y = useTransform(props.progress, props.range, [18, 0])
  if (reducedMotion) {
    return <span className={props.className}>{props.children}</span>
  }
  return (
    <motion.span className={cn('inline-block', props.className)} style={{ y }}>
      {props.children}
    </motion.span>
  )
}

/**
 * Large centered statement whose words rise into place while scrolling.
 */
export function Statement() {
  const { t } = useTranslation()
  const ref = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 0.9', 'start 0.35'],
  })

  const words: { id: number; serif: boolean; text: string }[] = []
  const phrases = [t('Supported models.'), t('One gateway.'), t('Clear usage.')]
  phrases.forEach((phrase, phraseIndex) => {
    phrase
      .split(' ')
      .filter(Boolean)
      .forEach((word) => {
        words.push({
          id: words.length,
          serif: phraseIndex === 1,
          text: word,
        })
      })
  })

  return (
    <section
      ref={ref}
      className='bg-background relative z-10 flex min-h-[40svh] items-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8'
    >
      <div className='mx-auto max-w-[62rem] text-center'>
        <p className='text-[clamp(2rem,5vw,4.25rem)] leading-[1.2] font-semibold tracking-[-0.02em] text-balance'>
          {words.map((word, index) => {
            const start = (index / words.length) * 0.8
            return (
              <Fragment key={word.id}>
                <RevealWord
                  progress={scrollYProgress}
                  range={[start, Math.min(start + 0.2, 1)]}
                  className={word.serif ? 'font-serif' : undefined}
                >
                  {word.text}
                </RevealWord>
                {index < words.length - 1 ? ' ' : null}
              </Fragment>
            )
          })}
        </p>
      </div>
    </section>
  )
}
