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
import { MessageCircle, Eraser, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useSystemConfigStore } from '@/stores/system-config-store'

/** A local interface preview: no credentials, model requests, or generated answers. */
export function DocsAssistantPreview() {
  const { t } = useTranslation()
  const siteBrand = useSystemConfigStore((state) => state.config.siteBrand)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const suggestions = [
    t('Claude Code cannot connect — how do I fix it?'),
    t('What does a 429 error mean here?'),
    t('Which base URL should my SDK use?'),
  ]

  return (
    <Popover
      modal={false}
      open={open}
      onOpenChange={(nextOpen, details) => {
        // A documentation companion stays open while the reader uses the page.
        if (
          details.reason === 'outside-press' ||
          details.reason === 'focus-out'
        ) {
          details.cancel()
          return
        }
        setOpen(nextOpen)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            ref={launcherRef}
            type='button'
            size='lg'
            className={cn(
              'fixed right-4 bottom-4 z-40 h-9 shadow-lg',
              open && 'invisible'
            )}
            tabIndex={open ? -1 : undefined}
          />
        }
      >
        <MessageCircle data-icon='inline-start' aria-hidden='true' />
        {t('Ask AI')}
      </PopoverTrigger>
      <PopoverContent
        data-public-brand={siteBrand}
        data-public-surface='content'
        side='top'
        align='end'
        // The 36px launcher stays mounted as the anchor; the panel replaces it.
        sideOffset={-36}
        collisionPadding={16}
        initialFocus={inputRef}
        finalFocus={launcherRef}
        className='bg-card text-card-foreground flex h-[min(34rem,calc(100dvh-3rem))] w-[min(24rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-hidden rounded-none border p-0 shadow-2xl'
      >
        <header className='flex shrink-0 items-start justify-between gap-2 border-b px-4 py-3'>
          <div className='flex min-w-0 items-start gap-2'>
            <MessageCircle
              className='mt-0.5 size-4 shrink-0'
              aria-hidden='true'
            />
            <div className='min-w-0'>
              <PopoverTitle>{t('Docs AI assistant')}</PopoverTitle>
              <PopoverDescription className='mt-0.5 text-xs leading-4'>
                {t('UI preview only. AI answers are not connected yet.')}
              </PopoverDescription>
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={t('Clear conversation')}
              onClick={() => {
                setQuestion('')
                inputRef.current?.focus()
              }}
            >
              <Eraser aria-hidden='true' />
            </Button>
            <Button
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={t('Close')}
              onClick={() => setOpen(false)}
            >
              <X aria-hidden='true' />
            </Button>
          </div>
        </header>
        <section
          aria-label={t('Suggested questions')}
          className='flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-4'
        >
          <p className='text-muted-foreground text-sm leading-6'>
            {t('Choose a suggestion to preview the question field.')}
          </p>
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type='button'
              variant='outline'
              className='bg-muted/50 h-auto min-h-9 w-full justify-start px-3 py-2 text-left text-sm font-normal whitespace-normal'
              onClick={() => {
                setQuestion(suggestion)
                inputRef.current?.focus()
              }}
            >
              {suggestion}
            </Button>
          ))}
        </section>
        <footer className='shrink-0 border-t p-3'>
          <div className='flex items-end gap-2'>
            <Textarea
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={2}
              placeholder={t('Paste an error or ask a question...')}
              className='max-h-28 min-h-9 flex-1 resize-none text-sm'
              aria-label={t('Ask AI')}
            />
            <Button type='button' size='icon' disabled aria-label={t('Send')}>
              <Send aria-hidden='true' />
            </Button>
          </div>
        </footer>
      </PopoverContent>
    </Popover>
  )
}
