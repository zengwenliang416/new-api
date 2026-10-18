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
import { useNavigate } from '@tanstack/react-router'

import { Markdown } from '@/components/ui/markdown'

export function DocsMarkdown(props: { content: string }) {
  const navigate = useNavigate()

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href') ?? ''
    if (href === '/docs' || href === '/docs/') {
      event.preventDefault()
      void navigate({ to: '/docs' })
      return
    }
    if (href === '/docs/api') {
      event.preventDefault()
      void navigate({ to: '/docs/api' })
      return
    }
    if (href.startsWith('/docs/guides/')) {
      event.preventDefault()
      void navigate({
        to: '/docs/guides/$slug',
        params: { slug: href.slice('/docs/guides/'.length) },
      })
    }
  }

  return (
    <div onClick={handleClick}>
      <Markdown>{props.content}</Markdown>
    </div>
  )
}
