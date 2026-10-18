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
import { useForm } from 'react-hook-form'
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
import { Switch } from '@/components/ui/switch'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import type { UpdateOptionRequest } from '../types'
import { safeNumberFieldProps } from '../utils/numeric-field'
import { removeTrailingSlash } from './utils'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const SUPPORT_WORKER_DEFAULT_SITE_ID = 'default'
const SUPPORT_WORKER_DEFAULT_TTL_MINUTES = 30

const createSupportWorkerSchema = (t: (key: string) => string) =>
  z.object({
    SupportWorkerUrl: z.string().superRefine((value, ctx) => {
      const trimmed = value.trim()
      if (!trimmed) return
      let url: URL
      try {
        url = new URL(trimmed)
      } catch {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'Provide a valid Support Worker URL starting with http:// or https://'
          ),
        })
        return
      }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'Provide a valid Support Worker URL starting with http:// or https://'
          ),
        })
        return
      }
      if (url.protocol === 'http:' && !LOCAL_HOSTNAMES.has(url.hostname)) {
        ctx.addIssue({
          code: 'custom',
          message: t(
            'Use https:// for Support Worker URL unless it is localhost.'
          ),
        })
      }
    }),
    SupportWorkerJwtSecret: z
      .string()
      .refine(
        (value) => value.trim() === '' || value.trim().length >= 32,
        t('Secret must be at least 32 characters.')
      ),
    SupportWorkerCallbackSecret: z
      .string()
      .refine(
        (value) => value.trim() === '' || value.trim().length >= 32,
        t('Secret must be at least 32 characters.')
      ),
    SupportWorkerSiteID: z.string().refine((value) => {
      const length = value.trim().length
      return length >= 1 && length <= 120
    }, t('Site ID must be between 1 and 120 characters.')),
    SupportWorkerSessionTTLMinutes: z.coerce
      .number()
      .int(t('Session TTL must be between 5 and 240 minutes.'))
      .min(5, t('Session TTL must be between 5 and 240 minutes.'))
      .max(240, t('Session TTL must be between 5 and 240 minutes.')),
    SupportWorkerTranslationEnabled: z.boolean(),
  })

type SupportWorkerFormInput = z.input<
  ReturnType<typeof createSupportWorkerSchema>
>
type SupportWorkerFormValues = z.output<
  ReturnType<typeof createSupportWorkerSchema>
>

type SupportWorkerSettingsSectionProps = {
  defaultValues: {
    SupportWorkerUrl: string
    SupportWorkerJwtSecret: string
    SupportWorkerCallbackSecret: string
    SupportWorkerSiteID: string
    SupportWorkerSessionTTLMinutes: number
    SupportWorkerTranslationEnabled?: boolean
  }
}

/**
 * Support Worker integration settings: worker URL, session/callback secrets,
 * site identifier, session lifetime, and optional ticket translation.
 */
export function SupportWorkerSettingsSection(
  props: SupportWorkerSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const schema = createSupportWorkerSchema(t)

  const form = useForm<
    SupportWorkerFormInput,
    unknown,
    SupportWorkerFormValues
  >({
    resolver: zodResolver(schema),
    defaultValues: {
      SupportWorkerUrl: props.defaultValues.SupportWorkerUrl ?? '',
      SupportWorkerJwtSecret: '',
      SupportWorkerCallbackSecret: '',
      SupportWorkerSiteID:
        props.defaultValues.SupportWorkerSiteID ||
        SUPPORT_WORKER_DEFAULT_SITE_ID,
      SupportWorkerSessionTTLMinutes:
        props.defaultValues.SupportWorkerSessionTTLMinutes ||
        SUPPORT_WORKER_DEFAULT_TTL_MINUTES,
      SupportWorkerTranslationEnabled:
        props.defaultValues.SupportWorkerTranslationEnabled ?? false,
    },
  })

  useResetForm(form, {
    SupportWorkerUrl: props.defaultValues.SupportWorkerUrl ?? '',
    SupportWorkerJwtSecret: '',
    SupportWorkerCallbackSecret: '',
    SupportWorkerSiteID:
      props.defaultValues.SupportWorkerSiteID || SUPPORT_WORKER_DEFAULT_SITE_ID,
    SupportWorkerSessionTTLMinutes:
      props.defaultValues.SupportWorkerSessionTTLMinutes ||
      SUPPORT_WORKER_DEFAULT_TTL_MINUTES,
    SupportWorkerTranslationEnabled:
      props.defaultValues.SupportWorkerTranslationEnabled ?? false,
  })

  const onSubmit = async (values: SupportWorkerFormValues) => {
    const initialUrl = removeTrailingSlash(
      props.defaultValues.SupportWorkerUrl ?? ''
    )
    const url = removeTrailingSlash(values.SupportWorkerUrl)
    const jwtSecret = values.SupportWorkerJwtSecret.trim()
    const callbackSecret = values.SupportWorkerCallbackSecret.trim()
    const siteID = values.SupportWorkerSiteID.trim()
    const initialSiteID =
      props.defaultValues.SupportWorkerSiteID || SUPPORT_WORKER_DEFAULT_SITE_ID
    const initialTTL =
      props.defaultValues.SupportWorkerSessionTTLMinutes ||
      SUPPORT_WORKER_DEFAULT_TTL_MINUTES

    const updates: UpdateOptionRequest[] = []

    if (url !== initialUrl) {
      updates.push({ key: 'SupportWorkerUrl', value: url })
    }
    if (jwtSecret !== '') {
      updates.push({ key: 'SupportWorkerJwtSecret', value: jwtSecret })
    }
    if (callbackSecret !== '') {
      updates.push({
        key: 'SupportWorkerCallbackSecret',
        value: callbackSecret,
      })
    }
    if (siteID !== initialSiteID) {
      updates.push({ key: 'SupportWorkerSiteID', value: siteID })
    }
    if (values.SupportWorkerSessionTTLMinutes !== initialTTL) {
      updates.push({
        key: 'SupportWorkerSessionTTLMinutes',
        value: values.SupportWorkerSessionTTLMinutes,
      })
    }
    if (
      values.SupportWorkerTranslationEnabled !==
      (props.defaultValues.SupportWorkerTranslationEnabled ?? false)
    ) {
      updates.push({
        key: 'SupportWorkerTranslationEnabled',
        value: values.SupportWorkerTranslationEnabled,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection title={t('Support Worker')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)} autoComplete='off'>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
            saveLabel='Save Support Worker settings'
          />
          <FormField
            control={form.control}
            name='SupportWorkerUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Support Worker URL')}</FormLabel>
                <FormControl>
                  <Input
                    type='url'
                    inputMode='url'
                    placeholder={t('https://support.example.com')}
                    autoComplete='off'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Base URL of the deployed support worker. Trailing slashes are removed automatically.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SupportWorkerJwtSecret'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Session JWT secret')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Enter new secret to update')}
                    autoComplete='new-password'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Shared secret used to sign support session tokens. Leave blank to keep the existing secret.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SupportWorkerCallbackSecret'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Callback secret')}</FormLabel>
                <FormControl>
                  <Input
                    type='password'
                    placeholder={t('Enter new secret to update')}
                    autoComplete='new-password'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Shared secret used to authenticate worker callbacks. Leave blank to keep the existing secret.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SupportWorkerSiteID'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Site ID')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={SUPPORT_WORKER_DEFAULT_SITE_ID}
                    autoComplete='off'
                    {...field}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                </FormControl>
                <FormDescription>
                  {t(
                    'Identifier reported to the support worker for this site.'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SupportWorkerSessionTTLMinutes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Session TTL (minutes)')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={5}
                    max={240}
                    step={1}
                    {...safeNumberFieldProps(field)}
                  />
                </FormControl>
                <FormDescription>
                  {t('Support session token validity period.')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='SupportWorkerTranslationEnabled'
            render={({ field }) => (
              <SettingsSwitchItem>
                <SettingsSwitchContent>
                  <FormLabel>{t('Enable ticket translation')}</FormLabel>
                  <FormDescription>
                    {t(
                      'Enable only after a translation provider has been configured for the Support Worker.'
                    )}
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
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
