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
const DEFAULT_DOC_API_KEY = 'sk-your-api-key'

export type DocTemplateContext = {
  siteName: string
  baseUrl: string
  apiKey?: string
  maskKey?: boolean
}

export function applyDocTemplate(
  content: string,
  context: DocTemplateContext
): string {
  const apiKey =
    !context.maskKey && context.apiKey ? context.apiKey : DEFAULT_DOC_API_KEY
  return content
    .replaceAll('{{BASE_URL}}', context.baseUrl)
    .replaceAll('{{API_KEY}}', apiKey)
    .replaceAll('{{SITE_NAME}}', context.siteName)
}
