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
import { ArrowUpRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import type { ApiEndpoint } from '../lib/types'
import { AiDocsCard } from './ai-docs-card'
import { EndpointBaseUrlCard } from './endpoint-base-url-card'
import { EndpointInvocationDetails } from './endpoint-invocation-details'

type EndpointDetailProps = {
  aiDocsFullUrl: string
  aiDocsIndexUrl: string
  apiBaseUrl: string
  endpoint: ApiEndpoint
  endpointMarkdown: string
  endpointUrl: string
}

export function EndpointDetail(props: EndpointDetailProps) {
  const { t } = useTranslation()
  const { endpoint } = props

  return (
    <article
      id='docs-article'
      className='min-w-0 px-4 py-8 lg:px-8 xl:min-h-0 xl:overflow-y-auto xl:px-10'
    >
      <div className='mx-auto flex max-w-4xl flex-col gap-8'>
        <section className='flex flex-col gap-5'>
          <div className='flex flex-col gap-4'>
            <div className='flex flex-col gap-3'>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='secondary'>{endpoint.method}</Badge>
              </div>
              <h1 className='text-3xl font-semibold tracking-tight text-balance'>
                {t(endpoint.titleKey)}
              </h1>
              <p className='text-muted-foreground max-w-3xl text-base leading-7 text-pretty'>
                {t(endpoint.descriptionKey)}
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <CopyButton
                value={props.endpointMarkdown}
                size='sm'
                variant='outline'
                tooltip={t('Copy Markdown')}
                successTooltip={t('Markdown copied')}
                aria-label={t('Copy Markdown')}
              >
                {t('Copy Markdown')}
              </CopyButton>
              <Button
                variant='outline'
                size='sm'
                render={
                  <a
                    href={props.endpointUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                  />
                }
              >
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  data-icon='inline-start'
                />
                {t('Open endpoint')}
              </Button>
            </div>
          </div>
          <AiDocsCard
            indexUrl={props.aiDocsIndexUrl}
            fullUrl={props.aiDocsFullUrl}
          />
        </section>
        <EndpointBaseUrlCard
          endpoint={endpoint}
          apiBaseUrl={props.apiBaseUrl}
          endpointUrl={props.endpointUrl}
        />
        <EndpointInvocationDetails endpoint={endpoint} />
      </div>
    </article>
  )
}
