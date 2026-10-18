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
import { ENDPOINT_MAP } from '../data/api-endpoints'
import { DOCS_GUIDES } from '../data/guides'
import { applyDocTemplate } from './apply-doc-template'
import { buildEndpointMarkdown } from './build-endpoint-markdown'
import { buildGuideContent } from './build-guide-content'

/** Public, deterministic assets generated only from the UI's documentation data. */
export function buildAiDocs(): { index: string; full: string } {
  const context = {
    siteName: 'New API',
    baseUrl: 'https://your-gateway.example',
    maskKey: true,
  }
  const introduction = `# New API public documentation

> Generated from the same guides and endpoint definitions used by the documentation UI.

This is a static API and setup reference. It does not contain private keys, account data, live model availability, prices, or administrator-configured FAQ entries.
Replace https://your-gateway.example with the API root shown by your deployment. The API origin may differ from the documentation website.
Model IDs in examples are illustrative: select a model available to your own key and group. Use NEW_API_KEY or another client-specific environment variable for credentials.
Relative documentation links resolve against the frontend website. Check /pricing and authenticated /v1/models for current deployment information.

Project: [QuantumNous/new-api](https://github.com/QuantumNous/new-api)
`
  const guideLinks = DOCS_GUIDES.map(
    (guide) =>
      `- [${guide.titleKey}](/docs/guides/${guide.slug}): ${guide.summaryKey}`
  ).join('\n')
  const endpointLinks = Object.values(ENDPOINT_MAP)
    .map(
      (endpoint) =>
        `- [${endpoint.titleKey}](/docs/api#${endpoint.id}): ${endpoint.method} ${endpoint.path}`
    )
    .join('\n')
  const index = `${introduction}\n## Complete reference\n\n- [Full Markdown reference](/llms-full.txt)\n\n## Guides\n\n${guideLinks}\n\n## API reference\n\n${endpointLinks}\n`
  const guides = DOCS_GUIDES.map((guide) => {
    const english = applyDocTemplate(
      buildGuideContent(guide, 'en', (key) => key),
      context
    )
    const chinese = applyDocTemplate(
      buildGuideContent(guide, 'zh', (key) => key),
      context
    )
    return `### ${guide.titleKey}\n\nSource: /docs/guides/${guide.slug}\n\n#### English\n\n${english.replaceAll(/^#/gm, '##')}\n\n#### 简体中文\n\n${chinese.replaceAll(/^#/gm, '##')}`
  }).join('\n\n')
  const endpoints = Object.values(ENDPOINT_MAP)
    .map((endpoint) =>
      buildEndpointMarkdown(endpoint, context.baseUrl, (key) => key).replaceAll(
        /^#/gm,
        '###'
      )
    )
    .join('\n\n')
  return {
    index,
    full: `${introduction}\n## Guides\n\n${guides}\n\n## API reference\n\n${endpoints.trimEnd()}\n`,
  }
}
