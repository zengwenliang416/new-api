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
import {
  ArrowUpRight01Icon,
  Key01Icon,
  Route01Icon,
  CodeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

import {
  AUTH_HEADER_FIELDS,
  AUTH_JSON_HEADER_FIELDS,
} from '../data/api-endpoints'
import type { ApiEndpoint, EndpointField } from '../lib/types'
import { EndpointFieldList } from './endpoint-fields'

type EndpointBaseUrlCardProps = {
  apiBaseUrl: string
  endpoint: ApiEndpoint
  endpointUrl: string
}

export function EndpointBaseUrlCard(props: EndpointBaseUrlCardProps) {
  const { t } = useTranslation()
  const { endpoint, apiBaseUrl, endpointUrl } = props
  let authFields: EndpointField[]
  if (endpoint.contentType === 'none') {
    authFields = AUTH_HEADER_FIELDS
  } else if (endpoint.contentType === 'multipart/form-data') {
    authFields = [
      AUTH_HEADER_FIELDS[0],
      {
        name: 'Content-Type',
        type: 'multipart/form-data',
        required: true,
        location: 'header',
        descriptionKey:
          'Use multipart form data for endpoints that upload binary files.',
      },
    ]
  } else {
    authFields = AUTH_JSON_HEADER_FIELDS
  }
  const hasPathFields = (endpoint.pathFields?.length ?? 0) > 0

  return (
    <Card className='overflow-hidden'>
      <div className='bg-muted/60 border-b px-4 py-2 text-center'>
        <code className='text-muted-foreground text-xs'>{apiBaseUrl}</code>
      </div>
      <CardHeader className='gap-4'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-center gap-3'>
            <Badge variant='secondary'>{endpoint.method}</Badge>
            <code className='min-w-0 overflow-x-auto font-mono text-sm'>
              {endpoint.path}
            </code>
          </div>
          <Button
            variant='secondary'
            size='sm'
            render={
              <a href={endpointUrl} target='_blank' rel='noopener noreferrer' />
            }
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon='inline-start' />
            {t('Open')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className='p-0'>
        <Accordion className='border-t px-4'>
          <AccordionItem value='authorization'>
            <AccordionTrigger className='hover:no-underline'>
              <div className='flex items-center gap-2'>
                <HugeiconsIcon icon={Key01Icon} className='size-4' />
                <span>{t('Authorization')}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <EndpointFieldList fields={authFields} />
            </AccordionContent>
          </AccordionItem>
          {hasPathFields ? (
            <AccordionItem value='path-parameters'>
              <AccordionTrigger className='hover:no-underline'>
                <div className='flex items-center gap-2'>
                  <HugeiconsIcon icon={Route01Icon} className='size-4' />
                  <span>{t('Path parameters')}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <EndpointFieldList fields={endpoint.pathFields ?? []} />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          {(endpoint.queryFields?.length ?? 0) > 0 ? (
            <AccordionItem value='query-parameters'>
              <AccordionTrigger>{t('Query parameters')}</AccordionTrigger>
              <AccordionContent>
                <EndpointFieldList fields={endpoint.queryFields ?? []} />
              </AccordionContent>
            </AccordionItem>
          ) : null}
          <AccordionItem value='request-body'>
            <AccordionTrigger className='hover:no-underline'>
              <div className='flex items-center gap-2'>
                <HugeiconsIcon icon={CodeIcon} className='size-4' />
                <span>{t('Request Body')}</span>
              </div>
              <Badge variant='outline'>
                {endpoint.contentType === 'none'
                  ? t('No request body')
                  : endpoint.contentType}
              </Badge>
            </AccordionTrigger>
            <AccordionContent>
              <EndpointFieldList fields={endpoint.requestFields} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
