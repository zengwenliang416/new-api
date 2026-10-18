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
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface ConversationNameDialogProps {
  title: string
  onClose: () => void
  onSave: (title: string) => void
}

export function ConversationNameDialog(props: ConversationNameDialogProps) {
  const { t } = useTranslation()
  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, t('Please enter a conversation name.'))
      .max(80, t('Conversation names can contain up to 80 characters.')),
  })
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: props.title },
  })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
      title={t('Rename conversation')}
      contentClassName='sm:max-w-md'
      footer={
        <>
          <Button variant='outline' onClick={props.onClose}>
            {t('Cancel')}
          </Button>
          <Button type='submit' form='workspace-rename-form'>
            {t('Save')}
          </Button>
        </>
      }
    >
      <form
        id='workspace-rename-form'
        onSubmit={form.handleSubmit((values) => props.onSave(values.title))}
        className='grid gap-2'
      >
        <Label htmlFor='workspace-conversation-name'>
          {t('Conversation name')}
        </Label>
        <Input
          id='workspace-conversation-name'
          maxLength={80}
          aria-invalid={!!form.formState.errors.title}
          aria-describedby={
            form.formState.errors.title ? 'workspace-name-error' : undefined
          }
          {...form.register('title')}
        />
        {form.formState.errors.title && (
          <p className='text-destructive text-sm' id='workspace-name-error'>
            {form.formState.errors.title.message}
          </p>
        )}
      </form>
    </Dialog>
  )
}
