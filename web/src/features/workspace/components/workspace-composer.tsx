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
import { MessageSquare, Paperclip, Send } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
import { PlaygroundParameterPanel } from '@/features/playground/components/input/playground-parameter-panel'
import {
  DEFAULT_CONFIG,
  DEFAULT_PARAMETER_ENABLED,
} from '@/features/playground/constants'

interface WorkspaceComposerProps {
  draft: string
  onDraftChange: (text: string) => void
  modeControls?: ReactNode
}

export function WorkspaceComposer(props: WorkspaceComposerProps) {
  const { t } = useTranslation()
  const [config, setConfig] = useState({
    ...DEFAULT_CONFIG,
    model: 'preview-model',
    group: 'preview-group',
  })
  const [parameterEnabled, setParameterEnabled] = useState({
    ...DEFAULT_PARAMETER_ENABLED,
  })

  return (
    <div className='w-full shrink-0 p-3 sm:p-4'>
      <PromptInput
        maxFiles={0}
        onSubmit={() => undefined}
        onSubmitCapture={(event) => {
          event.preventDefault()
          event.stopPropagation()
        }}
        groupClassName='rounded-sm border-border bg-background shadow-none focus-within:ring-1 focus-within:ring-primary/20'
      >
        <PromptInputTextarea
          aria-label={t('Message')}
          placeholder={t('Ask anything')}
          className='min-h-14 px-4 pt-3 pb-2 text-base sm:text-sm'
          value={props.draft}
          onChange={(event) => props.onDraftChange(event.target.value)}
        />
        <PromptInputFooter className='flex-wrap gap-2 px-2 pb-2'>
          <PromptInputTools className='min-w-0 flex-1 flex-wrap gap-2'>
            {props.modeControls ?? (
              <span className='bg-muted flex h-8 items-center gap-1.5 rounded-sm px-2 text-xs font-medium'>
                <MessageSquare className='size-3.5' aria-hidden='true' />
                {t('Chat')}
              </span>
            )}
            <PromptInputButton disabled aria-label={t('Attach')}>
              <Paperclip className='size-4' aria-hidden='true' />
            </PromptInputButton>
            <ModelGroupSelector
              selectedModel={config.model}
              models={[{ label: t('Preview model'), value: 'preview-model' }]}
              onModelChange={(model) =>
                setConfig((current) => ({ ...current, model }))
              }
              selectedGroup={config.group}
              groups={[{ label: t('Preview group'), value: 'preview-group' }]}
              onGroupChange={(group) =>
                setConfig((current) => ({ ...current, group }))
              }
            />
            <PlaygroundParameterPanel
              config={config}
              onConfigChange={(key, value) =>
                setConfig((current) => ({ ...current, [key]: value }))
              }
              onParameterEnabledChange={(key, value) =>
                setParameterEnabled((current) => ({ ...current, [key]: value }))
              }
              parameterEnabled={parameterEnabled}
            />
          </PromptInputTools>
          <PromptInputButton
            disabled
            variant='default'
            className='shrink-0 rounded-sm'
          >
            <Send className='size-4' aria-hidden='true' />
            <span>{t('Send')}</span>
          </PromptInputButton>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
