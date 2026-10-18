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
import { ChevronDownIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import { ENDPOINT_MAP } from '../data/api-endpoints'
import { endpointChildKey, getEndpointNavLabel } from '../lib/endpoint-utils'
import type { ApiNavGroup } from '../lib/types'

function findActiveLocation(groups: ApiNavGroup[], activeEndpointId: string) {
  for (const group of groups) {
    for (const child of group.children) {
      if (child.endpointIds.includes(activeEndpointId)) {
        return { groupId: group.id, childId: child.id }
      }
    }
  }
  return null
}

type EndpointTreeProps = {
  activeEndpointId: string
  activeQuery: string
  groups: ApiNavGroup[]
  onEndpointSelect: (endpointId: string) => void
}

export function EndpointTree(props: EndpointTreeProps) {
  const { t } = useTranslation()
  const { groups, activeEndpointId, activeQuery } = props
  const activeLocation = useMemo(
    () => findActiveLocation(groups, activeEndpointId),
    [groups, activeEndpointId]
  )
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>(() =>
    activeLocation ? [activeLocation.groupId] : []
  )
  const [expandedChildKeys, setExpandedChildKeys] = useState<string[]>(() =>
    activeLocation
      ? [endpointChildKey(activeLocation.groupId, activeLocation.childId)]
      : []
  )
  const expandedGroups = useMemo(
    () => new Set(expandedGroupIds),
    [expandedGroupIds]
  )
  const expandedChildren = useMemo(
    () => new Set(expandedChildKeys),
    [expandedChildKeys]
  )
  const allKeys = useMemo(
    () => ({
      childKeys: groups.flatMap((group) =>
        group.children.map((child) => endpointChildKey(group.id, child.id))
      ),
      groupIds: groups.map((group) => group.id),
    }),
    [groups]
  )
  const allExpanded =
    allKeys.groupIds.length > 0 &&
    allKeys.groupIds.every((id) => expandedGroups.has(id)) &&
    allKeys.childKeys.every((key) => expandedChildren.has(key))

  useEffect(() => {
    if (!activeLocation) return
    setExpandedGroupIds((current) =>
      current.includes(activeLocation.groupId)
        ? current
        : [...current, activeLocation.groupId]
    )
    const childKey = endpointChildKey(
      activeLocation.groupId,
      activeLocation.childId
    )
    setExpandedChildKeys((current) =>
      current.includes(childKey) ? current : [...current, childKey]
    )
  }, [activeLocation])

  useEffect(() => {
    if (!activeQuery.trim()) return
    setExpandedGroupIds(allKeys.groupIds)
    setExpandedChildKeys(allKeys.childKeys)
  }, [activeQuery, allKeys])

  if (groups.length === 0) {
    return (
      <div className='p-4 text-sm'>
        <div className='font-medium'>{t('No endpoints found')}</div>
        <p className='text-muted-foreground mt-1 leading-5'>
          {t(
            'Try searching for a capability such as chat, image, video, or an endpoint path like /v1/models.'
          )}
        </p>
      </div>
    )
  }

  return (
    <nav
      id='ai-model-apis'
      aria-label={t('Endpoints')}
      className='flex flex-col gap-2 p-3'
    >
      <div className='flex items-center justify-end px-1 pb-1'>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className='h-7 px-2 text-xs'
          onClick={() => {
            if (allExpanded) {
              setExpandedGroupIds([])
              setExpandedChildKeys([])
              return
            }
            setExpandedGroupIds(allKeys.groupIds)
            setExpandedChildKeys(allKeys.childKeys)
          }}
        >
          {allExpanded ? t('Collapse All') : t('Expand All')}
        </Button>
      </div>
      {groups.map((group) => {
        const groupExpanded = expandedGroups.has(group.id)
        const groupIsActive = activeLocation?.groupId === group.id
        const endpointCount = group.children.reduce(
          (total, child) => total + child.endpointIds.length,
          0
        )
        return (
          <Collapsible
            key={group.id}
            open={groupExpanded}
            onOpenChange={(open: boolean) =>
              setExpandedGroupIds((current) =>
                updateExpandedIds(current, group.id, open)
              )
            }
            className='flex flex-col gap-1'
          >
            <CollapsibleTrigger
              type='button'
              className={cn(
                'group hover:bg-muted/70 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                groupIsActive && 'bg-muted text-foreground'
              )}
            >
              <HugeiconsIcon
                icon={ChevronDownIcon}
                className={cn(
                  'text-muted-foreground size-4 shrink-0 transition-transform',
                  groupExpanded && 'rotate-180'
                )}
                aria-hidden='true'
              />
              <HugeiconsIcon
                icon={group.icon}
                className='size-4 shrink-0'
                aria-hidden='true'
              />
              <span className='min-w-0 flex-1 truncate font-medium'>
                {t(group.titleKey)}
              </span>
              <span className='bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-[10px] leading-none'>
                {endpointCount}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent className='ml-4 flex flex-col gap-1 border-l pl-2'>
              {group.children.map((child) => {
                const childKey = endpointChildKey(group.id, child.id)
                const childExpanded = expandedChildren.has(childKey)
                const childIsActive =
                  activeLocation?.groupId === group.id &&
                  activeLocation.childId === child.id
                return (
                  <Collapsible
                    key={child.id}
                    open={childExpanded}
                    onOpenChange={(open: boolean) =>
                      setExpandedChildKeys((current) =>
                        updateExpandedIds(current, childKey, open)
                      )
                    }
                    className='flex flex-col gap-1'
                  >
                    <CollapsibleTrigger
                      type='button'
                      className={cn(
                        'group hover:bg-muted/60 flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors',
                        childIsActive && 'text-foreground'
                      )}
                    >
                      <HugeiconsIcon
                        icon={ChevronDownIcon}
                        className={cn(
                          'text-muted-foreground size-3.5 shrink-0 transition-transform',
                          childExpanded && 'rotate-180'
                        )}
                        aria-hidden='true'
                      />
                      <span className='text-muted-foreground min-w-0 flex-1 truncate'>
                        {t(child.titleKey)}
                      </span>
                      <span className='text-muted-foreground text-[10px] leading-none'>
                        {child.endpointIds.length}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className='flex flex-col gap-1 pb-1'>
                      {child.endpointIds.map((endpointId) => {
                        const endpoint = ENDPOINT_MAP[endpointId]
                        const endpointIsActive =
                          endpoint.id === activeEndpointId
                        return (
                          <Button
                            key={endpoint.id}
                            type='button'
                            variant='ghost'
                            className={cn(
                              'h-auto min-h-8 w-full justify-start gap-2 px-2 py-1.5 text-left text-sm font-normal',
                              endpointIsActive &&
                                'bg-muted text-foreground font-medium'
                            )}
                            onClick={() => props.onEndpointSelect(endpoint.id)}
                            aria-current={endpointIsActive ? 'page' : undefined}
                          >
                            <span className='min-w-0 flex-1 truncate'>
                              {t(getEndpointNavLabel(endpoint))}
                            </span>
                            <Badge
                              variant={
                                endpointIsActive ? 'secondary' : 'outline'
                              }
                            >
                              {endpoint.method}
                            </Badge>
                          </Button>
                        )
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </nav>
  )
}

function updateExpandedIds(current: string[], id: string, open: boolean) {
  if (open) {
    return current.includes(id) ? current : [...current, id]
  }
  return current.filter((item) => item !== id)
}
