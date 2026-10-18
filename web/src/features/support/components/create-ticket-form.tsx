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
import { Link } from '@tanstack/react-router'
import { Loader2, MailCheck } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import {
  SUPPORT_CATEGORY_OPTIONS,
  SUPPORT_VERIFICATION_OPTIONS,
} from '../constants'
import { getNotifyChannelLabel, toWorkerLanguage } from '../lib'
import type {
  SupportTicketCreatePayload,
  SupportSession,
  TicketCategory,
  TicketVerification,
} from '../types'
import {
  AttachmentUploader,
  type AttachmentUploaderHandle,
} from './attachment-uploader'

interface CreateTicketFormProps {
  session: SupportSession
  isSubmitting: boolean
  onSubmit: (payload: SupportTicketCreatePayload) => Promise<void>
  onCancel: () => void
}

export function CreateTicketForm(props: CreateTicketFormProps) {
  const { t, i18n } = useTranslation()
  const { session } = props
  const uploaderRef = useRef<AttachmentUploaderHandle>(null)
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<TicketCategory>('other')
  const [verification, setVerification] =
    useState<TicketVerification>('not_verified')
  const [body, setBody] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const hasEmail = !!session.user.email?.trim()
  const canSubmit =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    !props.isSubmitting &&
    !isUploading

  if (!hasEmail) {
    return (
      <div className='p-4'>
        <Alert>
          <MailCheck />
          <AlertTitle>{t('Email is required')}</AlertTitle>
          <AlertDescription className='space-y-3'>
            <p>
              {t(
                'Bind an email address before creating a support ticket so we can reach you about this issue.'
              )}
            </p>
            <Button type='button' size='sm' render={<Link to='/profile' />}>
              {t('Bind Email')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload: SupportTicketCreatePayload = {
      title: title.trim(),
      category,
      verification_level: verification,
      body: body.trim(),
      attachments: uploaderRef.current?.getAttachments() ?? [],
      lang: toWorkerLanguage(i18n.language),
    }
    const fingerprint = JSON.stringify({
      ...payload,
      attachments: payload.attachments.map((attachment) => attachment.key),
      worker_url: session.worker_url,
      user_id: session.user.id,
    })
    if (submissionRef.current?.fingerprint !== fingerprint) {
      submissionRef.current = { fingerprint, id: nanoid() }
    }
    const requestId = submissionRef.current.id
    try {
      await props.onSubmit({ ...payload, client_request_id: requestId })
      if (submissionRef.current?.id === requestId) submissionRef.current = null
    } catch {
      // The owning mutation reports the error. Keep the ID for a retry when
      // the server may have saved the ticket before the response was lost.
    }
  }

  return (
    <div className='min-h-0 flex-1 overflow-y-auto p-4'>
      <div className='mx-auto max-w-2xl space-y-5'>
        <div className='space-y-1.5'>
          <Label htmlFor='support-ticket-title'>{t('Subject')}</Label>
          <Input
            id='support-ticket-title'
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('Summarize the issue in one sentence')}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>{t('Issue category')}</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as TicketCategory)}
          >
            <SelectTrigger className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORT_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='space-y-2'>
          <Label>{t('Verification level')}</Label>
          <RadioGroup
            value={verification}
            onValueChange={(value) =>
              setVerification(value as TicketVerification)
            }
            className='gap-2'
          >
            {SUPPORT_VERIFICATION_OPTIONS.map((option) => (
              <label
                key={option.value}
                htmlFor={`support-verification-${option.value}`}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                  verification === option.value
                    ? 'border-primary/50 bg-primary/5'
                    : 'hover:bg-muted/50'
                )}
              >
                <RadioGroupItem
                  value={option.value}
                  id={`support-verification-${option.value}`}
                  className='mt-0.5'
                />
                <span className='space-y-0.5'>
                  <span className='block text-sm font-medium'>
                    {t(option.labelKey)}
                  </span>
                  <span className='text-muted-foreground block text-xs'>
                    {t(option.descriptionKey)}
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>
        </div>

        <div className='space-y-1.5'>
          <Label htmlFor='support-ticket-body'>{t('Details')}</Label>
          <Textarea
            id='support-ticket-body'
            value={body}
            maxLength={8000}
            rows={8}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t(
              'Describe what happened, what you expected, and anything you have tried.'
            )}
          />
        </div>

        <div className='space-y-1.5'>
          <Label>{t('Attachments')}</Label>
          <AttachmentUploader
            ref={uploaderRef}
            session={session}
            disabled={props.isSubmitting}
            onUploadingChange={setIsUploading}
          />
        </div>

        {session.notify.configured ? (
          <Alert>
            <MailCheck />
            <AlertTitle>
              {t(getNotifyChannelLabel(session.notify.label, t))}
            </AlertTitle>
            <AlertDescription>{session.notify.target}</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>{t('No reply method')}</AlertTitle>
            <AlertDescription className='space-y-3'>
              <p>
                {t(
                  'Bind an email address so we can notify you about replies and status changes.'
                )}
              </p>
              <Button
                type='button'
                size='sm'
                variant='outline'
                render={<Link to='/profile' />}
              >
                {t('Bind Email')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className='flex items-center justify-end gap-2'>
          <Button
            type='button'
            variant='outline'
            disabled={props.isSubmitting}
            onClick={props.onCancel}
          >
            {t('Cancel')}
          </Button>
          <Button
            type='button'
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {props.isSubmitting && (
              <Loader2 className='animate-spin' data-icon='inline-start' />
            )}
            {t('Submit ticket')}
          </Button>
        </div>
      </div>
    </div>
  )
}
