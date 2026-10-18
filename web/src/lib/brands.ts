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
import { DEFAULT_LOGO, DEFAULT_SYSTEM_NAME } from '@/lib/constants'

export type BrandId = 'motioncover' | 'new-api' | 'hlool' | 'shuai'

export interface BrandDefinition {
  id: BrandId
  systemName: string
  zhSystemName?: string
  logo: string
  logoLight: string
  logoDark: string
  favicon: string
  faviconDark?: string
  motionBadgeLight?: string
  motionBadgeDark?: string
  /** Wordmark drawn by the brand reveal canvas. */
  revealLabel: string
  /** Canvas fallback background when CSS variables are unavailable. */
  revealBackground: string
}

/** Animated badge assets available for explicitly selected operating brands. */
export const DEFAULT_MOTION_BADGE_LIGHT = '/images/logo-motion-light.webp'
export const DEFAULT_MOTION_BADGE_DARK = '/images/logo-motion-dark.webp'

export const BRANDS: Record<BrandId, BrandDefinition> = {
  motioncover: {
    id: 'motioncover',
    systemName: 'MotionCover AI',
    logo: '/branding/motioncover-logo-light-20260824.png',
    logoLight: '/branding/motioncover-logo-light-20260824.png',
    logoDark: '/branding/motioncover-logo-20260824.png',
    favicon: '/branding/motioncover-favicon-light-20260824.ico',
    faviconDark: '/branding/motioncover-favicon-20260824.ico',
    revealLabel: 'MOTIONCOVER AI',
    revealBackground: '#071a3d',
  },
  'new-api': {
    id: 'new-api',
    systemName: DEFAULT_SYSTEM_NAME,
    logo: DEFAULT_LOGO,
    logoLight: DEFAULT_LOGO,
    logoDark: DEFAULT_LOGO,
    favicon: '/favicon.ico',
    revealLabel: DEFAULT_SYSTEM_NAME,
    revealBackground: '#2563eb',
  },
  hlool: {
    id: 'hlool',
    systemName: 'Hlool API',
    logo: '/images/logo.svg',
    logoLight: '/images/logo-light.svg',
    logoDark: '/images/logo-dark.svg',
    favicon: '/images/favicon.ico',
    motionBadgeLight: DEFAULT_MOTION_BADGE_LIGHT,
    motionBadgeDark: DEFAULT_MOTION_BADGE_DARK,
    revealLabel: 'HLOOL API',
    revealBackground: '#2563eb',
  },
  shuai: {
    id: 'shuai',
    systemName: 'SHUAI API',
    zhSystemName: '帅API',
    logo: '/images/logo.svg',
    logoLight: '/images/logo-light.svg',
    logoDark: '/images/logo-dark.svg',
    favicon: '/images/favicon.ico',
    motionBadgeLight: DEFAULT_MOTION_BADGE_LIGHT,
    motionBadgeDark: DEFAULT_MOTION_BADGE_DARK,
    revealLabel: 'SHUAI API',
    revealBackground: '#071a3d',
  },
}

export const DEFAULT_BRAND_ID: BrandId = 'motioncover'

export const DEFAULT_BRAND: BrandDefinition = BRANDS[DEFAULT_BRAND_ID]

/** Resolve an admin-configured `SiteBrand` value to a known brand id. */
export function normalizeBrandId(value: string | undefined | null): BrandId {
  if (typeof value !== 'string') return DEFAULT_BRAND_ID
  const normalized = value.trim().toLowerCase()
  return normalized === 'motioncover' ||
    normalized === 'shuai' ||
    normalized === 'hlool' ||
    normalized === 'new-api'
    ? normalized
    : DEFAULT_BRAND_ID
}

/** Fetch the brand definition for an admin-configured value. */
export function getBrand(value?: string | null): BrandDefinition {
  return BRANDS[normalizeBrandId(value)]
}

/** Brand display name, localized to Chinese when the language is Chinese. */
export function getBrandSystemName(
  brandValue: string | undefined | null,
  language?: string
): string {
  const brand = getBrand(brandValue)
  return language?.toLowerCase().startsWith('zh') && brand.zhSystemName
    ? brand.zhSystemName
    : brand.systemName
}

/** Whether a system name matches a built-in brand name. */
export function isDefaultSystemName(name: string): boolean {
  if (name === 'New API' || name === 'Shuai API' || name === '帅 API') {
    return true
  }
  return Object.values(BRANDS).some(
    (brand) => name === brand.systemName || name === brand.zhSystemName
  )
}

/**
 * Resolve the effective system name.
 *
 * Custom names win. Built-in names follow the selected operating brand and
 * interface language; project attribution is rendered separately in the footer.
 */
export function resolveSystemName(
  name: string | undefined | null,
  brandValue: string | undefined | null,
  language?: string
): string {
  const fallback = getBrandSystemName(brandValue, language)
  if (typeof name !== 'string') return fallback
  const trimmed = name.trim()
  if (!trimmed || isDefaultSystemName(trimmed)) return fallback
  return trimmed
}
