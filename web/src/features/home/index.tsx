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
import { useQuery } from '@tanstack/react-query'
import Lenis from 'lenis'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/error-state'
import { PublicLayout } from '@/components/layout'
import { Footer } from '@/components/layout/components/footer'
import { LoadingState } from '@/components/loading-state'
import { RichContent } from '@/components/rich-content'
import { useTheme } from '@/context/theme-provider'
import { isLikelyHtml } from '@/lib/content-format'
import { statusQueryOptions } from '@/lib/status-query'
import { useAuthStore } from '@/stores/auth-store'

import {
  BoundariesSection,
  BrandReveal,
  CtaSection,
  HeroSection,
  RequestFlowSection,
  RulesSection,
  Statement,
} from './components/portal'
import { useHomePageContent } from './hooks'

let entryAnimationPlayed = false

function isLandingEntryAnimationEligible(): boolean {
  if (typeof window === 'undefined') return false
  let pathname: string
  try {
    const navigation = window.performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    pathname = new URL(navigation?.name || window.location.href).pathname
  } catch {
    pathname = window.location.pathname
  }
  return pathname.replace(/\/+$/, '') === '' && !entryAnimationPlayed
}

export function Home() {
  const { i18n, t } = useTranslation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const { resolvedTheme } = useTheme()
  const { auth } = useAuthStore()
  const isAuthenticated = !!auth.user
  const { content, isUrl, isLoaded } = useHomePageContent()
  const statusQuery = useQuery(statusQueryOptions)
  const loading = !isLoaded || statusQuery.isPending

  const playEntryAnimation = useMemo(
    () => isLandingEntryAnimationEligible(),
    []
  )
  const [entryAnimationStarted, setEntryAnimationStarted] = useState(false)
  const handleEntryAnimationStart = useCallback(() => {
    setEntryAnimationStarted((started) => {
      if (started) return true
      entryAnimationPlayed = true
      return true
    })
  }, [])

  const syncIframePreferences = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { themeMode: resolvedTheme },
        '*'
      )
      iframeRef.current?.contentWindow?.postMessage(
        { lang: i18n.language },
        '*'
      )
    } catch {
      // Cross-origin frames may reject access while navigating.
    }
  }, [i18n.language, resolvedTheme])

  useEffect(() => {
    if (isUrl) {
      syncIframePreferences()
    }
  }, [isUrl, syncIframePreferences])

  useEffect(() => {
    document.documentElement.classList.add('home-page-scrollbar')
    return () => {
      document.documentElement.classList.remove('home-page-scrollbar')
    }
  }, [])

  useEffect(() => {
    if (
      loading ||
      content ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return
    }
    const lenis = new Lenis({ lerp: 0.11 })
    let frame = 0
    const raf = (time: number) => {
      lenis.raf(time)
      frame = window.requestAnimationFrame(raf)
    }
    frame = window.requestAnimationFrame(raf)
    return () => {
      window.cancelAnimationFrame(frame)
      lenis.destroy()
    }
  }, [content, loading])

  if (loading) {
    return (
      <PublicLayout>
        <div role='status' aria-live='polite'>
          <LoadingState />
        </div>
      </PublicLayout>
    )
  }

  if (statusQuery.isError && !content) {
    return (
      <PublicLayout>
        <ErrorState onRetry={() => void statusQuery.refetch()} />
      </PublicLayout>
    )
  }

  if (content) {
    if (isUrl) {
      return (
        <PublicLayout showMainContainer={false}>
          {/*
            allow-top-navigation-by-user-activation: the custom home page URL is
            admin-configured (trusted); this lets its target="_top" nav/menu links
            navigate the top-level window on user click. The default sandbox blocks
            this on desktop, while some mobile browsers allow it via allow-popups,
            causing inconsistent behavior. This token only permits user-activated
            top-level navigation and does NOT grant same-origin access.
          */}
          <main className='overflow-x-hidden'>
            <iframe
              ref={iframeRef}
              src={content}
              className='h-screen w-full border-none'
              title={t('Custom Home Page')}
              sandbox='allow-forms allow-popups allow-popups-to-escape-sandbox allow-scripts allow-top-navigation-by-user-activation'
              onLoad={syncIframePreferences}
            />
          </main>
        </PublicLayout>
      )
    }

    const contentIsHtml = isLikelyHtml(content)

    if (contentIsHtml) {
      return (
        <PublicLayout showMainContainer={false}>
          <RichContent
            mode='html'
            htmlVariant='isolated'
            content={content}
            className='custom-home-content'
          />
        </PublicLayout>
      )
    }

    return (
      <PublicLayout>
        <div className='mx-auto max-w-6xl px-4 py-8'>
          <RichContent
            mode='markdown'
            content={content}
            className='custom-home-content'
          />
        </div>
      </PublicLayout>
    )
  }

  return (
    <PublicLayout showMainContainer={false}>
      <main data-home-page='true' className='relative overflow-x-clip'>
        <div className='bg-background relative z-10'>
          <HeroSection
            playEntryAnimation={playEntryAnimation}
            entryAnimationStarted={entryAnimationStarted}
            onEntryAnimationStart={handleEntryAnimationStart}
            isAuthenticated={isAuthenticated}
          />
          <RulesSection />
          <BoundariesSection />
          <Statement />
          <RequestFlowSection />
          <CtaSection isAuthenticated={isAuthenticated} />
          <Footer />
        </div>
        <BrandReveal />
      </main>
    </PublicLayout>
  )
}
