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
/*
Icon path data is derived from Carbon Design System icons
(https://github.com/carbon-design-system/carbon), Copyright IBM Corp.,
licensed under the Apache License, Version 2.0
(https://www.apache.org/licenses/LICENSE-2.0).
*/
/* eslint-disable react-refresh/only-export-components */
import type { SVGProps } from 'react'

type CarbonIconShape = { d: string; transform?: string }

type CarbonIconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function createCarbonIcon(shapes: CarbonIconShape[]) {
  return function CarbonIcon(props: CarbonIconProps) {
    const { size = 16, ...rest } = props
    return (
      <svg
        width={size}
        height={size}
        xmlns='http://www.w3.org/2000/svg'
        viewBox='0 0 32 32'
        fill='currentColor'
        {...rest}
      >
        {shapes.map((shape) => (
          <path
            key={shape.transform ? shape.transform + shape.d : shape.d}
            d={shape.d}
            transform={shape.transform}
          />
        ))}
      </svg>
    )
  }
}

export const CarbonIcons = {
  Roadmap: createCarbonIcon([
    {
      d: 'M12,30H4a2.0023,2.0023,0,0,1-2-2V24a2.0023,2.0023,0,0,1,2-2h8a2.0023,2.0023,0,0,1,2,2v4A2.0023,2.0023,0,0,1,12,30ZM4,24v4h8V24Z',
    },
    {
      d: 'M28,20H12a2.0023,2.0023,0,0,1-2-2V14a2.0023,2.0023,0,0,1,2-2H28a2.0023,2.0023,0,0,1,2,2v4A2.0023,2.0023,0,0,1,28,20ZM12,14v4H28V14Z',
    },
    {
      d: 'M16,10H4A2.0023,2.0023,0,0,1,2,8V4A2.0023,2.0023,0,0,1,4,2H16a2.0023,2.0023,0,0,1,2,2V8A2.0023,2.0023,0,0,1,16,10ZM4,4V8H16V4Z',
    },
  ]),
  CertificateCheck: createCarbonIcon([
    { d: 'M6 16H12V18H6z' },
    { d: 'M6 12H16V14H6z' },
    { d: 'M6 8H16V10H6z' },
    {
      d: 'M14,26H4V6H28V16h2V6a2,2,0,0,0-2-2H4A2,2,0,0,0,2,6V26a2,2,0,0,0,2,2H14Z',
    },
    { d: 'M22 25.59 19.41 23 18 24.41 22 28.41 30 20.41 28.59 19 22 25.59z' },
  ]),
  Meter: createCarbonIcon([
    {
      d: 'M26,16a9.9283,9.9283,0,0,0-1.1392-4.6182l-1.4961,1.4961A7.9483,7.9483,0,0,1,24,16Z',
    },
    {
      d: 'M23.4141,10,22,8.5859l-4.7147,4.7147A2.9659,2.9659,0,0,0,16,13a3,3,0,1,0,3,3,2.9659,2.9659,0,0,0-.3006-1.2853ZM16,17a1,1,0,1,1,1-1A1.0013,1.0013,0,0,1,16,17Z',
    },
    {
      d: 'M16,8a7.9515,7.9515,0,0,1,3.1223.6353l1.4961-1.4961A9.9864,9.9864,0,0,0,6,16H8A8.0092,8.0092,0,0,1,16,8Z',
    },
    {
      d: 'M16,30A14,14,0,1,1,30,16,14.0158,14.0158,0,0,1,16,30ZM16,4A12,12,0,1,0,28,16,12.0137,12.0137,0,0,0,16,4Z',
    },
  ]),
  Ticket: createCarbonIcon([
    {
      d: 'M29,14a1,1,0,0,0,1-1V8a2,2,0,0,0-2-2H4A2,2,0,0,0,2,8v5a1,1,0,0,0,1,1,2,2,0,0,1,0,4,1,1,0,0,0-1,1v5a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V19a1,1,0,0,0-1-1,2,2,0,0,1,0-4Zm-1,5.87V24H21V21H19v3H4V19.87a4,4,0,0,0,0-7.74V8H19v3h2V8h7v4.13a4,4,0,0,0,0,7.74Z',
    },
    { d: 'M19 13H21V19H19z' },
  ]),
  Checkmark: createCarbonIcon([
    { d: 'M13 24 4 15 5.414 13.586 13 21.171 26.586 7.586 28 9 13 24z' },
  ]),
  CheckmarkFilled: createCarbonIcon([
    {
      d: 'M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2ZM14,21.5908l-5-5L10.5906,15,14,18.4092,21.41,11l1.5957,1.5859Z',
    },
  ]),
  Close: createCarbonIcon([
    {
      d: 'M17.4141 16 24 9.4141 22.5859 8 16 14.5859 9.4143 8 8 9.4141 14.5859 16 8 22.5859 9.4143 24 16 17.4141 22.5859 24 24 22.5859 17.4141 16z',
    },
  ]),
  Wallet: createCarbonIcon([
    { d: 'M22 17H24V19H22z' },
    {
      d: 'M28,8H4V5H26V3H4A2,2,0,0,0,2,5V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V10A2,2,0,0,0,28,8ZM4,26V10H28v3H20a2,2,0,0,0-2,2v6a2,2,0,0,0,2,2h8v3ZM28,15v6H20V15Z',
    },
  ]),
  Settings: createCarbonIcon([
    {
      d: 'M27,16.76c0-.25,0-.5,0-.76s0-.51,0-.77l1.92-1.68A2,2,0,0,0,29.3,11L26.94,7a2,2,0,0,0-1.73-1,2,2,0,0,0-.64.1l-2.43.82a11.35,11.35,0,0,0-1.31-.75l-.51-2.52a2,2,0,0,0-2-1.61H13.64a2,2,0,0,0-2,1.61l-.51,2.52a11.48,11.48,0,0,0-1.32.75L7.43,6.06A2,2,0,0,0,6.79,6,2,2,0,0,0,5.06,7L2.7,11a2,2,0,0,0,.41,2.51L5,15.24c0,.25,0,.5,0,.76s0,.51,0,.77L3.11,18.45A2,2,0,0,0,2.7,21L5.06,25a2,2,0,0,0,1.73,1,2,2,0,0,0,.64-.1l2.43-.82a11.35,11.35,0,0,0,1.31.75l.51,2.52a2,2,0,0,0,2,1.61h4.72a2,2,0,0,0,2-1.61l.51-2.52a11.48,11.48,0,0,0,1.32-.75l2.42.82a2,2,0,0,0,.64.1,2,2,0,0,0,1.73-1L29.3,21a2,2,0,0,0-.41-2.51ZM25.21,24l-3.43-1.16a8.86,8.86,0,0,1-2.71,1.57L18.36,28H13.64l-.71-3.55a9.36,9.36,0,0,1-2.7-1.57L6.79,24,4.43,20l2.72-2.4a8.9,8.9,0,0,1,0-3.13L4.43,12,6.79,8l3.43,1.16a8.86,8.86,0,0,1,2.71-1.57L13.64,4h4.72l.71,3.55a9.36,9.36,0,0,1,2.7,1.57L25.21,8,27.57,12l-2.72,2.4a8.9,8.9,0,0,1,0,3.13L27.57,20Z',
    },
    {
      d: 'M16,22a6,6,0,1,1,6-6A5.94,5.94,0,0,1,16,22Zm0-10a3.91,3.91,0,0,0-4,4,3.91,3.91,0,0,0,4,4,3.91,3.91,0,0,0,4-4A3.91,3.91,0,0,0,16,12Z',
    },
  ]),
  Screen: createCarbonIcon([
    {
      d: 'M28,4H4A2,2,0,0,0,2,6V22a2,2,0,0,0,2,2h8v4H8v2H24V28H20V24h8a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4ZM18,28H14V24h4Zm10-6H4V6H28Z',
    },
  ]),
  CurrencyDollar: createCarbonIcon([
    {
      d: 'M23,20.5151c0-4.6152-3.78-5.1411-6.8171-5.563-3.31-.4609-5.1829-.86-5.1829-3.71C11,8.8491,13.5071,8,15.6538,8a6.7538,6.7538,0,0,1,5.5681,2.6279l1.5562-1.2558A8.6508,8.6508,0,0,0,17,6.0962V3H15V6.022c-3.6152.2192-6,2.26-6,5.22,0,4.73,3.83,5.2627,6.9075,5.69C19.16,17.3848,21,17.7744,21,20.5151,21,23.5474,17.8674,24,16,24c-3.4294,0-4.8782-.9639-6.2219-2.6279L8.2219,22.6279A8.4382,8.4382,0,0,0,15,25.9648V29h2V25.9551C20.7256,25.6509,23,23.6279,23,20.5151Z',
    },
  ]),
  Subtract: createCarbonIcon([{ d: 'M8 15H24V17H8z' }]),
  ArrowRight: createCarbonIcon([
    {
      d: 'M18 6 16.57 7.393 24.15 15 4 15 4 17 24.15 17 16.57 24.573 18 26 28 16 18 6z',
    },
  ]),
}
