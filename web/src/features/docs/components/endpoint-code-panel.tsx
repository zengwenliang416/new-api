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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import type { CodeSample } from '../lib/build-code-samples'
import type { ApiEndpoint } from '../lib/types'
import { DocsCodeBlock } from './docs-code-block'

type EndpointCodePanelProps = {
  activeCodeLanguage: string
  activeResponseStatus: string
  codeSamples: CodeSample[]
  endpoint: ApiEndpoint
  onCodeLanguageChange: (language: string) => void
  onResponseStatusChange: (status: string) => void
}

export function EndpointCodePanel(props: EndpointCodePanelProps) {
  const { t } = useTranslation()
  const { endpoint, codeSamples } = props
  const activeResponse =
    endpoint.responseExamples.find(
      (example) => example.status === props.activeResponseStatus
    ) ?? endpoint.responseExamples[0]

  return (
    <aside className='bg-muted/20 min-w-0 border-t xl:min-h-0 xl:border-t-0 xl:border-l'>
      <ScrollArea className='w-full xl:h-full xl:min-h-0'>
        <div className='flex flex-col gap-4 p-4'>
          <Card>
            <CardHeader>
              <CardTitle>{t('Code examples')}</CardTitle>
              <CardDescription>
                {t('Copy a request sample in your preferred language.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={props.activeCodeLanguage}
                onValueChange={(value) => props.onCodeLanguageChange(value)}
              >
                <TabsList variant='line' className='max-w-full overflow-x-auto'>
                  {codeSamples.map((sample) => (
                    <TabsTrigger key={sample.language} value={sample.language}>
                      {sample.language}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {codeSamples.map((sample) => (
                  <TabsContent
                    key={sample.language}
                    value={sample.language}
                    className='mt-3'
                  >
                    <DocsCodeBlock
                      label={sample.language}
                      code={sample.code}
                      copyLabel={t('Copy code')}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('Response examples')}</CardTitle>
              <CardDescription>
                {t('Inspect common success and error response shapes.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs
                value={activeResponse.status}
                onValueChange={props.onResponseStatusChange}
              >
                <TabsList variant='line'>
                  {endpoint.responseExamples.map((example) => (
                    <TabsTrigger key={example.status} value={example.status}>
                      {example.status}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {endpoint.responseExamples.map((example) => (
                  <TabsContent
                    key={example.status}
                    value={example.status}
                    className='mt-3'
                  >
                    <div className='mb-3 flex flex-col gap-1'>
                      <div className='text-sm font-medium'>
                        {t(example.titleKey)}
                      </div>
                      <p className='text-muted-foreground text-sm leading-6'>
                        {t(example.descriptionKey)}
                      </p>
                    </div>
                    <DocsCodeBlock
                      label={`${example.status} ${t(example.titleKey)}`}
                      code={example.body}
                      copyLabel={t('Copy response')}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('On this endpoint')}</CardTitle>
              <CardDescription>
                {t('Quick anchors for the current API contract.')}
              </CardDescription>
            </CardHeader>
            <CardContent className='flex flex-col gap-2'>
              <Button
                variant='ghost'
                className='justify-start'
                onClick={() => {
                  document.querySelector('#docs-article')?.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                  })
                  document.querySelector('#docs-content')?.scrollTo({
                    top: 0,
                    behavior: 'smooth',
                  })
                }}
              >
                {t('Overview')}
              </Button>
              <Button
                variant='ghost'
                className='justify-start'
                onClick={() =>
                  document
                    .querySelector('#invocation-details')
                    ?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    })
                }
              >
                {t('Invocation details')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </aside>
  )
}
