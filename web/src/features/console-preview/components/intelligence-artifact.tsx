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
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { EmptyState } from '@/components/empty-state'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'

import { getProbeArtifact } from '../intelligence-api'
import { createProbeArtifactDocument } from '../intelligence-artifact-document'

export function IntelligenceArtifact(props: { runId: number }) {
  const { t } = useTranslation()
  const artifact = useQuery({
    meta: { errorRedirect: false },
    queryKey: ['model-probe-artifact', props.runId],
    queryFn: ({ signal }) => getProbeArtifact(props.runId, signal),
    staleTime: Infinity,
  })
  const srcDoc = useMemo(
    () =>
      artifact.data ? createProbeArtifactDocument(artifact.data.html) : null,
    [artifact.data]
  )

  if (artifact.isPending) return <LoadingState size='sm' />
  if (artifact.isError) {
    return (
      <ErrorState
        title={t('Could not load the drawing')}
        onRetry={() => void artifact.refetch()}
      />
    )
  }
  if (!srcDoc) {
    return <EmptyState title={t('No drawing available')} className='min-h-48' />
  }

  return (
    <iframe
      title={t('Model drawing')}
      srcDoc={srcDoc}
      sandbox=''
      referrerPolicy='no-referrer'
      className='h-64 w-full border-0'
    />
  )
}
