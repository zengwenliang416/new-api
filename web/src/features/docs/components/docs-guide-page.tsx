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
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'

import { DOCS_GUIDES } from '../data/guides'
import { buildGuideContent } from '../lib/build-guide-content'
import { useDocTemplate } from '../lib/use-doc-template'
import { DocsCredentialPreview } from './docs-credential-preview'
import { DocsMarkdown } from './docs-markdown'

export function DocsGuidePage(props: { slug: string }) {
  const { t, i18n } = useTranslation()
  const applyTemplate = useDocTemplate()
  const guideIndex = DOCS_GUIDES.findIndex((guide) => guide.slug === props.slug)
  const guide = DOCS_GUIDES[guideIndex]
  const interfaceLanguage = (
    i18n.resolvedLanguage || i18n.language
  ).toLowerCase()
  const articleLanguage = interfaceLanguage.startsWith('zh') ? 'zh' : 'en'
  const showLanguageHint =
    !interfaceLanguage.startsWith('zh') && !interfaceLanguage.startsWith('en')

  const content = useMemo(() => {
    if (!guide) return ''
    return buildGuideContent(guide, articleLanguage, t)
  }, [guide, articleLanguage, t])

  const renderedContent = useMemo(
    () => applyTemplate(content),
    [applyTemplate, content]
  )
  const copyMarkdown = useMemo(
    () =>
      guide
        ? `# ${t(guide.titleKey)}

${applyTemplate(content, { maskKey: true })}`
        : '',
    [applyTemplate, content, guide, t]
  )

  if (!guide) return null
  const previousGuide = DOCS_GUIDES[guideIndex - 1]
  const nextGuide = DOCS_GUIDES[guideIndex + 1]

  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-6'>
      <header className='flex flex-col gap-3'>
        <h1 className='text-3xl font-semibold tracking-tight text-balance'>
          {t(guide.titleKey)}
        </h1>
        <p className='text-muted-foreground text-base leading-7 text-pretty'>
          {t(guide.summaryKey)}
        </p>
        <div className='flex flex-wrap gap-2'>
          <CopyButton
            value={copyMarkdown}
            size='sm'
            variant='outline'
            tooltip={t('Copy Markdown')}
            successTooltip={t('Markdown copied')}
            aria-label={t('Copy Markdown')}
          >
            {t('Copy Markdown')}
          </CopyButton>
        </div>
      </header>
      <DocsCredentialPreview />
      {showLanguageHint && (
        <p className='text-muted-foreground text-sm' role='note'>
          {t(
            'Guide content is currently available in Simplified Chinese and English.'
          )}
        </p>
      )}
      <div lang={articleLanguage === 'zh' ? 'zh-CN' : 'en'}>
        <DocsMarkdown content={renderedContent} />
      </div>
      <nav className='flex flex-wrap items-center justify-between gap-3 border-t pt-5'>
        {previousGuide ? (
          <Button
            variant='ghost'
            render={
              <Link
                to='/docs/guides/$slug'
                params={{ slug: previousGuide.slug }}
              />
            }
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon='inline-start' />
            {t(previousGuide.titleKey)}
          </Button>
        ) : (
          <span />
        )}
        {nextGuide && (
          <Button
            variant='ghost'
            render={
              <Link to='/docs/guides/$slug' params={{ slug: nextGuide.slug }} />
            }
          >
            {t(nextGuide.titleKey)}
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon='inline-end' />
          </Button>
        )}
      </nav>
    </div>
  )
}
