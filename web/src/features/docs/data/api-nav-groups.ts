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
import {
  AudioWave01Icon,
  CodeIcon,
  CubeIcon,
  Database01Icon,
  HeadphonesIcon,
  Image01Icon,
  Message01Icon,
  PuzzleIcon,
  Search01Icon,
  Shield01Icon,
  SparklesIcon,
  Video01Icon,
} from '@hugeicons/core-free-icons'

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
import type { ApiNavGroup } from '../lib/types'

export const API_NAV_GROUPS: ApiNavGroup[] = [
  {
    id: 'models',
    icon: Database01Icon,
    titleKey: 'Model list',
    descriptionKey: 'List and retrieve models available to the current token.',
    children: [
      {
        id: 'models-openai',
        titleKey: 'OpenAI-compatible format',
        endpointIds: ['models-list', 'models-retrieve'],
      },
    ],
  },
  {
    id: 'chat',
    icon: Message01Icon,
    titleKey: 'Chat',
    descriptionKey: 'Create OpenAI-compatible chat completions.',
    children: [
      {
        id: 'chat-openai',
        titleKey: 'Native OpenAI format',
        endpointIds: [
          'chat-completions',
          'responses-create',
          'responses-compact',
        ],
      },
      {
        id: 'chat-claude',
        titleKey: 'Native Claude format',
        endpointIds: ['claude-messages'],
      },
    ],
  },
  {
    id: 'completions',
    icon: CodeIcon,
    titleKey: 'Completions',
    descriptionKey: 'Create legacy text completions for compatible models.',
    children: [
      {
        id: 'completions-openai',
        titleKey: 'OpenAI-compatible format',
        endpointIds: ['completions-create'],
      },
    ],
  },
  {
    id: 'embeddings',
    icon: CubeIcon,
    titleKey: 'Embeddings',
    descriptionKey: 'Generate vector embeddings for text inputs.',
    children: [
      {
        id: 'embeddings-openai',
        titleKey: 'OpenAI-compatible format',
        endpointIds: ['embeddings-create'],
      },
    ],
  },
  {
    id: 'rerank',
    icon: Search01Icon,
    titleKey: 'Rerank',
    descriptionKey:
      'Rank documents against a query with supported rerank models.',
    children: [
      {
        id: 'rerank-native',
        titleKey: 'Rerank format',
        endpointIds: ['rerank-create'],
      },
    ],
  },
  {
    id: 'moderations',
    icon: Shield01Icon,
    titleKey: 'Moderations',
    descriptionKey:
      'Run content safety checks as one part of your compliance workflow.',
    children: [
      {
        id: 'moderations-openai',
        titleKey: 'OpenAI-compatible format',
        endpointIds: ['moderations-create'],
      },
    ],
  },
  {
    id: 'audio',
    icon: HeadphonesIcon,
    titleKey: 'Audio',
    descriptionKey: 'Create speech, transcriptions, and translations.',
    children: [
      {
        id: 'audio-openai',
        titleKey: 'Native OpenAI format',
        endpointIds: [
          'audio-speech',
          'audio-transcriptions',
          'audio-translations',
        ],
      },
    ],
  },
  {
    id: 'realtime',
    icon: AudioWave01Icon,
    titleKey: 'Realtime audio',
    descriptionKey: 'Connect to the OpenAI-compatible realtime relay.',
    children: [
      {
        id: 'realtime-openai',
        titleKey: 'OpenAI-compatible realtime',
        endpointIds: ['realtime-open'],
      },
    ],
  },
  {
    id: 'images',
    icon: Image01Icon,
    titleKey: 'Images',
    descriptionKey: 'Generate and edit images through compatible image models.',
    children: [
      {
        id: 'images-openai',
        titleKey: 'Native OpenAI format',
        endpointIds: ['images-generations', 'images-edits'],
      },
    ],
  },
  {
    id: 'videos',
    icon: Video01Icon,
    titleKey: 'Videos',
    descriptionKey:
      'Create, fetch, remix, and download video generation tasks.',
    children: [
      {
        id: 'videos-openai',
        titleKey: 'OpenAI-compatible video',
        endpointIds: [
          'videos-create',
          'videos-retrieve',
          'videos-content',
          'videos-remix',
        ],
      },
    ],
  },
  {
    id: 'gemini',
    icon: SparklesIcon,
    titleKey: 'Gemini native',
    descriptionKey: 'Forward native Gemini model actions through the gateway.',
    children: [
      {
        id: 'gemini-native',
        titleKey: 'Native Gemini format',
        endpointIds: ['gemini-native'],
      },
    ],
  },
  {
    id: 'stubs',
    icon: PuzzleIcon,
    titleKey: 'Compatibility stubs',
    descriptionKey:
      'Reserved OpenAI-compatible routes that currently return not implemented.',
    children: [
      {
        id: 'stubs-openai',
        titleKey: 'OpenAI-compatible format',
        endpointIds: ['compatibility-stubs'],
      },
    ],
  },
]
