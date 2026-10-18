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
import type { IconSvgElement } from '@hugeicons/react'

export type EndpointField = {
  name: string
  type: string
  required?: boolean
  location?: string
  descriptionKey: string
  defaultValue?: string
  range?: string
  children?: EndpointField[]
}

type ResponseExample = {
  status: string
  titleKey: string
  descriptionKey: string
  body: string
}

export type ApiEndpoint = {
  id: string
  method: string
  path: string
  samplePath?: string
  navTitleKey?: string
  titleKey: string
  summaryKey: string
  descriptionKey: string
  groupId: string
  groupTitleKey: string
  formatKey: string
  auth: 'bearer' | 'session-or-bearer'
  contentType: string
  responseType: string
  transport?: 'websocket'
  downloadFileName?: string
  requestFields: EndpointField[]
  pathFields?: EndpointField[]
  queryFields?: EndpointField[]
  formFields?: EndpointField[]
  sampleBody?: string
  responseExamples: ResponseExample[]
  analysisKeys: string[]
  keywords: string[]
}

type ApiNavChild = {
  id: string
  titleKey: string
  endpointIds: string[]
}

export type ApiNavGroup = {
  id: string
  icon: IconSvgElement
  titleKey: string
  descriptionKey: string
  children: ApiNavChild[]
}

export type GuideCategory = {
  id: string
  icon: IconSvgElement
  titleKey: string
}

export type DocsGuide = {
  slug: string
  categoryId: string
  titleKey: string
  summaryKey: string
  keywords: string[]
  content: {
    zh: string
    en: string
  }
  recommended?: boolean
  hideTokenBar?: boolean
}
