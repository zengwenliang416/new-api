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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, test } from 'vitest'

import { DOCS_GUIDES } from '../../data/guides'
import { buildAiDocs } from '../build-ai-docs'
import { buildGuideContent } from '../build-guide-content'
import { getPublicDocsUrls } from '../public-docs'

describe('published documentation contracts', () => {
  test('publishes an index and a full Markdown reference as real text assets', () => {
    const index = readFileSync(resolve('public/llms.txt'), 'utf8')
    const full = readFileSync(resolve('public/llms-full.txt'), 'utf8')
    expect(index).toContain('/llms-full.txt')
    expect(full).toContain('/v1/chat/completions')
    expect(full).toContain('## Guides')
    expect(full).not.toMatch(/<!doctype|<html/i)
    const generated = buildAiDocs()
    expect(index).toBe(generated.index)
    expect(full).toBe(generated.full)
    expect(full).not.toMatch(
      /\{\{BASE_URL\}\}|\{\{API_KEY\}\}|\{\{QUICK_START_GUIDES\}\}/
    )
  })

  test('AI documentation links use the frontend site origin independently of API routing', () => {
    expect(getPublicDocsUrls('https://docs.example')).toEqual({
      indexUrl: 'https://docs.example/llms.txt',
      fullUrl: 'https://docs.example/llms-full.txt',
    })
  })

  test('quick-start exports resolve actual guide links in both supported article languages', () => {
    const quickStart = DOCS_GUIDES.find((guide) => guide.slug === 'quick-start')
    if (!quickStart) throw new Error('Quick-start guide is missing')
    for (const language of ['zh', 'en'] as const) {
      const content = buildGuideContent(quickStart, language, (key) => key)
      expect(content).not.toContain('{{QUICK_START_GUIDES}}')
      expect(content).toContain('/docs/guides/openai-sdk')
      expect(content).toContain('NEW_API_KEY')
    }
  })

  test('guides contain no unavailable agreement route, copied site origin, or removed interactive widgets', () => {
    for (const guide of DOCS_GUIDES) {
      for (const content of Object.values(guide.content)) {
        expect(content, guide.slug).not.toMatch(
          /\/coding-agreement\?|profile#coding-agreements|api\.shuaiapi\.com|\[\[\[/
        )
      }
    }
  })

  test('support documentation does not promise unverified worker retention, email delivery, or rate limits', () => {
    const guide = DOCS_GUIDES.find((entry) => entry.slug === 'support-center')
    if (!guide) throw new Error('Support guide is missing')
    expect(guide.content.zh).not.toMatch(
      /每次官方回复都会|保留 \*\*7 天|每账号每小时最多/
    )
    expect(guide.content.en).not.toMatch(
      /every official reply|retained for \*\*7 days|10 tickets/i
    )
  })
})
