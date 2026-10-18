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
import { BotMessageSquare, MessageSquare, PanelLeft } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

import { WorkspaceComposer } from './components/workspace-composer'
import { WorkspaceSidebar } from './components/workspace-sidebar'
import type { PreviewConversation } from './types'

interface WorkspaceProps {
  headerActions?: ReactNode
  modeControls?: ReactNode
  content?: ReactNode
}

function newPreviewConversation(isDraft = true): PreviewConversation {
  return { id: nanoid(), title: '', draft: '', isDraft }
}

export function Workspace(props: WorkspaceProps) {
  const { t } = useTranslation()
  const [conversations, setConversations] = useState(() => [
    newPreviewConversation(),
  ])
  const [activeId, setActiveId] = useState(conversations[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const active =
    conversations.find((conversation) => conversation.id === activeId) ??
    conversations[0]

  function createConversation(): void {
    const next = newPreviewConversation(false)
    setConversations((current) => [
      next,
      ...current.filter(
        (conversation) => !conversation.isDraft || conversation.draft.length > 0
      ),
    ])
    setActiveId(next.id)
    setSidebarOpen(false)
  }

  function selectConversation(id: string): void {
    setActiveId(id)
    setSidebarOpen(false)
  }

  function renameConversation(id: string, title: string): void {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id
          ? { ...conversation, title, isDraft: false }
          : conversation
      )
    )
  }

  function deleteConversation(id: string): void {
    const remaining = conversations.filter(
      (conversation) => conversation.id !== id
    )
    if (remaining.length === 0) remaining.push(newPreviewConversation())
    setConversations(remaining)
    if (activeId === id) setActiveId(remaining[0].id)
  }

  function updateDraft(draft: string): void {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === active.id
          ? { ...conversation, draft }
          : conversation
      )
    )
  }

  const sidebarProps = {
    conversations,
    activeId,
    onCreate: createConversation,
    onSelect: selectConversation,
    onRename: renameConversation,
    onDelete: deleteConversation,
  }

  return (
    <div className='bg-background flex size-full min-h-0 min-w-0 overflow-hidden border-t lg:border'>
      <aside
        aria-label={t('Conversation sidebar')}
        className='bg-muted/10 hidden w-64 shrink-0 border-r lg:block'
      >
        <WorkspaceSidebar {...sidebarProps} />
      </aside>
      <section
        aria-label={t('Workspace conversation')}
        className='flex min-h-0 min-w-0 flex-1 flex-col'
      >
        <header className='flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3 sm:px-4'>
          <div className='flex min-w-0 items-center gap-2'>
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    className='lg:hidden'
                    aria-label={t('Open conversations')}
                  />
                }
              >
                <PanelLeft className='size-4' aria-hidden='true' />
              </SheetTrigger>
              <SheetContent side='left' className='w-72 max-w-[85vw] gap-0 p-0'>
                <SheetHeader className='border-b'>
                  <SheetTitle>{t('Conversations')}</SheetTitle>
                  <SheetDescription>
                    {t('Interface preview. Messages are not sent or saved.')}
                  </SheetDescription>
                </SheetHeader>
                <div className='min-h-0 flex-1'>
                  <WorkspaceSidebar {...sidebarProps} />
                </div>
              </SheetContent>
            </Sheet>
            <h1 className='truncate text-sm font-semibold'>
              {active.title || t('New conversation')}
            </h1>
          </div>
          <div className='flex shrink-0 items-center gap-2'>
            {props.headerActions}
          </div>
        </header>
        {props.content ?? (
          <>
            <div className='flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4'>
              <EmptyState
                icon={BotMessageSquare}
                title={t('What would you like to ask today?')}
                className='min-h-48 [&_[data-slot=empty-icon]]:bg-transparent [&_[data-slot=empty-title]]:text-lg [&_[data-slot=empty-title]]:font-semibold'
                action={
                  <Button
                    variant='outline'
                    size='sm'
                    className='rounded-sm'
                    onClick={() =>
                      updateDraft(
                        t('Explain a difficult concept with a simple example.')
                      )
                    }
                  >
                    <MessageSquare className='size-3.5' aria-hidden='true' />
                    {t('Explain a concept')}
                  </Button>
                }
              />
            </div>
            <WorkspaceComposer
              key={active.id}
              draft={active.draft}
              onDraftChange={updateDraft}
              modeControls={props.modeControls}
            />
          </>
        )}
        <p
          role='note'
          className='text-muted-foreground shrink-0 px-3 pb-3 text-center text-xs'
        >
          {t('Interface preview. Messages are not sent or saved.')}
        </p>
      </section>
    </div>
  )
}
