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
import { useFieldArray, useFormContext } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { MultiSelect } from '@/components/multi-select'
import { Button } from '@/components/ui/button'
import { Combobox } from '@/components/ui/combobox'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import type { ModelProbeFormValues } from './schema'
import type { ModelProbeCandidates } from './types'

type Props = { candidates: ModelProbeCandidates; disabled: boolean }

export function ModelProbeTargetEditor(props: Props) {
  const { t } = useTranslation()
  const form = useFormContext<ModelProbeFormValues>()
  const targets = useFieldArray({ control: form.control, name: 'targets' })
  const userId = form.watch('probe_user_id')
  const watchedTargets = form.watch('targets')

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h4 className='font-medium'>{t('Probe targets')}</h4>
        <Button
          type='button'
          variant='outline'
          disabled={props.disabled}
          onClick={() =>
            targets.append({
              group: '',
              model: '',
              effort: 'medium',
              kinds: ['math', 'drawing'],
              enabled: true,
              token_id: 0,
            })
          }
        >
          {t('Add probe target')}
        </Button>
      </div>
      {targets.fields.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('No probe targets configured')}
        </p>
      )}
      {form.formState.errors.targets?.root?.message && (
        <p role='alert' className='text-destructive text-sm'>
          {form.formState.errors.targets.root.message}
        </p>
      )}
      {form.formState.errors.targets?.message && (
        <p role='alert' className='text-destructive text-sm'>
          {form.formState.errors.targets.message}
        </p>
      )}
      {targets.fields.map((target, index) => {
        const group = watchedTargets[index]?.group
        const tokens = props.candidates.tokens.filter(
          (token) => token.user_id === userId && token.group === group
        )
        return (
          <fieldset
            key={target.id}
            disabled={props.disabled}
            className='min-w-0 space-y-4 rounded-xl border p-4'
          >
            <legend className='px-1 text-sm font-medium'>
              {t('Probe target {{number}}', { number: index + 1 })}
            </legend>
            <div className='grid min-w-0 gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name={`targets.${index}.group`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Group')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={props.candidates.groups.map((item) => ({
                          value: item.group,
                          label: item.name || item.group,
                        }))}
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value ?? '')
                          form.setValue(`targets.${index}.token_id`, 0, {
                            shouldDirty: true,
                          })
                        }}
                        disabled={props.disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`targets.${index}.model`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Model')}</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete='off' />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`targets.${index}.effort`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Reasoning effort')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={[
                          { value: 'low', label: t('Low') },
                          { value: 'medium', label: t('Medium') },
                          { value: 'high', label: t('High') },
                          { value: 'xhigh', label: t('Extra high') },
                        ]}
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={props.disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`targets.${index}.token_id`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Probe API token')}</FormLabel>
                    <FormControl>
                      <Combobox
                        options={tokens.map((token) => ({
                          value: String(token.id),
                          label: token.name || String(token.id),
                        }))}
                        value={field.value > 0 ? String(field.value) : ''}
                        onValueChange={(value) => field.onChange(Number(value))}
                        disabled={props.disabled || !userId || !group}
                        emptyText={t(
                          'No API tokens match this account and group'
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`targets.${index}.kinds`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Probe types')}</FormLabel>
                    <FormControl>
                      <MultiSelect
                        options={[
                          { value: 'math', label: t('Logic question') },
                          { value: 'drawing', label: t('SVG drawing') },
                        ]}
                        selected={field.value}
                        onChange={field.onChange}
                        disabled={props.disabled}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`targets.${index}.enabled`}
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between gap-3'>
                    <FormLabel>{t('Enable this probe target')}</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={props.disabled}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => targets.remove(index)}
            >
              {t('Remove probe target')}
            </Button>
          </fieldset>
        )
      })}
    </div>
  )
}
