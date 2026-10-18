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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { expect, it, vi } from 'vitest'

import { RechargeFormCard } from '../components/recharge-form-card'
import { WalletStatsCard } from '../components/wallet-stats-card'

it('wallet statistics keep labels and descriptions visible while stacking on small screens', () => {
  render(<WalletStatsCard user={null} />)

  const terms = screen.getAllByRole('term')
  expect(terms).toHaveLength(3)
  expect(terms.map((term) => term.textContent)).toEqual([
    'Current Balance',
    'Total Usage',
    'API Requests',
  ])
  expect(terms[0].closest('dl')).toHaveClass('grid-cols-1', 'sm:grid-cols-3')
  for (const description of [
    'Remaining quota',
    'Total consumed quota',
    'Total requests made',
  ]) {
    expect(screen.getByText(description)).toBeVisible()
    expect(screen.getByText(description)).not.toHaveClass('hidden')
  }
})

it('the recharge options retain their selection and payment actions in the responsive layout', async () => {
  const user = userEvent.setup()
  const preset = { value: 20 }
  const method = { type: 'alipay', name: 'Alipay', min_topup: 10 }
  const props: ComponentProps<typeof RechargeFormCard> = {
    topupInfo: {
      enable_online_topup: true,
      enable_stripe_topup: false,
      pay_methods: [method],
      min_topup: 1,
      stripe_min_topup: 1,
      amount_options: [20, 100],
      discount: {},
    },
    presetAmounts: [preset, { value: 100 }],
    selectedPreset: 20,
    onSelectPreset: vi.fn(),
    topupAmount: 20,
    onTopupAmountChange: vi.fn(),
    paymentAmount: 20,
    calculating: false,
    onPaymentMethodSelect: vi.fn(),
    paymentLoading: null,
    redemptionCode: '',
    onRedemptionCodeChange: vi.fn(),
    onRedeem: vi.fn(),
    redeeming: false,
    onOpenBilling: vi.fn(),
  }
  const view = render(<RechargeFormCard {...props} />)

  const selected = screen.getByRole('button', { name: /^20 / })
  expect(selected).toHaveAttribute('aria-pressed', 'true')
  expect(selected).toHaveClass('min-w-0', 'whitespace-normal')
  expect(selected.parentElement).toHaveClass('grid-cols-2', 'md:grid-cols-4')
  expect(screen.getByLabelText('Custom Amount').parentElement).toHaveClass(
    'grid',
    'min-w-0',
    'sm:grid-cols-[minmax(0,1fr)_auto]'
  )
  await user.click(selected)
  expect(props.onSelectPreset).toHaveBeenCalledWith(preset)
  await user.click(screen.getByRole('button', { name: 'Alipay' }))
  expect(props.onPaymentMethodSelect).toHaveBeenCalledWith(method)
  await user.click(screen.getByRole('button', { name: 'Order History' }))
  expect(props.onOpenBilling).toHaveBeenCalledOnce()

  view.rerender(<RechargeFormCard {...props} topupAmount={1} />)
  expect(
    screen.getByRole('button', { name: 'Alipay. Minimum topup amount: 10' })
  ).toBeDisabled()
})
