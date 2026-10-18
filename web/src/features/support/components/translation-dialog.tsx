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
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

import type { SupportMessage, SupportTranslation } from '../types'

interface TranslationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message: SupportMessage | null
  translation?: SupportTranslation
  languageLabel: string
  isSaving: boolean
  onSave: (body: string) => void
}

export function TranslationDialog(props: TranslationDialogProps) {
  const { t } = useTranslation()
  const { message, translation, open } = props
  const [body, setBody] = useState('')

  useEffect(() => {
    if (open) setBody(translation?.body ?? '')
  }, [open, message?.id, translation?.body])

  if (!message) return null

  return (
    <Dialog
      open={open}
      onOpenChange={props.onOpenChange}
      title={t('Correct translation')}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => props.onOpenChange(false)}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={!body.trim() || props.isSaving}
            onClick={() => props.onSave(body.trim())}
          >
            {props.isSaving && (
              <Loader2 className='animate-spin' data-icon='inline-start' />
            )}
            {t('Save correction')}
          </Button>
        </>
      }
    >
      <div className='space-y-3'>
        <div className='bg-muted/50 max-h-40 overflow-auto rounded-lg border p-3'>
          <p className='text-muted-foreground mb-1 text-xs font-medium'>
            {t('Original message')}
          </p>
          <p className='text-sm break-words whitespace-pre-wrap'>
            {message.body}
          </p>
        </div>
        <Textarea
          aria-label={t('Enter the corrected translation')}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={8}
          maxLength={8000}
          placeholder={t('Enter the corrected translation')}
        />
        <Alert>
          <AlertTitle>{t('Corrected translation')}</AlertTitle>
          <AlertDescription>
            {t(
              'The corrected text replaces the machine translation for readers using {{language}}.',
              { language: props.languageLabel }
            )}
          </AlertDescription>
        </Alert>
      </div>
    </Dialog>
  )
}
