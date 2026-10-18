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
import { useMemo } from 'react'

import { useStatus } from '@/hooks/use-status'

export function useApiBaseUrl(): string {
  const { status } = useStatus()
  return useMemo(() => {
    const root =
      status && typeof status === 'object'
        ? (status as Record<string, unknown>)
        : null
    const data =
      root?.data && typeof root.data === 'object'
        ? (root.data as Record<string, unknown>)
        : null
    const candidate =
      root?.server_address ??
      root?.serverAddress ??
      data?.server_address ??
      data?.serverAddress
    let base = typeof candidate === 'string' ? candidate.trim() : ''
    if (!base && typeof window !== 'undefined') {
      base = window.location.origin
    }
    if (!base) {
      base = 'https://api.example.com'
    }
    return base.replace(/\/+$/, '')
  }, [status])
}
