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
import { skipToken, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toIntlLocale } from '@/i18n/languages'
import { formatNumber, formatTimestamp } from '@/lib/format'

import { getProbeRun } from '../intelligence-api'
import { IntelligenceArtifact } from './intelligence-artifact'
import { ProbeStatusBadge } from './intelligence-timeline'

export function IntelligenceRunDialog(props: {
  runId: number | null
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.resolvedLanguage || i18n.language
  const locale = toIntlLocale(lang)
  const runId = props.runId
  const run = useQuery({
    meta: { errorRedirect: false },
    queryKey: ['model-probe-run', props.runId, lang],
    queryFn:
      runId === null
        ? skipToken
        : ({ signal }) => getProbeRun(runId, lang, signal),
    enabled: props.runId !== null,
    refetchInterval: (query) =>
      query.state.data?.status === 'running' ? 3000 : false,
  })
  const data = run.data

  return (
    <Dialog
      open={props.runId !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Check details')}
      description={
        data
          ? `${data.group_name || data.group} · ${data.model} · ${formatTimestamp(data.started_at)}`
          : t('Loading the check record…')
      }
    >
      {run.isPending && <LoadingState />}
      {run.isError && (
        <ErrorState
          title={t('Could not load the check record')}
          onRetry={() => void run.refetch()}
        />
      )}
      {data && (
        <div className='min-w-0 space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <ProbeStatusBadge status={data.status} />
            <Badge variant='outline'>
              {data.kind === 'math' ? t('Logic test') : t('Drawing test')}
            </Badge>
            <span className='text-muted-foreground text-xs'>
              {t('Duration')}: {formatNumber(data.latency_ms / 1000, locale)} s
            </span>
            <span className='text-muted-foreground text-xs'>
              {t('First token')}: {formatNumber(data.first_token_ms, locale)} ms
            </span>
          </div>
          <dl className='grid grid-cols-2 gap-3 text-xs sm:grid-cols-4'>
            <div>
              <dt className='text-muted-foreground'>{t('Input tokens')}</dt>
              <dd>{formatNumber(data.prompt_tokens, locale)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>{t('Output tokens')}</dt>
              <dd>{formatNumber(data.completion_tokens, locale)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>{t('Attempts')}</dt>
              <dd>{formatNumber(data.attempts, locale)}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>{t('Reasoning effort')}</dt>
              <dd>{data.effort || '—'}</dd>
            </div>
          </dl>
          {data.status === 'error' && (
            <p
              role='status'
              className='text-sm text-amber-700 dark:text-amber-400'
            >
              {t(
                'The request failed. This result is excluded from the quality pass rate.'
              )}{' '}
              {data.error_kind && <code>{data.error_kind}</code>}
            </p>
          )}
          {data.kind === 'math' && data.answer && (
            <p className='text-sm'>
              {t('Detected answer')}: <strong>{data.answer}</strong>
            </p>
          )}
          <Tabs defaultValue='question'>
            <TabsList
              aria-label={t('Check details')}
              className='max-w-full overflow-x-auto'
            >
              <TabsTrigger value='question'>{t('Test question')}</TabsTrigger>
              <TabsTrigger value='response'>{t('Model response')}</TabsTrigger>
              {data.artifact_bytes > 0 && (
                <TabsTrigger value='drawing'>{t('Drawing')}</TabsTrigger>
              )}
            </TabsList>
            <TabsContent value='question'>
              <pre className='bg-muted/40 mt-3 max-h-96 overflow-auto rounded-md p-4 text-xs break-words whitespace-pre-wrap'>
                {data.prompt || t('No question recorded')}
              </pre>
            </TabsContent>
            <TabsContent value='response'>
              <pre className='bg-muted/40 mt-3 max-h-96 overflow-auto rounded-md p-4 text-xs break-words whitespace-pre-wrap'>
                {data.output_text || t('No response recorded')}
              </pre>
            </TabsContent>
            {data.artifact_bytes > 0 && (
              <TabsContent value='drawing'>
                <IntelligenceArtifact runId={data.id} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}
    </Dialog>
  )
}
