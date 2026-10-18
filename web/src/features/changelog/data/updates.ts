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
/**
 * Changelog entries grouped by month, newest first.
 *
 * `title` and `items` hold i18n keys; render them through `t()` so every
 * entry follows the active interface language.
 */
export interface ChangelogUpdate {
  title: string
  items: string[]
}

export interface ChangelogMonth {
  month: string
  updates: ChangelogUpdate[]
}

export const CHANGELOG_MONTHS: ChangelogMonth[] = [
  {
    month: '2026-10',
    updates: [
      {
        title: '2026-10-04: Model mapping on API keys',
        items: [
          'Map exact client model names to models available in the key’s group or group chain, with optional reasoning effort overrides.',
          'Apply editable mapping presets and follow the new group chains and model mapping guide. Billing uses the target model and the group that serves it.',
        ],
      },
      {
        title: 'A more complete conversation workspace',
        items: [
          'Chat and create images in one place, with image pasting and clearer model choices.',
          'Smoother responses, easier-to-read tables and formulas, and clearer usage records.',
        ],
      },
      {
        title: 'Choose where your conversations are saved',
        items: [
          'Anonymous mode keeps conversations and images in this browser, with clear privacy reminders.',
          'Cloud conversations keep their text history; images are kept for 30 days by default.',
        ],
      },
    ],
  },
  {
    month: '2026-09',
    updates: [
      {
        title: 'Easier account recovery',
        items: [
          'Improved account recovery helps you find your original sign-in method.',
          'Clearer sign-in guidance helps avoid creating an extra account by mistake.',
        ],
      },
      {
        title: 'A smoother everyday experience',
        items: [
          'Improved connections and conversations in popular coding tools.',
          'Clearer cache usage and cost details help you understand your spending.',
        ],
      },
      {
        title: 'More visibility and account options',
        items: [
          'Added model checks and their results to help you understand service quality.',
          'Added invitation rewards and improved username, password, and linked-account settings.',
        ],
      },
    ],
  },
  {
    month: '2026-08',
    updates: [
      {
        title: 'Faster pages, simpler payments',
        items: [
          'Faster home page loading, better mobile browsing, and smoother recovery after updates.',
          'Improved QR code payments, mobile checkout, and price change reminders.',
        ],
      },
      {
        title: 'More convenient sign-in and browsing',
        items: [
          'More third-party sign-in options, with improved translations and help content.',
          'View the status of individual models alongside updated model and pricing information.',
        ],
      },
      {
        title: 'Clearer records, fewer interruptions',
        items: [
          'Check your balance from the console header and daily usage from your key list.',
          'Improved image history, refund requests, and handling of interrupted requests.',
        ],
      },
    ],
  },
  {
    month: '2026-07',
    updates: [
      {
        title: 'Image creation and easier tool setup',
        items: [
          'Create images, edit with reference images, and check generation status and results.',
          'More one-click setup options and connection guides for popular tools.',
        ],
      },
      {
        title: 'An easier start, a clearer choice',
        items: [
          'Added a help center with quick-start guides and answers to common questions.',
          'Added service performance views to show availability and response times.',
        ],
      },
      {
        title: 'Clearer pricing and helpful reminders',
        items: [
          'Improved pricing explanations and tier displays to make costs easier to understand.',
          'Improved top-ups, promotional redemptions, and low-balance reminders.',
        ],
      },
    ],
  },
  {
    month: '2026-06',
    updates: [
      {
        title: 'Your balance and bonus credits at a glance',
        items: [
          'A clearer wallet separates your paid balance from bonus credits.',
          'View how bonus credits are used and when they expire.',
        ],
      },
      {
        title: 'Smoother registration and support',
        items: [
          'Improved registration guidance, third-party sign-in, and setup for everyday tools.',
          'Added support tickets to submit questions, attach files, and receive replies.',
        ],
      },
      {
        title: 'The essentials in one place',
        items: [
          'Browse models, compare prices, and try conversations online.',
          'Manage keys, top up your balance, and review usage records.',
        ],
      },
    ],
  },
]
