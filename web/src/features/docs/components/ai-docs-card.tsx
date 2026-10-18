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
import { ArrowUpRight01Icon, Link01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type AiDocsCardProps = {
  fullUrl: string
  indexUrl: string
}

export function AiDocsCard(props: AiDocsCardProps) {
  const { t } = useTranslation()

  return (
    <Card className='bg-muted/25'>
      <CardContent className='flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 gap-3'>
          <div className='bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border'>
            <HugeiconsIcon icon={Link01Icon} className='size-4' />
          </div>
          <div className='flex min-w-0 flex-col gap-1'>
            <h2 className='text-sm font-medium'>
              {t('AI-ready documentation')}
            </h2>
            <p className='text-muted-foreground max-w-2xl text-sm leading-6'>
              {t(
                'Share this public guide and API reference with an AI assistant. Live account data and model availability are not included.'
              )}
            </p>
            <code className='text-muted-foreground font-mono text-xs break-all'>
              {props.fullUrl}
            </code>
          </div>
        </div>
        <div className='flex shrink-0 flex-wrap gap-2'>
          <CopyButton
            value={props.fullUrl}
            size='sm'
            variant='default'
            tooltip={t('Copy AI context link')}
            successTooltip={t('AI context link copied')}
            aria-label={t('Copy AI context link')}
          >
            {t('Copy AI link')}
          </CopyButton>
          <Button
            variant='outline'
            size='sm'
            render={
              <a
                href={props.indexUrl}
                target='_blank'
                rel='noopener noreferrer'
              />
            }
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon='inline-start' />
            {t('Open AI index')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
