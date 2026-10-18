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
import { Languages, Loader2, PencilLine } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { SupportTranslation } from '../types'

interface MessageBodyProps {
  body: string
  translation?: SupportTranslation
  eligible: boolean
  canCorrect: boolean
  isTranslating: boolean
  onTranslate: () => Promise<SupportTranslation>
  onCorrect: () => void
}

/**
 * Message text with the optional machine-translation toggle and the
 * admin-only correction entry point.
 */
export function MessageBody(props: MessageBodyProps) {
  const { t } = useTranslation()
  const { translation } = props
  const [showing, setShowing] = useState(false)

  useEffect(() => {
    if (!translation) setShowing(false)
  }, [translation])

  const languageButton = props.eligible ? (
    <Button
      type='button'
      size='xs'
      variant='ghost'
      disabled={props.isTranslating}
      onClick={async () => {
        if (translation) {
          setShowing((current) => !current)
          return
        }
        try {
          await props.onTranslate()
          setShowing(true)
        } catch {
          // The mutation reports the failure; leave the original available for retry.
          setShowing(false)
        }
      }}
    >
      {props.isTranslating ? (
        <Loader2 className='animate-spin' data-icon='inline-start' />
      ) : (
        <Languages data-icon='inline-start' />
      )}
      {showing ? t('Show original') : t('Show translation')}
    </Button>
  ) : null

  const showingTranslation = showing && !!translation
  const text = showingTranslation ? translation.body : props.body

  return (
    <div className='space-y-1.5'>
      <p className='text-sm leading-relaxed break-words whitespace-pre-wrap'>
        {text}
      </p>
      {(languageButton || showingTranslation) && (
        <div className='flex flex-wrap items-center gap-2'>
          {languageButton}
          {showingTranslation && (
            <Badge variant='outline' className='text-[10px]'>
              {translation.status === 'reviewed'
                ? t('Corrected translation')
                : t('Machine translation')}
            </Badge>
          )}
          {showingTranslation && props.canCorrect && (
            <Button
              type='button'
              size='xs'
              variant='ghost'
              onClick={props.onCorrect}
            >
              <PencilLine data-icon='inline-start' />
              {t('Correct translation')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
