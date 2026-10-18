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
import { FileWarning, ImagePlus, Loader2, X } from 'lucide-react'
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { uploadSupportImage } from '../api'
import {
  SUPPORT_IMAGE_MIME_TYPES,
  SUPPORT_MAX_ATTACHMENTS,
  SUPPORT_MAX_IMAGE_BYTES,
} from '../constants'
import { getSupportErrorMessage } from '../lib'
import type { SupportAttachment, SupportSession } from '../types'

interface UploadItem {
  key: string
  name: string
  size: number
  status: 'uploading' | 'done' | 'error'
  previewUrl: string
  attachment?: SupportAttachment
}

export interface AttachmentUploaderHandle {
  addFiles: (files: File[]) => void
  clear: () => void
  getAttachments: () => SupportAttachment[]
}

interface AttachmentUploaderProps {
  session: SupportSession | null
  disabled?: boolean
  onUploadingChange?: (uploading: boolean) => void
}

let uploadKeySeed = 0

export const AttachmentUploader = forwardRef<
  AttachmentUploaderHandle,
  AttachmentUploaderProps
>(function AttachmentUploader(props, ref) {
  const { t } = useTranslation()
  const { session, disabled, onUploadingChange } = props
  const [items, setItems] = useState<UploadItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => {
    onUploadingChange?.(items.some((item) => item.status === 'uploading'))
  }, [items, onUploadingChange])

  useEffect(
    () => () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl)
      }
    },
    []
  )

  const removeItem = (key: string) => {
    setItems((current) => {
      const item = current.find((candidate) => candidate.key === key)
      if (item) URL.revokeObjectURL(item.previewUrl)
      return current.filter((candidate) => candidate.key !== key)
    })
  }

  const uploadFile = (file: File) => {
    if (!session) return
    const previewUrl = URL.createObjectURL(file)
    const key = `support-upload-${++uploadKeySeed}`
    setItems((current) => [
      ...current,
      {
        key,
        name: file.name,
        size: file.size,
        status: 'uploading',
        previewUrl,
      },
    ])
    uploadSupportImage(session, file)
      .then((attachment) => {
        setItems((current) =>
          current.map((item) =>
            item.key === key
              ? {
                  ...item,
                  status: 'done',
                  attachment: { ...attachment, preview_url: previewUrl },
                }
              : item
          )
        )
      })
      .catch((error: unknown) => {
        setItems((current) =>
          current.map((item) =>
            item.key === key ? { ...item, status: 'error' } : item
          )
        )
        toast.error(getSupportErrorMessage(error, 'Image upload failed', t))
      })
  }

  const addFiles = (files: File[]) => {
    if (disabled) return
    if (!session || files.length === 0) return
    const room =
      SUPPORT_MAX_ATTACHMENTS -
      itemsRef.current.filter((item) => item.status !== 'error').length
    if (room <= 0) {
      toast.error(t('You can attach up to 5 images'))
      return
    }
    const accepted: File[] = []
    for (const file of files) {
      if (!SUPPORT_IMAGE_MIME_TYPES.has(file.type)) {
        toast.error(t('Only JPG, PNG, WebP, and GIF images are allowed'))
        continue
      }
      if (file.size <= 0 || file.size > SUPPORT_MAX_IMAGE_BYTES) {
        toast.error(t('Image must be 1 byte to 8 MB'))
        continue
      }
      accepted.push(file)
    }
    if (accepted.length > room) {
      toast.error(t('You can attach up to 5 images'))
    }
    accepted.slice(0, room).forEach(uploadFile)
  }

  useImperativeHandle(ref, () => ({
    addFiles,
    clear: () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.previewUrl)
      }
      setItems([])
    },
    getAttachments: () =>
      itemsRef.current
        .filter((item) => item.status === 'done' && item.attachment)
        .map((item) => item.attachment as SupportAttachment),
  }))

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles([...(event.target.files ?? [])])
    event.target.value = ''
  }

  return (
    <div className='space-y-2'>
      {items.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {items.map((item) => (
            <div
              key={item.key}
              className='group bg-muted relative size-16 overflow-hidden rounded-lg border'
              title={item.name}
            >
              <img
                src={item.previewUrl}
                alt={item.name}
                className='size-full object-cover'
              />
              {item.status === 'uploading' && (
                <span className='bg-background/60 absolute inset-0 flex items-center justify-center'>
                  <Loader2 className='size-4 animate-spin' />
                </span>
              )}
              {item.status === 'error' && (
                <span className='bg-destructive/10 text-destructive absolute inset-0 flex items-center justify-center'>
                  <FileWarning className='size-4' />
                </span>
              )}
              <button
                type='button'
                aria-label={t('Remove')}
                onClick={() => removeItem(item.key)}
                className='bg-foreground/60 text-background absolute top-0.5 right-0.5 hidden size-4 items-center justify-center rounded-full group-hover:flex'
              >
                <X className='size-3' />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={fileInputRef}
        type='file'
        accept='image/jpeg,image/png,image/webp,image/gif'
        multiple
        className='hidden'
        onChange={handleInputChange}
      />
      <Button
        type='button'
        size='icon-sm'
        variant='ghost'
        disabled={disabled || !session}
        aria-label={t('Add images')}
        title={`${t('Add images')} (${SUPPORT_MAX_ATTACHMENTS})`}
        onClick={() => fileInputRef.current?.click()}
      >
        <ImagePlus />
      </Button>
    </div>
  )
})
