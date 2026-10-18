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
import { ImageIcon, ImagePlus, KeyRound, SlidersHorizontal } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber } from '@/lib/format'

import { ImageReferenceDialog } from './image-reference-dialog'

export function ImageComposer() {
  const { t, i18n } = useTranslation()
  const id = useId()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const [prompt, setPrompt] = useState('')
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [model, setModel] = useState('gpt-image-2')
  const [size, setSize] = useState('auto')
  const [quality, setQuality] = useState('auto')
  const [count, setCount] = useState('1')
  const [asynchronous, setAsynchronous] = useState(false)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const keyOptions = [
    { label: t('Select an API key'), value: null },
    { label: t('Preview API key'), value: 'preview' },
  ]
  const modelOptions = ['gpt-image-2', 'gpt-image-1.5'].map((value) => ({
    label: value,
    value,
  }))
  const sizeOptions = [
    { label: t('Auto'), value: 'auto' },
    ...['1024x1024', '1536x1024', '1024x1536'].map((value) => ({
      label: value,
      value,
    })),
  ]
  const qualityOptions = [
    { label: t('Auto'), value: 'auto' },
    { label: t('High'), value: 'high' },
    { label: t('Medium'), value: 'medium' },
    { label: t('Low'), value: 'low' },
  ]
  const countOptions = [1, 2, 4].map((value) => ({
    label: `×${formatNumber(value, locale)}`,
    value: String(value),
  }))

  return (
    <section aria-label={t('Image composer')} className='min-w-0'>
      <div className='mb-3 flex items-center justify-center gap-2 py-2'>
        <ImagePlus aria-hidden='true' className='size-5' />
        <h2 className='text-lg font-semibold'>{t('Start creating images')}</h2>
      </div>
      <div className='bg-background border p-3 sm:p-4'>
        <Label htmlFor={`${id}-prompt`} className='sr-only'>
          {t('Image prompt')}
        </Label>
        <Textarea
          id={`${id}-prompt`}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={t('Describe the image you want to create...')}
          className='min-h-24 resize-y rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0'
        />
        <div className='my-3 flex flex-wrap gap-2'>
          {[
            t('Golden-hour mountains, ultra-wide view'),
            t('A warm bookstore café on a rainy night'),
            t('A minimal poster of a paper plane over the sea'),
          ].map((example) => (
            <Button
              key={example}
              type='button'
              variant='outline'
              size='sm'
              className='h-auto max-w-full rounded-none border-dashed px-2 py-1 text-xs whitespace-normal'
              onClick={() => setPrompt(example)}
            >
              {example}
            </Button>
          ))}
        </div>
        <div
          role='group'
          aria-label={t('Image settings')}
          className='flex flex-wrap items-center gap-2 border-t pt-3'
        >
          <Select value={apiKey} items={keyOptions} onValueChange={setApiKey}>
            <SelectTrigger
              aria-label={t('API key')}
              className='min-w-0 flex-[1_1_240px] rounded-sm'
            >
              <KeyRound aria-hidden='true' className='size-3.5' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {keyOptions.map((item) => (
                <SelectItem key={item.value ?? 'none'} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={model}
            items={modelOptions}
            onValueChange={(value) => {
              if (value) setModel(value)
            }}
          >
            <SelectTrigger
              aria-label={t('Image model')}
              className='min-w-0 flex-[1_1_190px] rounded-sm'
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {modelOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='rounded-sm'
            onClick={() => setReferenceOpen(true)}
          >
            <ImageIcon aria-hidden='true' className='size-3.5' />
            {t('Reference image')}
          </Button>
          <Select
            value={size}
            items={sizeOptions}
            onValueChange={(value) => {
              if (value) setSize(value)
            }}
          >
            <SelectTrigger aria-label={t('Image size')} className='rounded-sm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {sizeOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={quality}
            items={qualityOptions}
            onValueChange={(value) => {
              if (value) setQuality(value)
            }}
          >
            <SelectTrigger
              aria-label={t('Image quality')}
              className='rounded-sm'
            >
              <SlidersHorizontal aria-hidden='true' className='size-3.5' />
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {qualityOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={count}
            items={countOptions}
            onValueChange={(value) => {
              if (value) setCount(value)
            }}
          >
            <SelectTrigger aria-label={t('Image count')} className='rounded-sm'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {countOptions.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant='secondary' className='ml-auto rounded-none'>
            {t('Per request')}
          </Badge>
          <Button
            type='button'
            size='sm'
            className='rounded-sm'
            disabled
            aria-describedby={`${id}-notice`}
          >
            <ImagePlus aria-hidden='true' />
            {t('Generate')}
          </Button>
        </div>
        <Alert className='border-warning/40 bg-warning/10 mt-3 rounded-sm'>
          <KeyRound aria-hidden='true' />
          <AlertTitle id={`${id}-notice`}>
            {t(
              'Interface preview only. Image generation is not connected yet.'
            )}
          </AlertTitle>
          <AlertDescription>
            {t(
              'These controls preview the interface. No API key is read and no request is sent.'
            )}
          </AlertDescription>
        </Alert>
        <div className='text-muted-foreground mt-3 flex flex-wrap items-center justify-between gap-2 text-xs'>
          <div className='flex items-center gap-2'>
            <Switch
              id={`${id}-async`}
              size='sm'
              checked={asynchronous}
              onCheckedChange={setAsynchronous}
            />
            <Label htmlFor={`${id}-async`} className='text-xs font-normal'>
              {t('Asynchronous generation')}
            </Label>
          </div>
          <span>
            {t('Selections are temporary and reset when you leave this page.')}
          </span>
        </div>
      </div>
      <ImageReferenceDialog
        open={referenceOpen}
        onOpenChange={setReferenceOpen}
      />
    </section>
  )
}
