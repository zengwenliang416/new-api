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
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { handleServerError } from '@/lib/handle-server-error'

const deploymentReleaseSchema = z.object({
  current_image: z.string(),
  previous_image: z.string(),
  current_version: z.string(),
  previous_version: z.string(),
  rollback_available: z.boolean(),
  rollback_state: z.enum(['idle', 'running', 'succeeded', 'failed']),
  unavailable_reason: z.string(),
})

type DeploymentRelease = z.infer<typeof deploymentReleaseSchema>

const emptyRelease: DeploymentRelease = {
  current_image: '',
  previous_image: '',
  current_version: '',
  previous_version: '',
  rollback_available: false,
  rollback_state: 'idle',
  unavailable_reason: 'not_configured',
}

const deploymentReleaseQueryKey = ['deployment-release'] as const
const rollbackWaitMs = 8 * 60 * 1000

async function loadDeploymentRelease(): Promise<DeploymentRelease> {
  const res = await api.get('/api/deploy/release')
  const body = res.data as { success?: boolean; data?: unknown }
  if (!body?.success) return emptyRelease
  const parsed = deploymentReleaseSchema.safeParse(body.data)
  return parsed.success ? parsed.data : emptyRelease
}

export function DeploymentReleasePanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const startedAt = useRef(0)
  const targetImage = useRef('')
  const query = useQuery({
    queryKey: deploymentReleaseQueryKey,
    queryFn: loadDeploymentRelease,
    retry: false,
    meta: { errorToast: false },
    refetchInterval: waiting ? 2000 : false,
  })
  const release = query.data ?? emptyRelease
  const rollback = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/deploy/rollback')
      const body = res.data as { success?: boolean; message?: string }
      if (!body?.success) {
        throw new Error(body?.message || 'Rollback failed.')
      }
    },
    onSuccess: () => {
      startedAt.current = Date.now()
      targetImage.current = release.previous_image
      setWaiting(true)
      setConfirmOpen(false)
      void queryClient.invalidateQueries({
        queryKey: deploymentReleaseQueryKey,
      })
    },
    onError: (error) => {
      handleServerError(error, t('Rollback failed.'))
    },
    meta: { errorToast: false },
  })

  useEffect(() => {
    if (!waiting) return
    if (Date.now() - startedAt.current > rollbackWaitMs) {
      setWaiting(false)
      toast.error(t('Rollback failed.'))
      return
    }
    if (release.rollback_state === 'failed') {
      setWaiting(false)
      toast.error(t('Rollback failed.'))
      return
    }
    const switched =
      targetImage.current !== '' && release.current_image === targetImage.current
    if (release.rollback_state === 'succeeded' || switched) {
      setWaiting(false)
      toast.success(t('The API is running the previous image.'))
    }
  }, [release, t, waiting])

  let unavailable = ''
  if (release.unavailable_reason === 'not_configured') {
    unavailable = t('Rollback is not configured on this server.')
  } else if (!release.rollback_available && !waiting) {
    unavailable = t('No previous image is available.')
  }
  const pending = waiting || rollback.isPending || release.rollback_state === 'running'

  return (
    <div className='space-y-4'>
      <div className='grid gap-4 md:grid-cols-2'>
        <div className='min-w-0 rounded-lg border p-4'>
          <div className='text-muted-foreground text-sm'>{t('Current image')}</div>
          <div className='text-sm font-medium break-all'>
            {release.current_image || t('Unknown')}
          </div>
        </div>
        <div className='min-w-0 rounded-lg border p-4'>
          <div className='text-muted-foreground text-sm'>{t('Previous image')}</div>
          <div className='text-sm font-medium break-all'>
            {release.previous_image || t('Unknown')}
          </div>
        </div>
      </div>
      {unavailable && (
        <p className='text-muted-foreground text-sm'>{unavailable}</p>
      )}
      <Button
        type='button'
        variant='destructive'
        disabled={!release.rollback_available || pending}
        onClick={() => setConfirmOpen(true)}
      >
        {pending ? t('Switching image...') : t('Switch to the previous image')}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        destructive
        title={t('Switch to the previous image')}
        desc={t(
          'This restarts the API on the previous image. MySQL and stored data stay in place.'
        )}
        confirmText={t('Switch to the previous image')}
        isLoading={rollback.isPending}
        handleConfirm={() => rollback.mutate()}
      />
    </div>
  )
}
