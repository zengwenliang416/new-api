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
  BarChartIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  NotepadTextIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSystemConfig } from '@/hooks/use-system-config'

type PlaygroundEmptyStateProps = {
  onSelectPrompt: (prompt: string) => void
}

const starterPrompts = [
  { icon: BarChartIcon, text: 'Analyze data' },
  { icon: NotepadTextIcon, text: 'Summarize text' },
  { icon: CodeSquareIcon, text: 'Code' },
  { icon: GraduationCapIcon, text: 'Get advice' },
]

export function PlaygroundEmptyState({
  onSelectPrompt,
}: PlaygroundEmptyStateProps) {
  const { t } = useTranslation()
  const { logo, systemName } = useSystemConfig()

  return (
    <div className='flex min-h-[min(520px,calc(100svh-18rem))] items-center justify-center px-1 py-8 md:py-12'>
      <div className='flex w-full max-w-2xl min-w-0 flex-col items-center text-center'>
        <img
          src={logo}
          alt={systemName}
          className='mb-7 size-14 object-contain'
        />

        <div className='mb-3 grid gap-5'>
          <h2 className='text-xl font-semibold tracking-tight text-balance'>
            {t('What would you like to ask today?')}
          </h2>
          <p className='text-muted-foreground text-sm font-medium'>
            {t('Quick questions')}
          </p>
        </div>

        <div
          role='group'
          aria-label={t('Quick questions')}
          className='flex w-full min-w-0 flex-col items-center gap-2'
        >
          {starterPrompts.map(({ icon: Icon, text }) => {
            const prompt = t(text)

            return (
              <Button
                className='h-auto min-h-9 max-w-full justify-center gap-2 rounded-none px-3 py-2 text-center text-xs leading-5 whitespace-normal shadow-none'
                key={text}
                onClick={() => onSelectPrompt(prompt)}
                variant='outline'
              >
                <Icon
                  className='text-muted-foreground size-3.5 shrink-0'
                  aria-hidden='true'
                />
                <span className='min-w-0 break-words'>{prompt}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
