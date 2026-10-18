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
import { buildCodeSamples } from './build-code-samples'
import type { ApiEndpoint } from './types'

export function buildEndpointMarkdown(
  endpoint: ApiEndpoint,
  apiBaseUrl: string,
  translate: (key: string) => string
): string {
  const fieldRows = [
    ...(endpoint.pathFields ?? []),
    ...(endpoint.queryFields ?? []),
    ...endpoint.requestFields,
  ]
    .map((field) => {
      const required = field.required
        ? translate('Required')
        : translate('Optional')
      return `| \`${field.name}\` | \`${field.type}\` | ${field.location ?? 'body'} | ${required} | ${translate(
        field.descriptionKey
      )} |`
    })
    .join('\n')
  const responseSections = endpoint.responseExamples
    .map(
      (example) => `### ${example.status} ${translate(example.titleKey)}

${translate(example.descriptionKey)}

\`\`\`${example.status === '101' || (endpoint.downloadFileName && example.status.startsWith('2')) ? 'text' : 'json'}
${example.body}
\`\`\``
    )
    .join('\n\n')
  const curlSample = buildCodeSamples(endpoint, apiBaseUrl)[0]?.code ?? ''
  return `# ${translate(endpoint.titleKey)}

${endpoint.method} \`${endpoint.path}\`

${translate(endpoint.descriptionKey)}

## Base URL

\`${apiBaseUrl}\`

## Authentication

\`Authorization: Bearer <token>\`

## Request parameters

| Field | Type | Location | Required | Description |
| --- | --- | --- | --- | --- |
${fieldRows}

## Example

\`\`\`bash
${curlSample}
\`\`\`

## Responses

${responseSections}
`
}
