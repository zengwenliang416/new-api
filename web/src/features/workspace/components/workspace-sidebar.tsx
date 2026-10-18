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
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import type { PreviewConversation } from '../types'
import { ConversationNameDialog } from './conversation-name-dialog'

interface WorkspaceSidebarProps {
  conversations: PreviewConversation[]
  activeId: string
  onCreate: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [renameId, setRenameId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const search = query.trim().toLocaleLowerCase()
  const visible = props.conversations
    .filter(
      (conversation) => !conversation.isDraft || conversation.draft.length > 0
    )
    .filter(
      (conversation) =>
        !search ||
        conversation.title.toLocaleLowerCase().includes(search) ||
        conversation.draft.toLocaleLowerCase().includes(search)
    )

  const renamed = props.conversations.find(
    (conversation) => conversation.id === renameId
  )

  return (
    <>
      <nav
        aria-label={t('Conversations')}
        className='flex h-full min-h-0 flex-col gap-2 p-3'
      >
        <Button
          className='h-9 w-full shrink-0 justify-start gap-2 rounded-sm'
          variant='outline'
          onClick={() => {
            props.onCreate()
            setQuery('')
          }}
        >
          <Plus className='size-4' aria-hidden='true' />
          {t('New conversation')}
        </Button>
        <div className='relative shrink-0'>
          <Search
            className='text-muted-foreground pointer-events-none absolute top-2.5 left-3 size-4'
            aria-hidden='true'
          />
          <Input
            type='search'
            aria-label={t('Search conversations')}
            placeholder={t('Search conversations')}
            className='h-9 rounded-sm pl-9'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2'>
          {visible.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title={
                search
                  ? t('No matching conversations')
                  : t('No conversations yet')
              }
              className='[&_[data-slot=empty-title]]:text-muted-foreground min-h-28 p-3 [&_[data-slot=empty-icon]]:hidden [&_[data-slot=empty-title]]:font-normal'
            />
          ) : (
            <ul className='space-y-1'>
              {visible.map((conversation) => {
                const title = conversation.title || t('New conversation')
                return (
                  <li
                    key={conversation.id}
                    className={cn(
                      'group flex min-w-0 items-center gap-0.5 rounded-sm',
                      props.activeId === conversation.id && 'bg-accent'
                    )}
                  >
                    <Button
                      className='h-10 min-w-0 flex-1 justify-start gap-2 rounded-sm px-2 font-normal'
                      variant='ghost'
                      aria-current={
                        props.activeId === conversation.id ? 'true' : undefined
                      }
                      aria-label={t('Open conversation {{title}}', { title })}
                      title={title}
                      onClick={() => props.onSelect(conversation.id)}
                    >
                      <MessageSquare
                        className='size-3.5 shrink-0'
                        aria-hidden='true'
                      />
                      <span className='truncate'>{title}</span>
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            size='icon-sm'
                            variant='ghost'
                            aria-label={t(
                              'Conversation actions for {{title}}',
                              { title }
                            )}
                            className='shrink-0'
                          />
                        }
                      >
                        <MoreHorizontal className='size-4' aria-hidden='true' />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem
                          onClick={() => setRenameId(conversation.id)}
                        >
                          <Pencil className='size-4' />
                          {t('Rename')}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant='destructive'
                          onClick={() => setDeleteId(conversation.id)}
                        >
                          <Trash2 className='size-4' />
                          {t('Delete')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </nav>
      {renamed && (
        <ConversationNameDialog
          key={renamed.id}
          title={renamed.title || t('New conversation')}
          onClose={() => setRenameId(null)}
          onSave={(title) => {
            props.onRename(renamed.id, title)
            setRenameId(null)
          }}
        />
      )}
      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        destructive
        title={t('Delete conversation?')}
        desc={t('This preview conversation will be removed.')}
        confirmText={t('Delete')}
        handleConfirm={() => {
          if (deleteId) props.onDelete(deleteId)
          setDeleteId(null)
        }}
      />
    </>
  )
}
