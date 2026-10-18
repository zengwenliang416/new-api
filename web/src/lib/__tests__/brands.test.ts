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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import { createElement, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { ThemeProvider, useTheme } from '@/context/theme-provider'
import { useSystemConfig } from '@/hooks/use-system-config'
import {
  BRANDS,
  getBrandSystemName,
  isDefaultSystemName,
  normalizeBrandId,
  resolveSystemName,
} from '@/lib/brands'
import { mapStatusDataToConfig } from '@/lib/status-query'
import { useSystemConfigStore } from '@/stores/system-config-store'

describe('normalizeBrandId', () => {
  test.each([
    [undefined, 'motioncover'],
    [null, 'motioncover'],
    ['', 'motioncover'],
    ['motioncover', 'motioncover'],
    ['  MOTIONCOVER ', 'motioncover'],
    ['new-api', 'new-api'],
    ['hlool', 'hlool'],
    ['shuai', 'shuai'],
    ['  SHUAI ', 'shuai'],
    ['unknown-brand', 'motioncover'],
  ])('normalizes %o to %s', (input, expected) => {
    expect(normalizeBrandId(input)).toBe(expected)
  })
})

describe('resolveSystemName', () => {
  test('keeps a custom admin name for every brand', () => {
    expect(resolveSystemName('Acme Relay', 'motioncover')).toBe('Acme Relay')
    expect(resolveSystemName('Acme Relay', 'shuai')).toBe('Acme Relay')
    expect(resolveSystemName('Acme Relay', 'hlool', 'zhCN')).toBe('Acme Relay')
  })

  test('falls back to the selected brand when the name is empty', () => {
    expect(resolveSystemName('', 'shuai')).toBe('SHUAI API')
    expect(resolveSystemName(undefined, 'shuai')).toBe('SHUAI API')
    expect(resolveSystemName(undefined, undefined)).toBe('MotionCover AI')
  })

  test('resolves built-in names to the chosen operating brand', () => {
    expect(resolveSystemName('New API', 'shuai', 'zhCN')).toBe('帅API')
    expect(resolveSystemName('Hlool API', 'shuai', 'en')).toBe('SHUAI API')
    expect(resolveSystemName('SHUAI API', 'new-api')).toBe('New API')
    expect(resolveSystemName('New API', 'new-api')).toBe('New API')
    expect(resolveSystemName('New API', 'motioncover', 'zhCN')).toBe(
      'MotionCover AI'
    )
  })

  test('localizes the selected operating brand for built-in and empty names', () => {
    expect(resolveSystemName('', 'shuai', 'zhCN')).toBe('帅API')
    expect(getBrandSystemName('shuai', 'zh-TW')).toBe('帅API')
    expect(resolveSystemName('New API', 'shuai', 'en')).toBe('SHUAI API')
  })

  test('recognizes built-in names as defaults', () => {
    expect(isDefaultSystemName('Shuai API')).toBe(true)
    expect(isDefaultSystemName('帅 API')).toBe(true)
    expect(isDefaultSystemName('Hlool API')).toBe(true)
    expect(isDefaultSystemName('Acme Relay')).toBe(false)
  })
})

describe('mapStatusDataToConfig brand fields', () => {
  test('uses the deployment brand and static assets when a payload has no brand selection', () => {
    expect(mapStatusDataToConfig({ system_name: 'New API' })).toMatchObject({
      siteBrand: 'motioncover',
      systemName: 'MotionCover AI',
      logo: '/branding/motioncover-logo-light-20260824.png',
      logoLight: '/branding/motioncover-logo-light-20260824.png',
      logoDark: '/branding/motioncover-logo-20260824.png',
      favicon: '/branding/motioncover-favicon-light-20260824.ico',
    })
    expect(mapStatusDataToConfig({}).homeHeroBadgeMotionLight).toBe('')
    expect(mapStatusDataToConfig({}).homeHeroBadgeMotionDark).toBe('')
  })

  test.each([
    'https://new-api.motion-cover.com/branding/motioncover-logo-light-20260824.png',
    '/branding/motioncover-logo-light-20260824.png',
  ])(
    'pairs the known legacy deployment logo %s with the local dark asset',
    (logo) => {
      expect(
        mapStatusDataToConfig({ system_name: 'MotionCover AI', logo })
      ).toMatchObject({
        siteBrand: 'motioncover',
        systemName: 'MotionCover AI',
        logo: '/branding/motioncover-logo-light-20260824.png',
        logoLight: '/branding/motioncover-logo-light-20260824.png',
        logoDark: '/branding/motioncover-logo-20260824.png',
        homeHeroBadgeMotionLight: '',
        homeHeroBadgeMotionDark: '',
      })
    }
  )

  test('preserves the original New API assets when explicitly selected', () => {
    expect(
      mapStatusDataToConfig({ site_brand: 'new-api', system_name: 'New API' })
    ).toMatchObject({
      siteBrand: 'new-api',
      systemName: 'New API',
      logo: '/logo.png',
      logoLight: '/logo.png',
      logoDark: '/logo.png',
      favicon: '/favicon.ico',
      homeHeroBadgeMotionLight: '',
      homeHeroBadgeMotionDark: '',
    })
  })

  test('does not reinterpret the deployment logo under another explicit preset', () => {
    const logo =
      'https://new-api.motion-cover.com/branding/motioncover-logo-light-20260824.png'
    const config = mapStatusDataToConfig({ site_brand: 'new-api', logo })
    expect(config.logoLight).toBe(logo)
    expect(config.logoDark).toBe(logo)
  })

  test('applies brand-aware defaults when branding fields are empty', () => {
    const config = mapStatusDataToConfig({
      system_name: '',
      site_brand: 'shuai',
    })

    expect(config.siteBrand).toBe('shuai')
    expect(config.systemName).toBe('SHUAI API')
    expect(config.logo).toBe(BRANDS.shuai.logoLight)
    expect(config.logoLight).toBe(BRANDS.shuai.logoLight)
    expect(config.logoDark).toBe(BRANDS.shuai.logoDark)
    expect(config.favicon).toBe(BRANDS.shuai.favicon)
    expect(config.homeHeroBadgeMotionLight).toBe(BRANDS.shuai.motionBadgeLight)
    expect(config.homeHeroBadgeMotionDark).toBe(BRANDS.shuai.motionBadgeDark)
  })

  test.each([
    '/custom/logo.png',
    'https://cdn.example.org/branding/motioncover-logo-light-20260824.png',
  ])('keeps a custom shared logo %s unchanged for both themes', (logo) => {
    const config = mapStatusDataToConfig({
      logo,
    })

    expect(config.logo).toBe(logo)
    expect(config.logoLight).toBe(logo)
    expect(config.logoDark).toBe(logo)
  })

  test('prefers explicit light/dark logos over the shared logo', () => {
    const config = mapStatusDataToConfig({
      logo: '/custom/logo.png',
      logo_light: '/custom/light.svg',
      logo_dark: '/custom/dark.svg',
    })

    expect(config.logoLight).toBe('/custom/light.svg')
    expect(config.logoDark).toBe('/custom/dark.svg')
  })

  test('keeps administrator names, theme assets, favicon, and hero text over deployment defaults', () => {
    const config = mapStatusDataToConfig({
      site_brand: 'motioncover',
      system_name: 'Custom Workspace',
      logo: 'https://new-api.motion-cover.com/branding/motioncover-logo-light-20260824.png',
      logo_light: '/custom/light.svg',
      logo_dark: '/custom/dark.svg',
      favicon: '/custom/favicon.ico',
      home_hero_title: 'Custom title',
      home_hero_powered_by: 'Custom subtitle',
      home_hero_badge_motion_light: '/custom/light.webp',
      home_hero_badge_motion_dark: '/custom/dark.webp',
    })
    expect(config).toMatchObject({
      systemName: 'Custom Workspace',
      logoLight: '/custom/light.svg',
      logoDark: '/custom/dark.svg',
      favicon: '/custom/favicon.ico',
      homeHeroTitle: 'Custom title',
      homeHeroPoweredBy: 'Custom subtitle',
      homeHeroBadgeMotionLight: '/custom/light.webp',
      homeHeroBadgeMotionDark: '/custom/dark.webp',
    })
  })

  test('keeps raw hero text but trims badge motion URLs', () => {
    const config = mapStatusDataToConfig({
      home_hero_title: '  Keep spacing  ',
      home_hero_powered_by: ' Powered by  ',
      home_hero_badge_motion_light: '  /motion-light.webp  ',
      home_hero_badge_motion_dark: '',
    })

    expect(config.homeHeroTitle).toBe('  Keep spacing  ')
    expect(config.homeHeroPoweredBy).toBe(' Powered by  ')
    expect(config.homeHeroBadgeMotionLight).toBe('/motion-light.webp')
    expect(config.homeHeroBadgeMotionDark).toBe('')
  })
})

describe('deployment brand theme assets', () => {
  const clients: QueryClient[] = []

  beforeEach(() => {
    localStorage.clear()
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
  })

  afterEach(() => {
    cleanup()
    clients.splice(0).forEach((client) => client.clear())
    useSystemConfigStore.setState(useSystemConfigStore.getInitialState(), true)
    localStorage.clear()
    document
      .querySelectorAll('link[rel~="icon"]')
      .forEach((link) => link.remove())
    document.documentElement.classList.remove('light', 'dark')
  })

  test.each([false, true])(
    'theme switching preserves custom assets=%s and uses the paired preset otherwise',
    (custom) => {
      useSystemConfigStore.getState().setConfig(
        mapStatusDataToConfig({
          system_name: 'MotionCover AI',
          logo: 'https://new-api.motion-cover.com/branding/motioncover-logo-light-20260824.png',
          ...(custom
            ? {
                logo_light: '/custom/light.svg',
                logo_dark: '/custom/dark.svg',
                favicon: '/custom/favicon.ico',
              }
            : {}),
        })
      )
      const client = new QueryClient()
      clients.push(client)
      function Wrapper(props: PropsWithChildren) {
        return createElement(
          QueryClientProvider,
          { client },
          createElement(ThemeProvider, null, props.children)
        )
      }
      const hook = renderHook(
        () => ({ config: useSystemConfig(), theme: useTheme() }),
        { wrapper: Wrapper }
      )
      expect(hook.result.current.config.logo).toBe(
        custom
          ? '/custom/light.svg'
          : '/branding/motioncover-logo-light-20260824.png'
      )
      expect(hook.result.current.config.favicon).toBe(
        custom
          ? '/custom/favicon.ico'
          : '/branding/motioncover-favicon-light-20260824.ico'
      )
      act(() => hook.result.current.theme.setTheme('dark'))
      expect(hook.result.current.config.logo).toBe(
        custom ? '/custom/dark.svg' : '/branding/motioncover-logo-20260824.png'
      )
      expect(hook.result.current.config.favicon).toBe(
        custom
          ? '/custom/favicon.ico'
          : '/branding/motioncover-favicon-20260824.ico'
      )
      expect(document.querySelector('link[rel="icon"]')).toHaveAttribute(
        'href',
        hook.result.current.config.favicon
      )
    }
  )
})
