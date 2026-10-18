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
import { useCallback } from 'react'

import { useSystemConfigStore } from '@/stores/system-config-store'

import { applyDocTemplate } from './apply-doc-template'
import { useApiBaseUrl } from './use-api-base-url'

export type DocTemplateOptions = {
  maskKey?: boolean
}

export function useDocTemplate() {
  const siteName = useSystemConfigStore((state) => state.config.systemName)
  const baseUrl = useApiBaseUrl()
  return useCallback(
    (content: string, options?: DocTemplateOptions) =>
      applyDocTemplate(content, {
        siteName,
        baseUrl,
        maskKey: options?.maskKey,
      }),
    [siteName, baseUrl]
  )
}
