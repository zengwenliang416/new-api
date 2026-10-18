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
import { useEffect, useState } from 'react'

import { fetchSupportAttachmentBlob } from '../api'
import type { SupportAttachment, SupportScope, SupportSession } from '../types'

interface UseAttachmentSourceParams {
  attachment: SupportAttachment
  session: SupportSession | null
  ticketId?: number
  scope?: SupportScope
}

interface UseAttachmentSourceResult {
  failed: boolean
  source: string
}

/**
 * Resolve the display URL of an attachment. Uploaded files carry a local
 * preview URL; attachments without a URL are fetched from the worker as a
 * blob and exposed through an object URL.
 */
export function useAttachmentSource(
  params: UseAttachmentSourceParams
): UseAttachmentSourceResult {
  const { attachment, session, ticketId, scope } = params
  const [fetched, setFetched] = useState<{ key: string; url: string } | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  const fetchedUrl = fetched?.key === attachment.key ? fetched.url : ''
  const source = attachment.preview_url || fetchedUrl || attachment.url || ''

  useEffect(() => {
    setFailed(false)
    setFetched(null)
    if (
      attachment.preview_url ||
      attachment.url ||
      !attachment.id ||
      !session ||
      !ticketId ||
      !scope
    ) {
      return
    }
    let active = true
    let objectUrl = ''
    fetchSupportAttachmentBlob(session, {
      ticketId,
      attachmentId: attachment.id,
      scope,
    })
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setFetched({ key: attachment.key, url: objectUrl })
      })
      .catch(() => {
        if (active) setFailed(true)
      })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [
    attachment.id,
    attachment.key,
    attachment.preview_url,
    attachment.url,
    session,
    ticketId,
    scope,
  ])

  return { failed, source }
}
