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
import { createFileRoute, Navigate } from '@tanstack/react-router'

import { DocsGuidePage } from '@/features/docs/components/docs-guide-page'
import { DocsShell } from '@/features/docs/components/docs-shell'
import { DOCS_GUIDES } from '@/features/docs/data/guides'

function DocsGuideRoute() {
  const { slug } = Route.useParams()
  const guide = DOCS_GUIDES.find((candidate) => candidate.slug === slug)
  if (!guide) {
    return <Navigate to='/docs' replace />
  }
  return (
    <DocsShell active={guide.slug}>
      <DocsGuidePage slug={guide.slug} />
    </DocsShell>
  )
}

export const Route = createFileRoute('/docs/guides/$slug')({
  component: DocsGuideRoute,
})
