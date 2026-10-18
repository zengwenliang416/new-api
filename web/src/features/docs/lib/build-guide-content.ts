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
import { DOCS_GUIDES, GUIDE_CATEGORIES } from '../data/guides'
import type { DocsGuide } from './types'

const QUICK_START_LINK_SLUGS = new Set([
  'deepseek-coding',
  'claude-code',
  'codex-cli',
  'cc-switch',
  'cherry-studio',
  'immersive-translate',
  'openai-sdk',
  'anthropic-sdk',
  'troubleshooting',
])

/** The browser article and exported AI reference share the same guide content. */
export function buildGuideContent(
  guide: DocsGuide,
  language: keyof DocsGuide['content'],
  translate: (key: string) => string
): string {
  const content = guide.content[language]
  if (guide.slug !== 'quick-start') return content
  const links = GUIDE_CATEGORIES.flatMap((category) => {
    const guides = DOCS_GUIDES.filter(
      (candidate) =>
        candidate.categoryId === category.id &&
        QUICK_START_LINK_SLUGS.has(candidate.slug)
    ).map(
      (candidate) =>
        `[${translate(candidate.titleKey)}](/docs/guides/${candidate.slug})`
    )
    return guides.length > 0
      ? [`- ${translate(category.titleKey)}: ${guides.join(', ')}`]
      : []
  })
  return content.replace('{{QUICK_START_GUIDES}}', links.join('\n'))
}
