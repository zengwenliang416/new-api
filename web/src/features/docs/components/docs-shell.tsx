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
import { SidebarLeftIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import { DocsSidebar } from './docs-sidebar'

type DocsShellProps = {
  active: string
  children: React.ReactNode
}

export function DocsShell(props: DocsShellProps) {
  const { t } = useTranslation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <PublicLayout showMainContainer={false}>
      <div className='flex min-h-svh flex-col pt-16'>
        <div className='bg-background/95 supports-backdrop-filter:bg-background/85 border-b backdrop-blur lg:hidden'>
          <div className='mx-auto flex max-w-[90rem] justify-end px-4 py-3'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setMobileNavOpen(true)}
            >
              <HugeiconsIcon icon={SidebarLeftIcon} data-icon='inline-start' />
              {t('Documentation')}
            </Button>
          </div>
        </div>
        <div className='mx-auto grid w-full max-w-[90rem] flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]'>
          <aside className='bg-sidebar/30 hidden border-r lg:block'>
            <div className='sticky top-16 h-[calc(100svh-4rem)]'>
              <ScrollArea className='h-full'>
                <DocsSidebar active={props.active} />
              </ScrollArea>
            </div>
          </aside>
          <main className='min-w-0 px-4 py-8 lg:px-10'>{props.children}</main>
        </div>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side='left' className='w-[min(20rem,92vw)]'>
            <SheetHeader>
              <SheetTitle>{t('Documentation')}</SheetTitle>
              <SheetDescription>
                {t('Guides, API reference, and site notes.')}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className='min-h-0 flex-1'>
              <DocsSidebar
                active={props.active}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </ScrollArea>
          </SheetContent>
        </Sheet>
      </div>
    </PublicLayout>
  )
}
