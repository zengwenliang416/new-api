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
import { ArrowLeft01Icon, ServerStack01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'

import { ENDPOINT_MAP } from '../data/api-endpoints'
import { API_NAV_GROUPS } from '../data/api-nav-groups'
import { buildCodeSamples } from '../lib/build-code-samples'
import { buildEndpointMarkdown } from '../lib/build-endpoint-markdown'
import {
  DEFAULT_ENDPOINT_ID,
  getEndpoint,
  getEndpointUrl,
} from '../lib/endpoint-utils'
import { getPublicDocsUrls } from '../lib/public-docs'
import {
  countMatchingEndpoints,
  filterNavGroups,
} from '../lib/search-endpoints'
import { useApiBaseUrl } from '../lib/use-api-base-url'
import { EndpointCodePanel } from './endpoint-code-panel'
import { EndpointDetail } from './endpoint-detail'
import { EndpointsPanel } from './endpoints-panel'
import { EndpointsSheet } from './endpoints-sheet'

export function DocsApiPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [activeQuery, setActiveQuery] = useState('')
  const [activeEndpointId, setActiveEndpointId] =
    useState<string>(DEFAULT_ENDPOINT_ID)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [activeCodeLanguage, setActiveCodeLanguage] = useState('cURL')
  const [activeResponseStatus, setActiveResponseStatus] = useState('200')
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const apiBaseUrl = useApiBaseUrl()
  const endpoint = getEndpoint(activeEndpointId)
  const filteredNavGroups = useMemo(
    () => filterNavGroups(API_NAV_GROUPS, ENDPOINT_MAP, t, activeQuery),
    [t, activeQuery]
  )
  const matchingEndpointCount = useMemo(
    () => countMatchingEndpoints(filteredNavGroups),
    [filteredNavGroups]
  )
  const codeSamples = useMemo(
    () => buildCodeSamples(endpoint, apiBaseUrl),
    [endpoint, apiBaseUrl]
  )
  const endpointUrl = getEndpointUrl(endpoint, apiBaseUrl)
  const endpointMarkdown = useMemo(
    () => buildEndpointMarkdown(endpoint, apiBaseUrl, t),
    [endpoint, apiBaseUrl, t]
  )
  const { indexUrl: aiDocsIndexUrl, fullUrl: aiDocsFullUrl } =
    getPublicDocsUrls(window.location.origin)

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace(/^#/, '')
      if (hash && ENDPOINT_MAP[hash]) {
        setActiveEndpointId(hash)
      }
    }
    syncFromHash()
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [])

  useEffect(() => {
    setActiveCodeLanguage('cURL')
    setActiveResponseStatus(endpoint.responseExamples[0]?.status ?? '200')
  }, [endpoint])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setActiveQuery(query.trim())
  }

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value
    setQuery(value)
    if (!value.trim()) {
      setActiveQuery('')
    }
  }

  const handleEndpointSelect = (endpointId: string) => {
    setActiveEndpointId(endpointId)
    setMobileSheetOpen(false)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#${endpointId}`)
      document.querySelector('#docs-article')?.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
      document.querySelector('#docs-content')?.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    }
  }

  return (
    <PublicLayout showMainContainer={false}>
      <main
        id='docs-main'
        className='flex h-svh flex-col overflow-hidden pt-16'
      >
        <div className='bg-background/95 supports-backdrop-filter:bg-background/85 border-b backdrop-blur lg:hidden'>
          <div className='mx-auto flex max-w-[90rem] items-center justify-between px-4 py-3'>
            <Link
              to='/docs'
              className='text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-colors'
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className='size-4' />
              {t('Back to docs')}
            </Link>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setMobileSheetOpen(true)}
            >
              <HugeiconsIcon
                icon={ServerStack01Icon}
                data-icon='inline-start'
              />
              {t('Endpoints')}
            </Button>
          </div>
        </div>
        <div className='mx-auto grid min-h-0 w-full max-w-[90rem] flex-1 lg:grid-cols-[17rem_minmax(0,1fr)]'>
          <EndpointsPanel
            query={query}
            activeQuery={activeQuery}
            filteredNavGroups={filteredNavGroups}
            matchingEndpointCount={matchingEndpointCount}
            activeEndpointId={endpoint.id}
            searchInputRef={searchInputRef}
            onSearch={handleSearch}
            onQueryChange={handleQueryChange}
            onEndpointSelect={handleEndpointSelect}
          />
          <div
            id='docs-content'
            className='min-h-0 min-w-0 overflow-y-auto xl:overflow-hidden'
          >
            <div className='flex min-h-full flex-col xl:grid xl:h-full xl:min-h-0 xl:grid-cols-[minmax(0,1fr)_30rem]'>
              <EndpointDetail
                endpoint={endpoint}
                apiBaseUrl={apiBaseUrl}
                endpointUrl={endpointUrl}
                endpointMarkdown={endpointMarkdown}
                aiDocsIndexUrl={aiDocsIndexUrl}
                aiDocsFullUrl={aiDocsFullUrl}
              />
              <EndpointCodePanel
                endpoint={endpoint}
                codeSamples={codeSamples}
                activeCodeLanguage={activeCodeLanguage}
                activeResponseStatus={activeResponseStatus}
                onCodeLanguageChange={setActiveCodeLanguage}
                onResponseStatusChange={setActiveResponseStatus}
              />
            </div>
          </div>
        </div>
        <EndpointsSheet
          open={mobileSheetOpen}
          query={query}
          activeQuery={activeQuery}
          filteredNavGroups={filteredNavGroups}
          matchingEndpointCount={matchingEndpointCount}
          activeEndpointId={endpoint.id}
          onOpenChange={setMobileSheetOpen}
          onSearch={handleSearch}
          onQueryChange={handleQueryChange}
          onEndpointSelect={handleEndpointSelect}
        />
      </main>
    </PublicLayout>
  )
}
