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
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  Loader2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import { useAttachmentSource } from '../hooks/use-attachment-source'
import { formatFileSize } from '../lib'
import type { SupportAttachment, SupportScope, SupportSession } from '../types'

interface AttachmentStripProps {
  attachments: SupportAttachment[]
  session?: SupportSession | null
  ticketId?: number
  scope?: SupportScope
  className?: string
}

function AttachmentThumbnail(props: {
  attachment: SupportAttachment
  session?: SupportSession | null
  ticketId?: number
  scope?: SupportScope
  onOpen: () => void
}) {
  const { attachment } = props
  const { source, failed } = useAttachmentSource({
    attachment,
    session: props.session ?? null,
    ticketId: props.ticketId,
    scope: props.scope,
  })

  return (
    <button
      type='button'
      onClick={props.onOpen}
      title={attachment.name}
      className='bg-muted group relative size-16 shrink-0 overflow-hidden rounded-lg border transition-opacity hover:opacity-90'
    >
      {source ? (
        <img
          src={source}
          alt={attachment.name}
          className='size-full object-cover'
        />
      ) : (
        <span className='text-muted-foreground flex size-full items-center justify-center'>
          {failed ? (
            <FileWarning className='size-4' />
          ) : (
            <Loader2 className='size-4 animate-spin' />
          )}
        </span>
      )}
    </button>
  )
}

export function AttachmentStrip(props: AttachmentStripProps) {
  const { t } = useTranslation()
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const { attachments } = props

  if (attachments.length === 0) return null

  const active = viewerIndex != null ? (attachments[viewerIndex] ?? null) : null

  return (
    <>
      <div
        className={cn('flex flex-wrap gap-1.5', props.className)}
        data-attachment-strip
      >
        {attachments.map((attachment, index) => (
          <AttachmentThumbnail
            key={attachment.key || `${attachment.name}-${index}`}
            attachment={attachment}
            session={props.session}
            ticketId={props.ticketId}
            scope={props.scope}
            onOpen={() => setViewerIndex(index)}
          />
        ))}
      </div>
      <Dialog
        open={viewerIndex != null}
        onOpenChange={(open) => {
          if (!open) setViewerIndex(null)
        }}
      >
        <DialogContent
          className='max-w-3xl overflow-hidden p-3 sm:max-w-3xl'
          showCloseButton={false}
        >
          <DialogTitle className='sr-only'>{t('Attachments')}</DialogTitle>
          {active && (
            <ViewerContent
              attachment={active}
              session={props.session ?? null}
              ticketId={props.ticketId}
              scope={props.scope}
              onClose={() => setViewerIndex(null)}
              onPrevious={
                attachments.length > 1
                  ? () =>
                      setViewerIndex(
                        (current) =>
                          ((current ?? 0) - 1 + attachments.length) %
                          attachments.length
                      )
                  : undefined
              }
              onNext={
                attachments.length > 1
                  ? () =>
                      setViewerIndex(
                        (current) => ((current ?? 0) + 1) % attachments.length
                      )
                  : undefined
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ViewerContent(props: {
  attachment: SupportAttachment
  session: SupportSession | null
  ticketId?: number
  scope?: SupportScope
  onClose: () => void
  onPrevious?: () => void
  onNext?: () => void
}) {
  const { t } = useTranslation()
  const { attachment } = props
  const { source, failed } = useAttachmentSource({
    attachment,
    session: props.session,
    ticketId: props.ticketId,
    scope: props.scope,
  })

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{attachment.name}</p>
          <p className='text-muted-foreground text-xs'>
            {formatFileSize(attachment.size)}
          </p>
        </div>
        <div className='flex items-center gap-1'>
          {props.onPrevious && (
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              aria-label={t('Previous')}
              onClick={props.onPrevious}
            >
              <ChevronLeft />
            </Button>
          )}
          {props.onNext && (
            <Button
              type='button'
              size='icon-sm'
              variant='ghost'
              aria-label={t('Next')}
              onClick={props.onNext}
            >
              <ChevronRight />
            </Button>
          )}
          <Button
            type='button'
            size='icon-sm'
            variant='ghost'
            aria-label={t('Close')}
            onClick={props.onClose}
          >
            <X />
          </Button>
        </div>
      </div>
      <div className='bg-muted/40 flex max-h-[70vh] items-center justify-center overflow-hidden rounded-lg'>
        {source ? (
          <img
            src={source}
            alt={attachment.name}
            className='max-h-[70vh] w-auto object-contain'
          />
        ) : (
          <span className='text-muted-foreground flex flex-col items-center gap-2 p-10 text-sm'>
            {failed ? (
              <>
                <FileWarning className='size-6' />
                {t('Failed to load image')}
              </>
            ) : (
              <Loader2 className='size-6 animate-spin' />
            )}
          </span>
        )}
      </div>
    </div>
  )
}
