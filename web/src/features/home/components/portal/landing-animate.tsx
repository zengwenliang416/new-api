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
  useLayoutEffect,
  useRef,
  type ElementType,
  type PointerEventHandler,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/utils'

type LandingAnimation =
  | 'fade-up'
  | 'fade-in'
  | 'scale-in'
  | 'fade-left'
  | 'fade-right'
  | 'mask-rise'

interface LandingAnimateProps {
  as?: ElementType
  delay?: number
  threshold?: number
  animation?: LandingAnimation
  once?: boolean
  className?: string
  children?: ReactNode
  onPointerMove?: PointerEventHandler<HTMLElement>
}

/**
 * Reveals children with a CSS entrance animation when they scroll into view.
 *
 * Falls back to the final state instantly when reduced motion is requested.
 */
export function LandingAnimate(props: LandingAnimateProps) {
  const {
    as: Tag = 'div',
    delay = 0,
    threshold = 0.15,
    animation = 'fade-up',
    once = true,
  } = props
  const ref = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      element.classList.add(`landing-animate-${animation}`)
      return
    }
    element.classList.add('opacity-0')
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          element.classList.remove('opacity-0')
          element.classList.add(`landing-animate-${animation}`)
          if (once) observer.unobserve(element)
        } else if (!once) {
          element.classList.add('opacity-0')
          element.classList.remove(`landing-animate-${animation}`)
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [animation, once, threshold])

  return (
    <Tag
      ref={ref}
      className={cn(props.className)}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      onPointerMove={props.onPointerMove}
    >
      {props.children}
    </Tag>
  )
}

export type { LandingAnimateProps, LandingAnimation }
