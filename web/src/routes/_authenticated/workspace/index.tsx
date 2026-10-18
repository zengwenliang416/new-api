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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { ImageIcon, MessageSquare } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { Main } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ImageStudio } from '@/features/image-studio'
import { ImageGallery } from '@/features/image-studio/components/image-gallery'
import { Workspace } from '@/features/workspace'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/workspace/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: WorkspacePage,
})

function WorkspacePage() {
  const { t } = useTranslation()
  const [mode, setMode] = useState('chat')
  const [galleryOpen, setGalleryOpen] = useState(false)
  const modeControls = (
    <ToggleGroup
      value={[mode]}
      onValueChange={(values) => {
        if (values[0]) setMode(values[0])
      }}
      size='sm'
      variant='outline'
      aria-label={t('Mode')}
    >
      <ToggleGroupItem value='chat'>
        <MessageSquare className='size-3.5' aria-hidden='true' />
        {t('Chat')}
      </ToggleGroupItem>
      <ToggleGroupItem value='image'>
        <ImageIcon className='size-3.5' aria-hidden='true' />
        {t('Image generation')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
  return (
    <Main className='p-0 lg:pr-2 lg:pb-2'>
      <Workspace
        headerActions={
          <>
            <Badge variant='outline' className='hidden sm:inline-flex'>
              {t('Preview')}
            </Badge>
            <Button
              size='sm'
              variant='ghost'
              onClick={() => setGalleryOpen(true)}
            >
              <ImageIcon className='size-4' aria-hidden='true' />
              {t('My images')}
            </Button>
          </>
        }
        modeControls={modeControls}
        content={
          mode === 'image' ? (
            <div className='min-h-0 flex-1 overflow-y-auto'>
              <div className='border-b px-4 py-2'>{modeControls}</div>
              <ImageStudio embedded />
            </div>
          ) : undefined
        }
      />
      <Dialog
        open={galleryOpen}
        onOpenChange={setGalleryOpen}
        title={t('My images')}
        description={t(
          'Interface preview. Image generation is not connected yet.'
        )}
      >
        <ImageGallery />
      </Dialog>
    </Main>
  )
}
