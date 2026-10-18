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
  Key01Icon,
  RefreshIcon,
  ServerStack01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { ApiEndpoint } from '../lib/types'

type InvocationIconCardProps = {
  description: string
  icon: ReactNode
  title: string
}

function InvocationIconCard(props: InvocationIconCardProps) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-center gap-2 text-sm font-medium'>
        {props.icon}
        {props.title}
      </div>
      <p className='text-muted-foreground mt-2 text-sm leading-6'>
        {props.description}
      </p>
    </div>
  )
}

type EndpointInvocationDetailsProps = {
  endpoint: ApiEndpoint
}

export function EndpointInvocationDetails(
  props: EndpointInvocationDetailsProps
) {
  const { t } = useTranslation()
  const { endpoint } = props

  return (
    <section id='invocation-details' className='flex flex-col gap-5'>
      <div className='flex flex-col gap-2'>
        <h2 className='text-2xl font-semibold tracking-tight'>
          {t('Invocation details')}
        </h2>
        <p className='text-muted-foreground max-w-3xl text-sm leading-6'>
          {t(
            'These notes explain how the gateway handles authentication, routing, and response shape for this endpoint.'
          )}
        </p>
      </div>
      <div className='grid gap-3 md:grid-cols-3'>
        <InvocationIconCard
          icon={
            <HugeiconsIcon
              icon={Key01Icon}
              className='size-4'
              aria-hidden='true'
            />
          }
          title={t('Authentication')}
          description={
            endpoint.auth === 'session-or-bearer'
              ? t(
                  'This route accepts either a dashboard session or an API token.'
                )
              : t(
                  'This route requires an API token in the Authorization header.'
                )
          }
        />
        <InvocationIconCard
          icon={
            <HugeiconsIcon
              icon={RefreshIcon}
              className='size-4'
              aria-hidden='true'
            />
          }
          title={t('Relay format')}
          description={t(endpoint.formatKey)}
        />
        <InvocationIconCard
          icon={
            <HugeiconsIcon
              icon={ServerStack01Icon}
              className='size-4'
              aria-hidden='true'
            />
          }
          title={t('Response type')}
          description={endpoint.responseType}
        />
      </div>
      <div className='flex flex-col gap-3'>
        {endpoint.analysisKeys.map((analysisKey) => (
          <div
            key={analysisKey}
            className='bg-muted/35 rounded-lg border px-3 py-2 text-sm leading-6'
          >
            {t(analysisKey)}
          </div>
        ))}
      </div>
    </section>
  )
}
