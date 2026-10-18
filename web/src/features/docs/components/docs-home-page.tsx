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
  ApiIcon,
  ArrowRight01Icon,
  Rocket01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useStatus } from '@/hooks/use-status'

import { ENDPOINT_MAP } from '../data/api-endpoints'
import { DOCS_GUIDES, GUIDE_CATEGORIES } from '../data/guides'
import { getPublicDocsUrls } from '../lib/public-docs'
import { DocsShell } from './docs-shell'

type FaqItem = {
  answer: string
  question: string
}

function parseFaqItems(status: unknown): FaqItem[] {
  if (!status || typeof status !== 'object') return []
  const record = status as Record<string, unknown>
  const data =
    record.data && typeof record.data === 'object'
      ? (record.data as Record<string, unknown>)
      : null
  const raw = record.faq ?? data?.faq
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        !!item && typeof item === 'object'
    )
    .map((item) => ({
      answer: typeof item.answer === 'string' ? item.answer : '',
      question: typeof item.question === 'string' ? item.question : '',
    }))
    .filter((item) => item.question && item.answer)
}

export function DocsHomePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { status } = useStatus()
  const faqItems = useMemo(() => parseFaqItems(status), [status])
  const { fullUrl: llmsFullUrl } = getPublicDocsUrls(window.location.origin)

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '')
    if (hash && ENDPOINT_MAP[hash]) {
      void navigate({ to: '/docs/api', hash })
    }
  }, [navigate])

  return (
    <DocsShell active='home'>
      <div className='mx-auto flex max-w-4xl flex-col gap-10'>
        <section className='flex flex-col gap-4'>
          <h1 className='text-3xl font-semibold tracking-tight text-balance'>
            {t('Documentation')}
          </h1>
          <p className='text-muted-foreground max-w-2xl text-base leading-7 text-pretty'>
            {t(
              'Everything to get connected: step-by-step tool guides, a full API reference, and troubleshooting for the errors you will actually meet.'
            )}
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button
              render={
                <Link
                  to='/docs/guides/$slug'
                  params={{ slug: 'quick-start' }}
                />
              }
            >
              <HugeiconsIcon icon={Rocket01Icon} data-icon='inline-start' />
              {t('Quick start')}
            </Button>
            <Button variant='outline' render={<Link to='/docs/api' />}>
              <HugeiconsIcon icon={ApiIcon} data-icon='inline-start' />
              {t('API reference')}
            </Button>
          </div>
        </section>
        {GUIDE_CATEGORIES.map((category) => {
          const guides = DOCS_GUIDES.filter(
            (guide) => guide.categoryId === category.id
          )
          if (guides.length === 0) return null
          return (
            <section key={category.id} className='flex flex-col gap-3'>
              <h2 className='flex items-center gap-2 text-lg font-semibold tracking-tight'>
                <HugeiconsIcon
                  icon={category.icon}
                  className='text-primary size-4'
                  aria-hidden='true'
                />
                {t(category.titleKey)}
              </h2>
              <div className='grid gap-3 sm:grid-cols-2'>
                {guides.map((guide) => (
                  <Link
                    key={guide.slug}
                    to='/docs/guides/$slug'
                    params={{ slug: guide.slug }}
                    className='group'
                  >
                    <Card className='hover:border-primary/40 h-full transition-colors'>
                      <CardHeader>
                        <CardTitle className='flex items-center justify-between gap-2 text-base'>
                          <span className='min-w-0 flex-1'>
                            {t(guide.titleKey)}
                          </span>
                          {guide.recommended && (
                            <Badge variant='secondary' className='shrink-0'>
                              {t('Recommended')}
                            </Badge>
                          )}
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className='text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5'
                            aria-hidden='true'
                          />
                        </CardTitle>
                        <CardDescription className='leading-6'>
                          {t(guide.summaryKey)}
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )
        })}
        <section>
          <Card className='bg-muted/25'>
            <CardContent className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex min-w-0 items-start gap-3'>
                <div className='bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border'>
                  <HugeiconsIcon icon={ApiIcon} className='size-4' />
                </div>
                <div className='min-w-0'>
                  <h2 className='text-sm font-medium'>
                    {t('AI-ready documentation')}
                  </h2>
                  <p className='text-muted-foreground text-sm leading-6'>
                    {t(
                      'Share this public guide and API reference with an AI assistant. Live account data and model availability are not included.'
                    )}
                  </p>
                  <code className='text-muted-foreground font-mono text-xs break-all'>
                    {llmsFullUrl}
                  </code>
                </div>
              </div>
              <CopyButton
                value={llmsFullUrl}
                size='sm'
                variant='outline'
                className='shrink-0'
                tooltip={t('Copy AI context link')}
                successTooltip={t('AI context link copied')}
                aria-label={t('Copy AI context link')}
              >
                {t('Copy AI link')}
              </CopyButton>
            </CardContent>
          </Card>
        </section>
        {faqItems.length > 0 && (
          <section className='flex flex-col gap-3'>
            <h2 className='text-lg font-semibold tracking-tight'>{t('FAQ')}</h2>
            <Accordion className='rounded-xl border px-4'>
              {faqItems.map((item, index) => (
                <AccordionItem key={item.question} value={`faq-${index}`}>
                  <AccordionTrigger className='text-left text-sm hover:no-underline'>
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className='text-muted-foreground text-sm leading-6 whitespace-pre-wrap'>
                      {item.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}
      </div>
    </DocsShell>
  )
}
