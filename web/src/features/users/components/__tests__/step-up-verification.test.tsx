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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Row } from '@tanstack/react-table'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { afterEach, expect, it, vi } from 'vitest'

import { api } from '@/lib/api'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import type { User } from '../../types'
import { DataTableRowActions } from '../data-table-row-actions'
import { UsersDeleteDialog } from '../users-delete-dialog'
import { UsersMutateDrawer } from '../users-mutate-drawer'
import { UsersProvider, useUsers } from '../users-provider'

const target: User = {
  id: 2,
  username: 'managed-user',
  display_name: 'Managed user',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}

function mockVerification(scope: string, proofToken: string) {
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/verify/methods') {
      return {
        data: {
          success: true,
          data: {
            scope,
            methods: [{ method: '2fa', available: true }],
            oauth_providers: [],
            password_encryption_enabled: false,
          },
        },
      }
    }
    return { data: { success: true, data: [] } }
  })
  return {
    data: {
      success: true,
      data: {
        proof_token: proofToken,
        method: '2fa',
        scope,
        expires_at: Math.floor(Date.now() / 1000) + 60,
      },
    },
  }
}

function OpenDeleteDialog() {
  const users = useUsers()
  useEffect(() => {
    users.setCurrentRow(target)
    users.setOpen('delete')
    // The harness only seeds provider state once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function renderInProvider(children: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <UsersProvider>{children}</UsersProvider>
    </QueryClientProvider>
  )
}

async function completeTwoFactorVerification() {
  await userEvent.type(
    await screen.findByLabelText('Authenticator code or backup code'),
    '123456'
  )
  await userEvent.click(screen.getByRole('button', { name: 'Verify' }))
}

async function fillNewUser(roleLabel = 'Common User') {
  await userEvent.type(await screen.findByLabelText('Username'), 'created-user')
  await userEvent.type(screen.getByLabelText('Password'), 'FixturePassword!')
  if (roleLabel !== 'Common User') {
    await userEvent.click(screen.getByRole('combobox', { name: 'Role' }))
    await userEvent.click(
      await screen.findByRole('option', { name: roleLabel })
    )
  }
  await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useAuthStore.getState().auth.reset()
})

it('deleting a user sends the request only with a single-use proof for that user', async () => {
  const proof = mockVerification('admin.user.delete', 'delete-proof')
  const post = vi.spyOn(api, 'post').mockResolvedValue(proof)
  const del = vi
    .spyOn(api, 'delete')
    .mockResolvedValue({ data: { success: true } })
  renderInProvider(
    <>
      <OpenDeleteDialog />
      <UsersDeleteDialog />
    </>
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await screen.findByLabelText('Authenticator code or backup code')
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(del).not.toHaveBeenCalled()
  await completeTwoFactorVerification()
  await waitFor(() =>
    expect(del).toHaveBeenCalledWith(
      '/api/user/2/',
      expect.objectContaining({
        headers: { 'X-Security-Proof': 'delete-proof' },
        singleUseAuthorization: true,
      })
    )
  )
  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'admin.user.delete',
      context: { user_id: 2 },
    }),
    expect.anything()
  )
})

it('cancelling verification leaves the user untouched and returns to the confirmation', async () => {
  mockVerification('admin.user.delete', 'delete-proof')
  const del = vi.spyOn(api, 'delete')
  renderInProvider(
    <>
      <OpenDeleteDialog />
      <UsersDeleteDialog />
    </>
  )
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  await screen.findByLabelText('Authenticator code or backup code')
  await userEvent.keyboard('{Escape}')
  await screen.findByRole('alertdialog')
  expect(del).not.toHaveBeenCalled()
})

it('disabling a user from the row menu binds the proof to the user and action', async () => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'admin',
    role: ROLE.ADMIN,
  })
  const proof = mockVerification('admin.user.manage', 'manage-proof')
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/verify') return proof
    if (url === '/api/user/manage') return { data: { success: true } }
    throw new Error(`Unexpected POST ${url}`)
  })
  renderInProvider(
    <DataTableRowActions row={{ original: target } as Row<User>} />
  )
  await userEvent.click(screen.getByRole('button', { name: 'Open menu' }))
  await userEvent.click(
    await screen.findByRole('menuitem', { name: 'Disable' })
  )
  expect(post).not.toHaveBeenCalledWith(
    '/api/user/manage',
    expect.anything(),
    expect.anything()
  )
  await completeTwoFactorVerification()
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/user/manage',
      { id: 2, action: 'disable' },
      expect.objectContaining({
        headers: { 'X-Security-Proof': 'manage-proof' },
        singleUseAuthorization: true,
      })
    )
  )
  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'admin.user.manage',
      context: { user_id: 2, action: 'disable' },
    }),
    expect.anything()
  )
})

it('cancelling verification for a new support account does not create the account', async () => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'root',
    role: ROLE.SUPER_ADMIN,
  })
  mockVerification('admin.user.create', 'support-create-proof')
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  const onOpenChange = vi.fn()
  renderInProvider(<UsersMutateDrawer open onOpenChange={onOpenChange} />)
  await fillNewUser('Support Staff')
  expect(post).not.toHaveBeenCalled()
  await screen.findByLabelText('Authenticator code or backup code')

  await userEvent.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  )

  expect(post).not.toHaveBeenCalled()
  expect(onOpenChange).not.toHaveBeenCalled()
})

it('creating a support account waits for a proof bound to role 5 and sends it once', async () => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'root',
    role: ROLE.SUPER_ADMIN,
  })
  const proof = mockVerification('admin.user.create', 'support-create-proof')
  const post = vi.spyOn(api, 'post').mockImplementation(async (url) => {
    if (url === '/api/verify') return proof
    if (url === '/api/user/') return { data: { success: true } }
    throw new Error(`Unexpected POST ${url}`)
  })
  const onOpenChange = vi.fn()
  renderInProvider(<UsersMutateDrawer open onOpenChange={onOpenChange} />)
  await fillNewUser('Support Staff')
  expect(post).not.toHaveBeenCalled()
  await screen.findByRole('heading', {
    name: 'Verify to create a privileged account',
  })

  await completeTwoFactorVerification()
  await waitFor(() =>
    expect(post).toHaveBeenCalledWith(
      '/api/user/',
      expect.objectContaining({ role: ROLE.SUPPORT, username: 'created-user' }),
      expect.objectContaining({
        headers: { 'X-Security-Proof': 'support-create-proof' },
        singleUseAuthorization: true,
      })
    )
  )

  expect(post).toHaveBeenCalledWith(
    '/api/verify',
    expect.objectContaining({
      scope: 'admin.user.create',
      context: { role: ROLE.SUPPORT },
    }),
    expect.anything()
  )
  expect(post.mock.calls.filter(([url]) => url === '/api/user/')).toHaveLength(
    1
  )
  expect(onOpenChange).toHaveBeenCalledWith(false)
})

it('creating a common user does not request a security proof', async () => {
  useAuthStore.getState().auth.setUser({
    id: 1,
    username: 'root',
    role: ROLE.SUPER_ADMIN,
  })
  mockVerification('admin.user.create', 'unused-proof')
  const get = vi.mocked(api.get)
  const post = vi
    .spyOn(api, 'post')
    .mockResolvedValue({ data: { success: true } })
  renderInProvider(<UsersMutateDrawer open onOpenChange={vi.fn()} />)
  await fillNewUser()

  await waitFor(() =>
    expect(post).toHaveBeenCalledExactlyOnceWith(
      '/api/user/',
      expect.objectContaining({ role: ROLE.USER, username: 'created-user' }),
      {}
    )
  )
  expect(get.mock.calls.some(([url]) => url === '/api/verify/methods')).toBe(
    false
  )
  expect(
    screen.queryByLabelText('Authenticator code or backup code')
  ).not.toBeInTheDocument()
})
