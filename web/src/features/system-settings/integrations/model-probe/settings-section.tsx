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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
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
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { getServerErrorMessage } from '@/lib/server-error-message'

import {
  SettingsForm,
  SettingsSwitchContent,
  SettingsSwitchItem,
} from '../../components/settings-form-layout'
import { SettingsPageFormActions } from '../../components/settings-page-context'
import { SettingsSection } from '../../components/settings-section'
import { useResetForm } from '../../hooks/use-reset-form'
import { safeNumberFieldProps } from '../../utils/numeric-field'
import {
  getModelProbeCandidates,
  reevaluateModelProbes,
  saveModelProbeSettings,
} from './api'
import {
  createModelProbeSchema,
  modelProbeFormDefaults,
  serializeModelProbeSettings,
  storedProbeTargetSchema,
  type ModelProbeFormValues,
} from './schema'
import { ModelProbeTargetEditor } from './target-editor'
import type { ModelProbeSettings, ModelProbeTarget } from './types'

export function ModelProbeSettingsSection(props: {
  defaultValues: ModelProbeSettings
}) {
  const { t } = useTranslation()
  let targets: ModelProbeTarget[]
  try {
    targets = z
      .array(storedProbeTargetSchema)
      .parse(JSON.parse(props.defaultValues['model_probe_setting.targets']))
  } catch {
    return (
      <ErrorState
        title={t('Invalid saved probe targets')}
        description={t(
          'The saved probe targets could not be read. Correct the configuration before saving to avoid losing existing targets.'
        )}
      />
    )
  }
  return (
    <ModelProbeSettingsForm
      defaultValues={modelProbeFormDefaults(props.defaultValues, targets)}
    />
  )
}

function ModelProbeSettingsForm(props: {
  defaultValues: ModelProbeFormValues
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const queryClient = useQueryClient()
  const [confirmReevaluation, setConfirmReevaluation] = useState(false)
  const form = useForm<ModelProbeFormValues>({
    resolver: zodResolver(createModelProbeSchema(t)),
    defaultValues: props.defaultValues,
  })
  useResetForm(form, props.defaultValues)
  const candidates = useQuery({
    queryKey: ['model-probe-candidates'],
    queryFn: getModelProbeCandidates,
    meta: { errorToast: false },
  })
  const save = useMutation({
    mutationFn: saveModelProbeSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['system-options'] })
      void queryClient.invalidateQueries({ queryKey: ['status'] })
      void queryClient.invalidateQueries({ queryKey: ['model-probe-overview'] })
      try {
        window.localStorage.removeItem('status')
      } catch {
        /* Storage can be unavailable. */
      }
      toast.success(t('Setting updated successfully'))
    },
    onError: (error) => handleServerError(error, t('Failed to update setting')),
  })
  const reevaluate = useMutation({
    mutationFn: reevaluateModelProbes,
    onSuccess: (result) => {
      setConfirmReevaluation(false)
      void queryClient.invalidateQueries({ queryKey: ['model-probe-overview'] })
      toast.success(
        t('Re-evaluation complete: {{scanned}} checked, {{changed}} changed', {
          scanned: formatNumber(result.scanned, locale),
          changed: formatNumber(result.changed, locale),
        })
      )
    },
    onError: (error) => handleServerError(error),
  })
  const onSubmit = form.handleSubmit(async (values) => {
    if (!candidates.data) return
    let valid = true
    for (const [index, target] of values.targets.entries()) {
      if (!values.enabled || !target.enabled) continue
      if (
        !candidates.data.tokens.some(
          (token) =>
            token.id === target.token_id &&
            token.user_id === values.probe_user_id &&
            token.group === target.group
        )
      ) {
        form.setError(`targets.${index}.token_id`, {
          message: t(
            'Select an API token belonging to the probe account and target group'
          ),
        })
        valid = false
      }
    }
    if (!valid) return
    try {
      await save.mutateAsync(serializeModelProbeSettings(values))
      form.reset(values)
    } catch {
      /* The mutation reports the error and preserves unsaved values. */
    }
  })
  const busy = save.isPending || reevaluate.isPending
  const disabled = busy || !candidates.data || candidates.isError

  return (
    <SettingsSection title={t('Intelligence monitoring')}>
      <Form {...form}>
        <SettingsForm onSubmit={onSubmit}>
          <SettingsPageFormActions
            onSave={onSubmit}
            isSaving={save.isPending}
            isSaveDisabled={disabled || !form.formState.isDirty}
          />
          <p className='text-muted-foreground text-sm'>
            {t(
              'Probes use the selected account and API tokens through normal routing and billing. Configure targets before enabling scheduled probes.'
            )}
          </p>
          {candidates.isPending && (
            <LoadingState message={t('Loading probe accounts and tokens...')} />
          )}
          {candidates.isError && (
            <ErrorState
              description={getServerErrorMessage(candidates.error)}
              onRetry={() => void candidates.refetch()}
            />
          )}
          <fieldset disabled={disabled} className='min-w-0 space-y-6'>
            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='enabled'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>
                        {t('Enable intelligence monitoring')}
                      </FormLabel>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
              <FormField
                control={form.control}
                name='public_access'
                render={({ field }) => (
                  <SettingsSwitchItem>
                    <SettingsSwitchContent>
                      <FormLabel>{t('Allow public probe results')}</FormLabel>
                      <FormDescription>
                        {t(
                          'Publish probe summaries and generated outputs without requiring sign-in.'
                        )}
                      </FormDescription>
                    </SettingsSwitchContent>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={disabled}
                      />
                    </FormControl>
                  </SettingsSwitchItem>
                )}
              />
              {(
                [
                  {
                    name: 'interval_minutes',
                    label: t('Probe interval (minutes)'),
                    min: 5,
                    max: 1440,
                  },
                  {
                    name: 'timeout_seconds',
                    label: t('Probe timeout (seconds)'),
                    min: 30,
                    max: 1800,
                  },
                  {
                    name: 'max_attempts',
                    label: t('Maximum probe attempts'),
                    min: 1,
                    max: 5,
                  },
                  {
                    name: 'retention_days',
                    label: t('Retention days'),
                    min: 0,
                    max: 365,
                  },
                ] as const
              ).map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{item.label}</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={item.min}
                          max={item.max}
                          step={1}
                          {...safeNumberFieldProps(field)}
                        />
                      </FormControl>
                      {item.name === 'retention_days' && (
                        <FormDescription>
                          {t('0 means data is kept permanently')}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name='probe_user_id'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Probe account')}</FormLabel>
                  <FormControl>
                    <Combobox
                      options={(candidates.data?.users ?? []).map((user) => ({
                        value: String(user.id),
                        label: user.display_name
                          ? `${user.display_name} (${user.username})`
                          : user.username,
                      }))}
                      value={field.value > 0 ? String(field.value) : ''}
                      onValueChange={(value) => {
                        field.onChange(Number(value))
                        for (const [index] of form
                          .getValues('targets')
                          .entries()) {
                          form.setValue(`targets.${index}.token_id`, 0, {
                            shouldDirty: true,
                          })
                        }
                      }}
                      disabled={disabled}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Only existing tokens owned by this account and matching the target group can be selected.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            {candidates.data && (
              <ModelProbeTargetEditor
                candidates={candidates.data}
                disabled={disabled}
              />
            )}
            <div className='space-y-4'>
              <h4 className='font-medium'>{t('Probe prompts')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Leave prompts and User-Agent empty to use the built-in defaults shown below.'
                )}
              </p>
              {(
                [
                  { name: 'math_prompt', label: t('Logic question prompt') },
                  { name: 'drawing_prompt', label: t('Drawing prompt') },
                  {
                    name: 'instructions',
                    label: t('Probe system instructions'),
                  },
                ] as const
              ).map((item) => (
                <FormField
                  key={item.name}
                  control={form.control}
                  name={item.name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{item.label}</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          rows={4}
                          placeholder={candidates.data?.defaults[item.name]}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
              <FormField
                control={form.control}
                name='math_answer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Expected logic answer')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='user_agent'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User-Agent</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={candidates.data?.defaults.user_agent}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>
          {save.isError && (
            <p role='alert' className='text-destructive text-sm'>
              {getServerErrorMessage(save.error)}
            </p>
          )}
          <div className='space-y-2 border-t pt-4'>
            <Button
              type='button'
              variant='outline'
              disabled={busy || form.formState.isDirty}
              onClick={() => setConfirmReevaluation(true)}
            >
              {t('Re-evaluate logic results from the last 7 days')}
            </Button>
            <p className='text-muted-foreground text-xs'>
              {t(
                'Re-evaluation uses saved outputs and the saved expected answer. Save your settings first; no new model requests are sent.'
              )}
            </p>
          </div>
        </SettingsForm>
      </Form>
      <ConfirmDialog
        open={confirmReevaluation}
        onOpenChange={(open) => {
          if (!reevaluate.isPending) setConfirmReevaluation(open)
        }}
        title={t('Re-evaluate logic results')}
        desc={t(
          'Recalculate logic results from the last 7 days using the saved expected answer? Historical verdicts may change.'
        )}
        confirmText={t('Re-evaluate')}
        isLoading={reevaluate.isPending}
        handleConfirm={() => reevaluate.mutate()}
      />
    </SettingsSection>
  )
}
