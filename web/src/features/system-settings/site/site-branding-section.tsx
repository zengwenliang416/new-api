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
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { normalizeBrandId } from '@/lib/brands'

import { FormDirtyIndicator } from '../components/form-dirty-indicator'
import { FormNavigationGuard } from '../components/form-navigation-guard'
import {
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useSettingsForm } from '../hooks/use-settings-form'
import { useUpdateOption } from '../hooks/use-update-option'

const SITE_BRAND_OPTIONS = ['motioncover', 'new-api', 'shuai', 'hlool'] as const

const BRAND_OPTION_LABELS: Record<string, string> = {
  motioncover: 'MotionCover AI',
  'new-api': 'New API',
  shuai: 'SHUAI API',
  hlool: 'Hlool API',
}

const isValidAssetTarget = (value: string) =>
  value === '' ||
  value.startsWith('/') ||
  z.string().url().safeParse(value).success

const isEmptyOrReportsJson = (value: string) => {
  if (value.trim() === '') return true
  try {
    return Array.isArray(JSON.parse(value))
  } catch {
    return false
  }
}

type SiteBrandingFormValues = {
  SiteBrand: string
  LogoLight: string
  LogoDark: string
  Favicon: string
  HomeHeroTitle: string
  HomeHeroPoweredBy: string
  HomeHeroBadgeMotionLight: string
  HomeHeroBadgeMotionDark: string
  HomeHeroVideoUrl: string
  HomeHeroVideoTitle: string
  HomeHeroVideoSubtitle: string
  ThirdPartyReportsEnabled: boolean
  ThirdPartyReports: string
}

type SiteBrandingSectionProps = {
  defaultValues: SiteBrandingFormValues
}

function normalizeValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  return typeof value === 'string' ? value : String(value)
}

export function SiteBrandingSection({
  defaultValues,
}: SiteBrandingSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const normalizedDefaults: SiteBrandingFormValues = {
    SiteBrand: normalizeBrandId(defaultValues.SiteBrand),
    LogoLight: normalizeValue(defaultValues.LogoLight),
    LogoDark: normalizeValue(defaultValues.LogoDark),
    Favicon: normalizeValue(defaultValues.Favicon),
    HomeHeroTitle: normalizeValue(defaultValues.HomeHeroTitle),
    HomeHeroPoweredBy: normalizeValue(defaultValues.HomeHeroPoweredBy),
    HomeHeroBadgeMotionLight: normalizeValue(
      defaultValues.HomeHeroBadgeMotionLight
    ),
    HomeHeroBadgeMotionDark: normalizeValue(
      defaultValues.HomeHeroBadgeMotionDark
    ),
    HomeHeroVideoUrl: normalizeValue(defaultValues.HomeHeroVideoUrl),
    HomeHeroVideoTitle: normalizeValue(defaultValues.HomeHeroVideoTitle),
    HomeHeroVideoSubtitle: normalizeValue(defaultValues.HomeHeroVideoSubtitle),
    ThirdPartyReportsEnabled: Boolean(defaultValues.ThirdPartyReportsEnabled),
    ThirdPartyReports: normalizeValue(defaultValues.ThirdPartyReports),
  }

  const siteBrandingSchema = z.object({
    SiteBrand: z.string(),
    LogoLight: z.string().refine(isValidAssetTarget, {
      error: () => t('Enter a valid logo URL or path'),
    }),
    LogoDark: z.string().refine(isValidAssetTarget, {
      error: () => t('Enter a valid logo URL or path'),
    }),
    Favicon: z.string().refine(isValidAssetTarget, {
      error: () => t('Enter a valid logo URL or path'),
    }),
    HomeHeroTitle: z.string().optional(),
    HomeHeroPoweredBy: z.string().optional(),
    HomeHeroBadgeMotionLight: z.string().refine(isValidAssetTarget, {
      error: () => t('Enter a valid logo URL or path'),
    }),
    HomeHeroBadgeMotionDark: z.string().refine(isValidAssetTarget, {
      error: () => t('Enter a valid logo URL or path'),
    }),
    HomeHeroVideoUrl: z.string().refine(isValidAssetTarget, {
      error: () =>
        t(
          'Enter an absolute HTTP(S) URL without credentials, query parameters, or fragments'
        ),
    }),
    HomeHeroVideoTitle: z.string().optional(),
    HomeHeroVideoSubtitle: z.string().optional(),
    ThirdPartyReportsEnabled: z.boolean(),
    ThirdPartyReports: z.string().refine(isEmptyOrReportsJson, {
      error: () => t('Enter a valid JSON array of reports'),
    }),
  })

  const { form, handleSubmit, handleReset, isDirty, isSubmitting } =
    useSettingsForm<SiteBrandingFormValues>({
      resolver: zodResolver(siteBrandingSchema) as Resolver<
        SiteBrandingFormValues,
        unknown,
        SiteBrandingFormValues
      >,
      defaultValues: normalizedDefaults,
      onSubmit: async (_data, changedFields) => {
        for (const [key, value] of Object.entries(changedFields)) {
          await updateOption.mutateAsync({
            key,
            value: typeof value === 'boolean' ? value : normalizeValue(value),
          })
        }
      },
    })

  return (
    <>
      <FormNavigationGuard when={isDirty} />

      <SettingsSection title={t('Site & Branding')}>
        <Form {...form}>
          <SettingsForm onSubmit={handleSubmit}>
            <SettingsPageFormActions
              onSave={handleSubmit}
              onReset={handleReset}
              isSaving={isSubmitting || updateOption.isPending}
              isResetDisabled={!isDirty}
            />
            <FormDirtyIndicator isDirty={isDirty} />
            <SettingsFormGrid>
              <FormField
                control={form.control}
                name='SiteBrand'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Brand')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SITE_BRAND_OPTIONS.map((brand) => (
                          <SelectItem key={brand} value={brand}>
                            {BRAND_OPTION_LABELS[brand]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'The page uses the active brand, logo, and system name by default.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='LogoLight'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Light logo URL')}</FormLabel>
                    <FormControl>
                      <Input placeholder='/images/logo-light.svg' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Logo used in light theme. Leave empty to use the built-in logo.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='LogoDark'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Dark logo URL')}</FormLabel>
                    <FormControl>
                      <Input placeholder='/images/logo-dark.svg' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Logo used in dark theme. Leave empty to use the built-in logo.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='Favicon'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Favicon')}</FormLabel>
                    <FormControl>
                      <Input placeholder='/images/favicon.ico' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Icon shown in the browser tab. Leave empty to use the built-in favicon.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroTitle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero title')}</FormLabel>
                    <FormControl>
                      <Input placeholder='New API' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t('Leave empty to follow the current brand name.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroPoweredBy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero powered by')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='Powered by {{systemName}}'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroBadgeMotionLight'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero badge (light)')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='/images/badge-light.webm'
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Animated badge asset used next to the hero title in light theme.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroBadgeMotionDark'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero badge (dark)')}</FormLabel>
                    <FormControl>
                      <Input placeholder='/images/badge-dark.webm' {...field} />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Animated badge asset used next to the hero title in dark theme.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroVideoUrl'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero video URL')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='https://example.com/hero.mp4'
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroVideoTitle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero video title')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='HomeHeroVideoSubtitle'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Home hero video subtitle')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='ThirdPartyReportsEnabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Third-party Reports')}</FormLabel>
                      <FormDescription>
                        {t('Show third-party report links on the home page')}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />

              <FormField
                control={form.control}
                name='ThirdPartyReports'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Third-party report list (JSON)')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='[{"provider":"MODELOC","title":"Claude report","url":"https://modeloc.com/relay/example","status":"verified","enabled":true,"sort":10}]'
                        rows={6}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Configure third-party report links shown on the home page'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsFormGrid>
          </SettingsForm>
        </Form>
      </SettingsSection>
    </>
  )
}
