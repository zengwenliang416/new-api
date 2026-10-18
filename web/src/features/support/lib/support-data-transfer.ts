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
import type { ClipboardEvent, DragEvent } from 'react'

/** Files carried by a clipboard paste event, if any. */
export function getClipboardFiles(event: ClipboardEvent<HTMLElement>): File[] {
  const data = event.clipboardData
  if (!data) return []
  const files: File[] = []
  for (const item of data.items) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) files.push(file)
  }
  return files
}

/** Files carried by a drag event, if any. */
export function getDataTransferFiles(
  dataTransfer: DataTransfer | null
): File[] {
  if (!dataTransfer) return []
  return [...dataTransfer.files]
}

/**
 * Shared paste handler: intercepts clipboard images while leaving plain text
 * pastes to the browser. Returns true when image files were handled.
 */
export function handleImagePaste(
  event: ClipboardEvent<HTMLElement>,
  onFiles: (files: File[]) => void
): boolean {
  if (event.defaultPrevented) return false
  const files = getClipboardFiles(event)
  if (files.length === 0) return false
  event.stopPropagation()
  if (!event.clipboardData?.getData('text/plain').trim()) {
    event.preventDefault()
  }
  onFiles(files)
  return true
}

/** Shared drop handler for image drag-and-drop. */
export function handleImageDrop(
  event: DragEvent<HTMLElement>,
  onFiles: (files: File[]) => void
): boolean {
  if (event.defaultPrevented) return false
  const files = getDataTransferFiles(event.dataTransfer)
  if (files.length === 0) return false
  event.preventDefault()
  onFiles(files)
  return true
}
