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
import { api } from '@/lib/api'
import { requireServerSuccess } from '@/lib/server-error-message'

import type { ProbeOverview, ProbeRun } from './intelligence-types'

interface ProbeResponse<T> {
  success: boolean
  message?: string
  data: T
}

export async function getProbeOverview(
  hours: number,
  lang: string,
  signal?: AbortSignal
): Promise<ProbeOverview> {
  const response = await api.get<ProbeResponse<ProbeOverview>>(
    '/api/model_probe/overview',
    {
      params: { hours, lang },
      signal,
      disableDuplicate: true,
    }
  )
  return requireServerSuccess(response.data).data
}

export async function getProbeRun(
  id: number,
  lang: string,
  signal?: AbortSignal
): Promise<ProbeRun> {
  const response = await api.get<ProbeResponse<ProbeRun>>(
    `/api/model_probe/runs/${id}`,
    {
      params: { lang },
      signal,
      disableDuplicate: true,
    }
  )
  return requireServerSuccess(response.data).data
}

export async function getProbeArtifact(
  id: number,
  signal?: AbortSignal
): Promise<{ html: string }> {
  const response = await api.get<ProbeResponse<{ html: string }>>(
    `/api/model_probe/artifact/${id}`,
    { signal, disableDuplicate: true }
  )
  return requireServerSuccess(response.data).data
}

export async function startProbe(): Promise<{
  task_id: string
  created: boolean
  run_ids: number[]
}> {
  const response = await api.post<
    ProbeResponse<{ task_id: string; created: boolean; run_ids: number[] }>
  >('/api/model_probe/admin/run', {})
  return requireServerSuccess(response.data).data
}
