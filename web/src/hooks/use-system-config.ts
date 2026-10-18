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
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { getBrand, normalizeBrandId, resolveSystemName } from '@/lib/brands'
import { DEFAULT_LOGO } from '@/lib/constants'
import { applyFaviconToDom } from '@/lib/dom-utils'
import { ensureStatus } from '@/lib/status-query'
import { useSystemConfigStore } from '@/stores/system-config-store'

interface UseSystemConfigOptions {
  /** Automatically fetch config from backend (use only in root component) */
  autoLoad?: boolean
}

/** Preload an image, returning a cleanup that detaches the pending handlers. */
function preloadImage(
  src: string,
  onLoad: () => void,
  onError: () => void
): () => void {
  const img = new Image()
  img.addEventListener('load', onLoad)
  img.addEventListener('error', onError)
  img.src = src

  return () => {
    img.removeEventListener('load', onLoad)
    img.removeEventListener('error', onError)
  }
}

/**
 * System configuration hook with auto-loading and logo preloading
 *
 * @example
 * // Root component - auto-load from backend
 * useSystemConfig({ autoLoad: true })
 *
 * @example
 * // Other components - use cached config
 * const { systemName, logo, loading } = useSystemConfig()
 */
export function useSystemConfig(options: UseSystemConfigOptions = {}) {
  const { autoLoad = false } = options
  const queryClient = useQueryClient()
  const { config, loading, loadedLogoUrl, setLoadedLogoUrl, setLoading } =
    useSystemConfigStore()
  const { resolvedTheme } = useTheme()
  const { i18n } = useTranslation()

  // Load config from backend via the shared `/api/status` cache.
  // `ensureStatus` writes the mapped config into this store itself, so there is
  // no second request and no second mapping path here.
  const loadConfig = useCallback(async () => {
    try {
      setLoading(true)
      await ensureStatus(queryClient)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to load system config:', error)
    } finally {
      setLoading(false)
    }
  }, [queryClient, setLoading])

  useEffect(() => {
    if (autoLoad) loadConfig()
  }, [autoLoad, loadConfig])

  const siteBrand = normalizeBrandId(config.siteBrand)
  const brand = getBrand(siteBrand)
  const logoLight = config.logoLight || config.logo || brand.logoLight
  const logoDark = config.logoDark || config.logo || brand.logoDark
  const logo = resolvedTheme === 'dark' ? logoDark : logoLight
  const themeFavicon =
    resolvedTheme === 'dark'
      ? brand.faviconDark || brand.favicon
      : brand.favicon
  const favicon =
    !config.favicon || config.favicon === brand.favicon
      ? themeFavicon
      : config.favicon

  // Preload the theme-resolved logo image when its URL changes
  useEffect(() => {
    if (!logo || logo === loadedLogoUrl) return

    return preloadImage(
      logo,
      () => {
        setLoadedLogoUrl(logo)
      },
      () => {
        if (logo !== DEFAULT_LOGO) {
          // eslint-disable-next-line no-console
          console.error('Failed to load logo:', logo)
        }
        // Mark as loaded even on error to prevent infinite retry
        setLoadedLogoUrl(logo)
      }
    )
  }, [logo, loadedLogoUrl, setLoadedLogoUrl])

  useEffect(() => {
    applyFaviconToDom(favicon)
  }, [favicon])

  return {
    ...config,
    siteBrand,
    systemName: resolveSystemName(config.systemName, siteBrand, i18n.language),
    logo,
    logoLight,
    logoDark,
    favicon,
    loading,
    logoLoaded: logo === loadedLogoUrl && !!loadedLogoUrl,
  }
}
