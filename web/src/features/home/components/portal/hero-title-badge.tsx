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
import type { ReactNode } from 'react'

import { useTheme } from '@/context/theme-provider'
import { DEFAULT_BRAND } from '@/lib/brands'
import { cn } from '@/lib/utils'

import { useMotionBadge } from '../../hooks/use-motion-badge'

interface HeroTitleBadgeProps {
  logoDarkUrl?: string
  logoLightUrl?: string
  motionDarkUrl?: string
  motionLightUrl?: string
  children: ReactNode
}

/**
 * Hero title with a brand badge that plays a short animation on pointer entry.
 */
export function HeroTitleBadge(props: HeroTitleBadgeProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const logoUrl = isDark
    ? props.logoDarkUrl || DEFAULT_BRAND.logoDark
    : props.logoLightUrl || DEFAULT_BRAND.logoLight
  const motionUrl = isDark ? props.motionDarkUrl : props.motionLightUrl
  const motion = useMotionBadge({ motionUrl })

  return (
    <span
      className='inline-flex max-w-full items-center gap-[0.1em]'
      onPointerEnter={motion.startMotion}
    >
      <span className='min-w-0 [overflow-wrap:anywhere]'>{props.children}</span>
      <span
        aria-hidden='true'
        className='relative mt-[0.05em] size-[0.76em] shrink-0 overflow-hidden'
      >
        <span
          className={cn(
            'absolute inset-0 bg-contain bg-center bg-no-repeat opacity-100 transition-opacity duration-200',
            motion.staticHidden && 'opacity-0'
          )}
          style={{ backgroundImage: `url("${logoUrl}")` }}
        />
        {motion.motionVisible ? (
          <span
            key={motion.motionKey}
            className={cn(
              'pointer-events-none absolute inset-0 bg-contain bg-center bg-no-repeat opacity-100 transition-opacity duration-200',
              motion.motionFading && 'opacity-0'
            )}
            style={{ backgroundImage: `url("${motion.motionPlaybackUrl}")` }}
          />
        ) : null}
      </span>
    </span>
  )
}
