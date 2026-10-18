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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUp, ExternalLink, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAuthStore } from '@/stores/auth-store'

import {
  createSupportMessage,
  deleteSupportTicket,
  getSupportTicket,
  listSupportMessages,
  translateSupportMessage,
  updateSupportMessageTranslation,
  updateSupportTicket,
} from '../api'
import {
  SUPPORT_DATA_REFETCH_MS,
  SUPPORT_PRIORITY_OPTIONS,
  SUPPORT_STATUS_OPTIONS,
} from '../constants'
import {
  SUPPORT_TICKET_QUERY_KEY,
  SUPPORT_TICKETS_QUERY_KEY,
  SUPPORT_SUMMARY_QUERY_KEY,
} from '../hooks/use-support-session'
import {
  getSupportErrorMessage,
  getViewerLanguageLabel,
  handleImageDrop,
  handleImagePaste,
  toWorkerLanguage,
} from '../lib'
import { useSupportDateTimeFormat } from '../lib/use-support-date-format'
import type {
  SupportMessage,
  SupportMessageCreatePayload,
  SupportScope,
  SupportSession,
  SupportTicketDetail,
  SupportTranslation,
  TicketPriority,
  TicketStatus,
} from '../types'
import { AttachmentStrip } from './attachment-strip'
import {
  AttachmentUploader,
  type AttachmentUploaderHandle,
} from './attachment-uploader'
import { MessageBody } from './message-body'
import {
  TicketCategoryBadge,
  TicketStatusBadge,
  TicketVerificationBadge,
} from './support-badges'
import { TranslationDialog } from './translation-dialog'

interface TicketDetailProps {
  scope: SupportScope
  ticketId: number
  session: SupportSession
  translationEnabled: boolean
  onDeleted: () => void
  onTicketData: (detail: SupportTicketDetail) => void
}

const ADMIN_STATUS_OPTIONS = SUPPORT_STATUS_OPTIONS.filter(
  (option) => option.value !== 'all'
)

export function TicketDetail(props: TicketDetailProps) {
  return (
    <TicketConversation key={`${props.scope}:${props.ticketId}`} {...props} />
  )
}

// Requests and local drafts belong to one conversation for its whole lifetime.
// A different ticket must not replace a pending mutation's callbacks in place.
function TicketConversation(props: TicketDetailProps) {
  const { t, i18n } = useTranslation()
  const formatDateTime = useSupportDateTimeFormat()
  const queryClient = useQueryClient()
  const viewer = useAuthStore((state) => state.auth.user)
  const { scope, ticketId, session } = props
  const viewerLang = toWorkerLanguage(i18n.language)

  const detailKey = [
    ...SUPPORT_TICKET_QUERY_KEY,
    scope,
    ticketId,
    session.token,
    viewerLang,
  ]

  const [body, setBody] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [correcting, setCorrecting] = useState<SupportMessage | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [olderMessages, setOlderMessages] = useState<SupportMessage[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>()
  const [messageTranslations, setMessageTranslations] = useState<
    Record<string, Record<number, SupportTranslation>>
  >({})
  const [isLoadingOlder, setIsLoadingOlder] = useState(false)
  const activeRef = useRef(false)
  const uploaderRef = useRef<AttachmentUploaderHandle>(null)
  const submissionRef = useRef<{ fingerprint: string; id: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const onTicketDataRef = useRef(props.onTicketData)
  onTicketDataRef.current = props.onTicketData

  useEffect(() => {
    activeRef.current = true
    return () => {
      activeRef.current = false
    }
  }, [])

  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => getSupportTicket(session, ticketId, scope, viewerLang),
    enabled: !!session,
    refetchInterval: (query) =>
      query.state.data?.ticket.status === 'closed'
        ? false
        : SUPPORT_DATA_REFETCH_MS,
    retry: false,
  })

  const detail = detailQuery.data ?? null
  // Undefined means no history page has been loaded; null means exhausted.
  const olderCursor =
    historyCursor === undefined ? (detail?.next_cursor ?? null) : historyCursor

  useEffect(() => {
    if (detail) onTicketDataRef.current(detail)
  }, [detail])

  const updateMessageTranslation = (
    messageId: number,
    language: string,
    translation: SupportTranslation
  ) => {
    queryClient.setQueriesData<SupportTicketDetail>(
      {
        queryKey: [...SUPPORT_TICKET_QUERY_KEY, scope, ticketId],
        predicate: (query) => query.queryKey.at(-1) === language,
      },
      (current) =>
        current
          ? {
              ...current,
              translations: {
                ...current.translations,
                [messageId]: translation,
              },
            }
          : current
    )
    if (!activeRef.current) return
    setMessageTranslations((current) => ({
      ...current,
      [language]: { ...current[language], [messageId]: translation },
    }))
  }

  const invalidateLists = () => {
    queryClient.invalidateQueries({ queryKey: SUPPORT_TICKETS_QUERY_KEY })
    queryClient.invalidateQueries({ queryKey: SUPPORT_SUMMARY_QUERY_KEY })
  }

  const sendMutation = useMutation({
    mutationFn: (payload: SupportMessageCreatePayload) =>
      createSupportMessage(session, payload),
    onSuccess: (result, payload) => {
      if (submissionRef.current?.id === payload.client_request_id) {
        submissionRef.current = null
      }
      queryClient.setQueryData(detailKey, result)
      invalidateLists()
      if (!activeRef.current) return
      setBody('')
      uploaderRef.current?.clear()
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ block: 'end' })
      })
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Failed to send message', t))
    },
  })

  const translateMutation = useMutation({
    mutationFn: (payload: { messageId: number; language: string }) =>
      translateSupportMessage(session, {
        ticketId,
        messageId: payload.messageId,
        scope,
        lang: payload.language,
      }),
    onSuccess: (translation, payload) => {
      updateMessageTranslation(payload.messageId, payload.language, translation)
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Translation failed', t))
    },
  })

  const correctMutation = useMutation({
    mutationFn: (payload: {
      messageId: number
      body: string
      language: string
    }) =>
      updateSupportMessageTranslation(session, {
        ticketId,
        messageId: payload.messageId,
        scope,
        lang: payload.language,
        body: payload.body,
      }),
    onSuccess: (translation, payload) => {
      updateMessageTranslation(payload.messageId, payload.language, translation)
      setCorrecting(null)
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Failed to save correction', t))
    },
  })

  const ticketUpdateMutation = useMutation({
    mutationFn: (payload: {
      status?: TicketStatus
      priority?: TicketPriority
    }) => updateSupportTicket(session, { scope, ticketId, ...payload }),
    onSuccess: (result) => {
      queryClient.setQueryData(detailKey, result)
      invalidateLists()
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Failed to update ticket', t))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteSupportTicket(session, { ticketId, scope }),
    onSuccess: () => {
      queryClient.removeQueries({
        queryKey: [...SUPPORT_TICKET_QUERY_KEY, scope, ticketId],
      })
      invalidateLists()
      if (!activeRef.current) return
      toast.success(t('Ticket deleted'))
      props.onDeleted()
    },
    onError: (error) => {
      toast.error(getSupportErrorMessage(error, 'Failed to delete ticket', t))
    },
  })

  const loadOlder = async () => {
    if (!olderCursor || isLoadingOlder) return
    setIsLoadingOlder(true)
    try {
      const result = await listSupportMessages(session, {
        scope,
        ticketId,
        cursor: olderCursor,
        lang: viewerLang,
      })
      if (!activeRef.current) return
      setOlderMessages((current) => {
        const known = new Set(current.map((message) => message.id))
        return [
          ...result.items.filter((message) => !known.has(message.id)),
          ...current,
        ]
      })
      setMessageTranslations((current) => ({
        ...current,
        [viewerLang]: { ...current[viewerLang], ...result.translations },
      }))
      setHistoryCursor(result.next_cursor ?? null)
    } catch (error) {
      if (activeRef.current) {
        toast.error(getSupportErrorMessage(error, 'Failed to load messages', t))
      }
    } finally {
      if (activeRef.current) setIsLoadingOlder(false)
    }
  }

  if (detailQuery.isLoading) {
    return <LoadingState className='h-full min-h-0' size='sm' />
  }

  if (detailQuery.error || !detail) {
    return (
      <ErrorState
        title={t('Failed to load ticket')}
        description={getSupportErrorMessage(
          detailQuery.error,
          'Failed to load ticket',
          t
        )}
        className='h-full min-h-0 border-0'
        onRetry={() => void detailQuery.refetch()}
      />
    )
  }

  const ticket = detail.ticket
  const translations = {
    ...messageTranslations[viewerLang],
    ...detail.translations,
  }
  const messages = mergeMessages(olderMessages, detail.messages)
  const isOwnTicket =
    scope === 'admin' && viewer != null && ticket.user_id === Number(viewer.id)
  const canSend =
    body.trim().length > 0 && !sendMutation.isPending && !isUploading
  const senderName = (message: SupportMessage) =>
    message.sender_name ||
    t(message.sender_type === 'admin' ? 'Support' : 'User')

  const submitReply = () => {
    if (!canSend) return
    const payload: SupportMessageCreatePayload = {
      scope,
      ticketId,
      sender_type: scope === 'admin' ? 'admin' : 'user',
      body: body.trim(),
      attachments: uploaderRef.current?.getAttachments() ?? [],
      lang: viewerLang,
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
    sendMutation.mutate({
      ...payload,
      client_request_id: submissionRef.current.id,
    })
  }

  return (
    <div className='bg-card flex h-full min-h-0 flex-col rounded-xl border'>
      <div className='space-y-2 border-b px-3 py-2.5'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <h3 className='text-sm font-semibold break-words'>
              {ticket.title}
            </h3>
            <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs'>
              <span>#{ticket.id}</span>
              <span>·</span>
              <span>{formatDateTime.format(new Date(ticket.created_at))}</span>
              {scope === 'admin' && ticket.user_id > 0 && (
                <>
                  <span>·</span>
                  <Link
                    to='/users'
                    search={{ filter: String(ticket.user_id) }}
                    className='hover:text-foreground inline-flex items-center gap-1 underline-offset-2 hover:underline'
                  >
                    {ticket.display_name ||
                      ticket.username ||
                      `${t('User')} #${ticket.user_id}`}
                    <ExternalLink className='size-3' />
                  </Link>
                </>
              )}
              {isOwnTicket && (
                <Badge variant='outline' className='h-4 px-1.5 text-[10px]'>
                  {t('Your user account')}
                </Badge>
              )}
            </div>
          </div>
          <div className='flex shrink-0 items-center gap-1.5'>
            {scope === 'user' && ticket.status !== 'closed' && (
              <Button
                type='button'
                size='sm'
                variant='outline'
                disabled={ticketUpdateMutation.isPending}
                onClick={() =>
                  ticketUpdateMutation.mutate({ status: 'closed' })
                }
              >
                {t('Close')}
              </Button>
            )}
            {scope === 'user' && ticket.status === 'closed' && (
              <>
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  disabled={ticketUpdateMutation.isPending}
                  onClick={() =>
                    ticketUpdateMutation.mutate({ status: 'open' })
                  }
                >
                  <RotateCcw data-icon='inline-start' />
                  {t('Reopen')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  variant='destructive'
                  disabled={deleteMutation.isPending}
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 data-icon='inline-start' />
                  {t('Delete')}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-1.5'>
          <TicketStatusBadge
            status={ticket.status}
            scope={scope}
            className='h-4 px-1.5 text-[10px]'
          />
          <TicketCategoryBadge
            category={ticket.category}
            className='h-4 px-1.5 text-[10px]'
          />
          <TicketVerificationBadge
            level={ticket.verification_level}
            className='h-4 px-1.5 text-[10px]'
          />
        </div>

        {scope === 'admin' && (
          <div className='flex flex-wrap items-center gap-2'>
            <Select
              value={ticket.priority}
              onValueChange={(value) =>
                ticketUpdateMutation.mutate({
                  priority: value as TicketPriority,
                })
              }
            >
              <SelectTrigger size='sm' className='w-36'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORT_PRIORITY_OPTIONS.filter(
                  (option) => option.value !== 'all'
                ).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={ticket.status}
              onValueChange={(value) =>
                ticketUpdateMutation.mutate({ status: value as TicketStatus })
              }
            >
              <SelectTrigger size='sm' className='w-44'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADMIN_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {ticket.reply_channel && (
          <p className='text-muted-foreground text-xs'>
            {t('Reply method')}: {ticket.reply_channel}
            {ticket.reply_target ? ` · ${ticket.reply_target}` : ''}
          </p>
        )}
      </div>

      <div className='min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3'>
        {olderCursor && (
          <div className='flex justify-center'>
            <Button
              type='button'
              size='xs'
              variant='outline'
              disabled={isLoadingOlder}
              onClick={() => void loadOlder()}
            >
              {isLoadingOlder && (
                <Loader2 className='animate-spin' data-icon='inline-start' />
              )}
              {t('Load earlier messages')}
            </Button>
          </div>
        )}
        {messages.map((message) => {
          const mine =
            (scope === 'admin' && message.sender_type === 'admin') ||
            (scope === 'user' && message.sender_type === 'user')
          const eligible =
            props.translationEnabled &&
            !!message.sender_lang &&
            toWorkerLanguage(message.sender_lang) !== viewerLang
          return (
            <div
              key={message.id}
              className={mine ? 'flex justify-end' : 'flex justify-start'}
            >
              <div
                className={
                  mine
                    ? 'bg-primary/5 max-w-[85%] space-y-1.5 rounded-lg border px-3 py-2'
                    : 'bg-muted/50 max-w-[85%] space-y-1.5 rounded-lg border px-3 py-2'
                }
              >
                <div className='text-muted-foreground flex items-center gap-2 text-[11px]'>
                  <span className='font-medium'>{senderName(message)}</span>
                  <span>
                    {formatDateTime.format(new Date(message.created_at))}
                  </span>
                </div>
                <MessageBody
                  body={message.body}
                  translation={translations[message.id]}
                  eligible={eligible}
                  canCorrect={scope === 'admin'}
                  isTranslating={
                    translateMutation.isPending &&
                    translateMutation.variables.messageId === message.id &&
                    translateMutation.variables.language === viewerLang
                  }
                  onTranslate={() =>
                    translateMutation.mutateAsync({
                      messageId: message.id,
                      language: viewerLang,
                    })
                  }
                  onCorrect={() => setCorrecting(message)}
                />
                {message.attachments.length > 0 && (
                  <AttachmentStrip
                    attachments={message.attachments}
                    session={session}
                    ticketId={ticketId}
                    scope={scope}
                  />
                )}
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className='space-y-2 border-t px-3 py-2.5'>
        {ticket.status === 'closed' && (
          <p className='text-muted-foreground text-xs'>
            {t('Sending a reply will reopen this ticket.')}
          </p>
        )}
        {scope === 'admin' && (
          <p className='text-muted-foreground text-xs'>
            {t('Replying as support staff.')}
          </p>
        )}
        <AttachmentUploader
          ref={uploaderRef}
          session={session}
          disabled={sendMutation.isPending}
          onUploadingChange={setIsUploading}
        />
        <div className='flex items-end gap-2'>
          <Textarea
            aria-label={t('Write a reply...')}
            value={body}
            rows={2}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                submitReply()
              }
            }}
            onPaste={(event) => {
              handleImagePaste(event, (files) =>
                uploaderRef.current?.addFiles(files)
              )
            }}
            onDrop={(event) => {
              handleImageDrop(event, (files) =>
                uploaderRef.current?.addFiles(files)
              )
            }}
            placeholder={t('Write a reply...')}
            className='min-h-16 flex-1'
          />
          <Button
            type='button'
            size='icon'
            disabled={!canSend}
            aria-label={t('Send')}
            onClick={submitReply}
          >
            {sendMutation.isPending ? (
              <Loader2 className='animate-spin' />
            ) : (
              <ArrowUp />
            )}
          </Button>
        </div>
      </div>

      <TranslationDialog
        open={!!correcting}
        onOpenChange={(open) => {
          if (!open) setCorrecting(null)
        }}
        message={correcting}
        translation={correcting ? translations[correcting.id] : undefined}
        languageLabel={getViewerLanguageLabel(i18n.language)}
        isSaving={correctMutation.isPending}
        onSave={(text) => {
          if (correcting) {
            correctMutation.mutate({
              messageId: correcting.id,
              body: text,
              language: viewerLang,
            })
          }
        }}
      />

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t('Delete ticket')}
        desc={t(
          'This will permanently delete this ticket and its messages. This action cannot be undone.'
        )}
        confirmText={t('Delete')}
        destructive
        isLoading={deleteMutation.isPending}
        handleConfirm={() => deleteMutation.mutate()}
      />
    </div>
  )
}

function mergeMessages(
  older: SupportMessage[],
  latest: SupportMessage[]
): SupportMessage[] {
  const seen = new Set<number>()
  const merged: SupportMessage[] = []
  for (const message of [...older, ...latest]) {
    if (seen.has(message.id)) continue
    seen.add(message.id)
    merged.push(message)
  }
  return merged
}
