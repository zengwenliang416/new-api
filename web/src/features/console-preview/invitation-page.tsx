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
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { EmptyState } from '@/components/empty-state'
import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import { PreviewNotice } from './components/preview-elements'

export function InvitationPage() {
  const { t } = useTranslation()

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Invite friends')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='space-y-4 pb-2'>
          <PreviewNotice />
          <dl
            className='grid grid-cols-1 gap-3 sm:grid-cols-3'
            aria-label={t('Invitation statistics')}
          >
            {[
              t('Invited people'),
              t('Rewards received'),
              t('Reward per person'),
            ].map((label) => (
              <Card
                key={label}
                className='bg-muted/30 rounded-none py-3 shadow-none'
              >
                <CardContent>
                  <dt className='text-muted-foreground text-xs'>{label}</dt>
                  <dd className='mt-2 font-mono text-2xl font-semibold'>—</dd>
                </CardContent>
              </Card>
            ))}
          </dl>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Invitation codes, reward information, and invitation history are shown in this page preview.'
            )}
          </p>
          <Card className='gap-2 rounded-none shadow-none'>
            <CardHeader>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <CardTitle className='text-sm font-semibold'>
                  {t('Invitation and reward rules')}
                </CardTitle>
                <Badge variant='secondary' className='rounded-sm'>
                  {t('Not configured')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ul className='text-muted-foreground list-disc space-y-2 pl-4 text-xs leading-relaxed'>
                <li>
                  {t(
                    'Eligibility requirements will be displayed when the invitation program is configured.'
                  )}
                </li>
                <li>
                  {t(
                    'Reward amounts, validity periods, and review rules have not been set.'
                  )}
                </li>
                <li>
                  {t(
                    'Generating codes and issuing rewards are unavailable in this interface preview.'
                  )}
                </li>
              </ul>
            </CardContent>
          </Card>
          <Card className='gap-0 rounded-none py-0 shadow-none'>
            <CardHeader className='border-b py-5'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1'>
                  <CardTitle className='font-semibold'>
                    {t('My invitation code')}
                  </CardTitle>
                  <CardDescription className='text-xs'>
                    {t('Manage codes for inviting new users.')}
                  </CardDescription>
                </div>
                <Button
                  disabled
                  className='rounded-sm'
                  aria-describedby='invitation-preview-description'
                >
                  {t('Generate invitation code')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className='py-6'>
              <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs'>
                <span id='invitation-preview-description'>
                  {t('Invitation code generation is not connected.')}
                </span>
                <span
                  className='font-mono text-lg tracking-widest'
                  aria-label={t('Invitation code unavailable')}
                >
                  — — — — — —
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className='gap-0 rounded-none py-0 shadow-none'>
            <CardHeader className='border-b py-5'>
              <CardTitle className='font-semibold'>
                {t('People I invited')}
              </CardTitle>
              <CardDescription className='text-xs'>
                {t('Usernames and reward status will appear here.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='px-0'>
              <StaticDataTable
                className='rounded-none border-0'
                tableProps={{ 'aria-label': t('Invitation history') }}
                columns={[
                  { id: 'username', header: t('Username') },
                  { id: 'joined', header: t('Joined at') },
                  { id: 'status', header: t('Reward status') },
                ]}
                data={[]}
                emptyContent={
                  <EmptyState
                    className='min-h-40'
                    title={t('No invitation records')}
                    description={t(
                      'Invitation history is not connected in this preview.'
                    )}
                  />
                }
              />
            </CardContent>
          </Card>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
