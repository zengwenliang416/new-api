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
import type { ApiEndpoint, EndpointField } from '../lib/types'

export const AUTH_HEADER_FIELDS: EndpointField[] = [
  {
    name: 'Authorization',
    type: 'Bearer <token>',
    required: true,
    location: 'header',
    descriptionKey: 'Authenticate relay requests with an API token.',
  },
]

export const AUTH_JSON_HEADER_FIELDS: EndpointField[] = [
  {
    name: 'Authorization',
    type: 'Bearer <token>',
    required: true,
    location: 'header',
    descriptionKey: 'Authenticate relay requests with an API token.',
  },
  {
    name: 'Content-Type',
    type: 'application/json',
    required: true,
    location: 'header',
    descriptionKey: 'Send JSON for endpoints that accept a request body.',
  },
]

const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'models-list',
    method: 'GET',
    path: '/v1/models',
    titleKey: 'List models',
    summaryKey: 'List and retrieve models available to the current token.',
    descriptionKey:
      'Returns models visible to the API token after channel, group, and permission filtering.',
    groupId: 'models',
    groupTitleKey: 'Model list',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'none',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Model list response',
        descriptionKey: 'A list of model identifiers available to the token.',
        body: '{\n  "object": "list",\n  "data": [\n    {\n      "id": "gpt-4o-mini",\n      "object": "model",\n      "owned_by": "openai"\n    }\n  ]\n}',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey: 'The token or model rate limit has been exceeded.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Model visibility is still controlled by token permissions and channel configuration.',
      'Use this endpoint before calling generation APIs to avoid routing to unavailable models.',
    ],
    keywords: ['models', 'list', 'openai'],
  },
  {
    id: 'models-retrieve',
    method: 'GET',
    path: '/v1/models/{model}',
    samplePath: '/v1/models/gpt-4o-mini',
    titleKey: 'Retrieve model details',
    summaryKey: 'Retrieve model details',
    descriptionKey:
      'Returns metadata for a single model identifier when it is visible to the current token.',
    groupId: 'models',
    groupTitleKey: 'Model list',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'none',
    responseType: 'application/json',
    pathFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey: 'Model identifier to retrieve.',
      },
    ],
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Model detail response',
        descriptionKey: 'Metadata for a single model identifier.',
        body: '{\n  "id": "gpt-4o-mini",\n  "object": "model",\n  "owned_by": "openai"\n}',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '404',
        titleKey: 'Not found',
        descriptionKey: 'The requested model is not visible to the token.',
        body: '{\n  "error": {\n    "message": "Model not found.",\n    "type": "not_found_error",\n    "code": "model_not_found"\n  }\n}',
      },
    ],
    analysisKeys: [
      'The gateway may resolve provider-specific metadata differently across channels.',
      'Use model names exactly as returned by the model list when possible.',
    ],
    keywords: ['models', 'retrieve'],
  },
  {
    id: 'chat-completions',
    method: 'POST',
    path: '/v1/chat/completions',
    titleKey: 'ChatCompletions format',
    navTitleKey: 'ChatCompletions',
    summaryKey: 'Create chat completion',
    descriptionKey:
      'Create a model response from a conversation history. Compatible with the OpenAI Chat Completions API and supports streaming when the selected model supports it.',
    groupId: 'chat',
    groupTitleKey: 'Chat',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json or text/event-stream',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey:
          'The model identifier to route to an upstream provider.',
      },
      {
        name: 'messages',
        type: 'array<object>',
        required: true,
        descriptionKey: 'Ordered conversation messages with role and content.',
        children: [
          {
            name: 'role',
            type: 'system | user | assistant | tool',
            required: true,
            descriptionKey: 'The message role used by the model.',
          },
          {
            name: 'content',
            type: 'string | array<object>',
            required: true,
            descriptionKey: 'Text or multimodal content for this message.',
          },
          {
            name: 'name',
            type: 'string',
            descriptionKey: 'Optional participant name for compatible models.',
          },
          {
            name: 'tool_call_id',
            type: 'string',
            descriptionKey: 'Required when replying to a tool call.',
          },
        ],
      },
      {
        name: 'stream',
        type: 'boolean',
        defaultValue: 'false',
        descriptionKey:
          'When true, tokens are returned incrementally as server-sent events.',
      },
      {
        name: 'temperature',
        type: 'number',
        defaultValue: '1',
        range: '0 <= value <= 2',
        descriptionKey:
          'Sampling temperature. Higher values make output more random.',
      },
      {
        name: 'top_p',
        type: 'number',
        defaultValue: '1',
        range: '0 <= value <= 1',
        descriptionKey: 'Nucleus sampling parameter.',
      },
      {
        name: 'max_tokens',
        type: 'integer',
        descriptionKey:
          'Maximum number of output tokens for compatible models.',
      },
      {
        name: 'tools',
        type: 'array<object>',
        descriptionKey: 'Tool definitions that the model may call.',
      },
      {
        name: 'tool_choice',
        type: 'string | object',
        descriptionKey: 'Controls whether and how the model calls tools.',
      },
      {
        name: 'response_format',
        type: 'object',
        descriptionKey: 'Requests compatible structured output formats.',
      },
      {
        name: 'user',
        type: 'string',
        descriptionKey:
          'End-user identifier passed through for abuse monitoring.',
      },
    ],
    sampleBody:
      '{\n  "model": "gpt-4o-mini",\n  "messages": [\n    {\n      "role": "system",\n      "content": "You are a concise assistant."\n    },\n    {\n      "role": "user",\n      "content": "Say hello in one sentence."\n    }\n  ],\n  "temperature": 0.7,\n  "stream": false\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful chat completion',
        descriptionKey:
          'The model returns one or more choices and token usage.',
        body: '{\n  "id": "chatcmpl-abc123",\n  "object": "chat.completion",\n  "created": 1710000000,\n  "model": "gpt-4o-mini",\n  "choices": [\n    {\n      "index": 0,\n      "message": {\n        "role": "assistant",\n        "content": "Hello! How can I help?"\n      },\n      "finish_reason": "stop"\n    }\n  ],\n  "usage": {\n    "prompt_tokens": 18,\n    "completion_tokens": 7,\n    "total_tokens": 25\n  }\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'This is the primary endpoint for OpenAI-compatible chat clients.',
      'Streaming responses use server-sent events; clients should handle incremental chunks and final usage when enabled upstream.',
      'Optional scalar parameters preserve explicit zero and false values when the backend forwards supported fields.',
    ],
    keywords: ['chat', 'completion', 'openai', 'stream', 'tools'],
  },
  {
    id: 'responses-create',
    method: 'POST',
    path: '/v1/responses',
    titleKey: 'Responses format',
    summaryKey: 'Create response',
    descriptionKey:
      'Create a response using the OpenAI Responses-compatible relay path.',
    groupId: 'chat',
    groupTitleKey: 'Chat',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey:
          'The model identifier to route to an upstream provider.',
      },
      {
        name: 'input',
        type: 'string | array<object>',
        required: true,
        descriptionKey: 'Input text or message items for the response.',
      },
      {
        name: 'instructions',
        type: 'string',
        descriptionKey: 'Optional system-level instructions for the model.',
      },
      {
        name: 'stream',
        type: 'boolean',
        defaultValue: 'false',
        descriptionKey:
          'When true, tokens are returned incrementally as server-sent events.',
      },
    ],
    sampleBody:
      '{\n  "model": "gpt-4o-mini",\n  "input": "Write a one-line product tagline.",\n  "instructions": "Be concise."\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful response',
        descriptionKey: 'A Responses-compatible response object.',
        body: '{\n  "id": "resp_abc123",\n  "object": "response",\n  "status": "completed",\n  "model": "gpt-4o-mini",\n  "output_text": "One gateway. Every model."\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Use this endpoint for clients that already target the OpenAI Responses API.',
      'The gateway still applies the same token authentication, rate limit, and channel distribution layers.',
    ],
    keywords: ['responses', 'openai', 'input'],
  },
  {
    id: 'responses-compact',
    method: 'POST',
    path: '/v1/responses/compact',
    titleKey: 'Compact response',
    summaryKey: 'Create compacted response',
    descriptionKey:
      'Create a compacted Responses-compatible request for clients that need response compaction behavior.',
    groupId: 'chat',
    groupTitleKey: 'Chat',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey:
          'The model identifier to route to an upstream provider.',
      },
      {
        name: 'input',
        type: 'string | array<object>',
        required: true,
        descriptionKey: 'Input text or message items for the response.',
      },
    ],
    sampleBody:
      '{\n  "model": "gpt-4o-mini",\n  "input": "Summarize the prior conversation in three bullets."\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful response',
        descriptionKey: 'A compacted Responses-compatible response object.',
        body: '{\n  "id": "resp_compact_abc123",\n  "object": "response",\n  "status": "completed",\n  "output_text": "- Point one\\n- Point two\\n- Point three"\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'This route is separate so clients can opt into compaction without changing the base Responses path.',
      'Use the normal Responses endpoint unless your client explicitly needs compaction semantics.',
    ],
    keywords: ['responses', 'compact'],
  },
  {
    id: 'completions-create',
    method: 'POST',
    path: '/v1/completions',
    titleKey: 'Create completion',
    summaryKey: 'Create completion',
    descriptionKey:
      'Create a legacy text completion for models that support the OpenAI Completions format.',
    groupId: 'completions',
    groupTitleKey: 'Completions',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey:
          'The model identifier to route to an upstream provider.',
      },
      {
        name: 'prompt',
        type: 'string | array<string>',
        required: true,
        descriptionKey: 'Prompt text for the model to complete.',
      },
      {
        name: 'max_tokens',
        type: 'integer',
        descriptionKey:
          'Maximum number of output tokens for compatible models.',
      },
      {
        name: 'temperature',
        type: 'number',
        defaultValue: '1',
        range: '0 <= value <= 2',
        descriptionKey:
          'Sampling temperature. Higher values make output more random.',
      },
    ],
    sampleBody:
      '{\n  "model": "gpt-3.5-turbo-instruct",\n  "prompt": "Write a short API gateway tagline:",\n  "max_tokens": 32\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful completion',
        descriptionKey: 'The model returns text completion choices.',
        body: '{\n  "id": "cmpl_abc123",\n  "object": "text_completion",\n  "choices": [\n    {\n      "text": " Unified access for every AI model.",\n      "index": 0,\n      "finish_reason": "stop"\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Prefer Chat Completions for modern chat models.',
      'Keep this route for legacy SDKs and models that still expose completion semantics.',
    ],
    keywords: ['completion', 'legacy', 'text'],
  },
  {
    id: 'embeddings-create',
    method: 'POST',
    path: '/v1/embeddings',
    titleKey: 'Create embedding',
    summaryKey: 'Create embedding',
    descriptionKey:
      'Generate vector embeddings for text inputs through compatible embedding models.',
    groupId: 'embeddings',
    groupTitleKey: 'Embeddings',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The embedding model identifier.',
      },
      {
        name: 'input',
        type: 'string | array<string>',
        required: true,
        descriptionKey: 'Text input to embed.',
      },
      {
        name: 'encoding_format',
        type: 'float | base64',
        descriptionKey: 'Optional embedding encoding format.',
      },
    ],
    sampleBody:
      '{\n  "model": "text-embedding-3-small",\n  "input": "The quick brown fox jumps over the lazy dog."\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful embedding',
        descriptionKey:
          'The model returns one embedding vector per input item.',
        body: '{\n  "object": "list",\n  "data": [\n    {\n      "object": "embedding",\n      "index": 0,\n      "embedding": [0.0123, -0.0456, 0.0789]\n    }\n  ],\n  "model": "text-embedding-3-small"\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Embedding dimensions depend on the selected upstream model.',
      'Batch inputs may increase token usage and billing in one request.',
    ],
    keywords: ['embedding', 'vector'],
  },
  {
    id: 'rerank-create',
    method: 'POST',
    path: '/v1/rerank',
    titleKey: 'Create rerank request',
    summaryKey: 'Create rerank request',
    descriptionKey:
      'Rank candidate documents against a query with a supported rerank model.',
    groupId: 'rerank',
    groupTitleKey: 'Rerank',
    formatKey: 'Rerank format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The rerank model identifier.',
      },
      {
        name: 'query',
        type: 'string',
        required: true,
        descriptionKey: 'Search query used to score candidate documents.',
      },
      {
        name: 'documents',
        type: 'array<string>',
        required: true,
        descriptionKey: 'Candidate documents to rank.',
      },
      {
        name: 'top_n',
        type: 'integer',
        descriptionKey: 'Optional number of ranked documents to return.',
      },
    ],
    sampleBody:
      '{\n  "model": "rerank-model",\n  "query": "best AI gateway",\n  "documents": [\n    "Unified API routing for model providers.",\n    "A guide to database migrations."\n  ],\n  "top_n": 2\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful rerank',
        descriptionKey: 'Ranked documents with relevance scores.',
        body: '{\n  "results": [\n    {\n      "index": 0,\n      "relevance_score": 0.98\n    },\n    {\n      "index": 1,\n      "relevance_score": 0.12\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Rerank requests are routed through the dedicated rerank relay format.',
      'Documents should be trimmed to the upstream provider limits before sending large batches.',
    ],
    keywords: ['rerank', 'query', 'documents'],
  },
  {
    id: 'moderations-create',
    method: 'POST',
    path: '/v1/moderations',
    titleKey: 'Create moderation',
    summaryKey: 'Create moderation',
    descriptionKey:
      'Run content safety checks as one part of your compliance workflow.',
    groupId: 'moderations',
    groupTitleKey: 'Moderations',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        descriptionKey: 'Optional moderation model identifier.',
      },
      {
        name: 'input',
        type: 'string | array<string>',
        required: true,
        descriptionKey: 'Content to classify for safety categories.',
      },
    ],
    sampleBody:
      '{\n  "model": "omni-moderation-latest",\n  "input": "I want to understand API safety controls."\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful moderation',
        descriptionKey: 'Safety category results returned by the provider.',
        body: '{\n  "id": "modr_abc123",\n  "model": "omni-moderation-latest",\n  "results": [\n    {\n      "flagged": false,\n      "categories": {}\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Moderation is a compliance aid, not a replacement for your own safety governance.',
      'Public-facing services should combine this endpoint with abuse reporting, logging, and enforcement workflows.',
    ],
    keywords: ['moderation', 'safety', 'compliance'],
  },
  {
    id: 'audio-speech',
    method: 'POST',
    path: '/v1/audio/speech',
    titleKey: 'Create speech',
    summaryKey: 'Create speech',
    descriptionKey: 'Convert text into audio using a compatible speech model.',
    groupId: 'audio',
    groupTitleKey: 'Audio',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'audio/*',
    downloadFileName: 'speech.mp3',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The speech model identifier.',
      },
      {
        name: 'input',
        type: 'string',
        required: true,
        descriptionKey: 'Text to synthesize into speech.',
      },
      {
        name: 'voice',
        type: 'string',
        required: true,
        descriptionKey: 'Voice identifier supported by the selected model.',
      },
      {
        name: 'response_format',
        type: 'string',
        descriptionKey: 'Optional audio format such as mp3, wav, or opus.',
      },
    ],
    sampleBody:
      '{\n  "model": "tts-1",\n  "input": "Hello from New API.",\n  "voice": "alloy",\n  "response_format": "mp3"\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful audio response',
        descriptionKey:
          'Binary audio bytes are returned by the upstream provider.',
        body: '"<binary audio bytes>"',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'The response content type depends on the upstream model and requested format.',
      'Persist the binary response directly; do not parse it as JSON on success.',
    ],
    keywords: ['audio', 'speech', 'tts'],
  },
  {
    id: 'audio-transcriptions',
    method: 'POST',
    path: '/v1/audio/transcriptions',
    titleKey: 'Create transcription',
    summaryKey: 'Create transcription',
    descriptionKey: 'Transcribe uploaded audio into text.',
    groupId: 'audio',
    groupTitleKey: 'Audio',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'multipart/form-data',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The transcription model identifier.',
      },
      {
        name: 'file',
        type: 'file',
        required: true,
        descriptionKey: 'Audio file to transcribe.',
      },
      {
        name: 'language',
        type: 'string',
        descriptionKey: 'Optional input language hint.',
      },
      {
        name: 'response_format',
        type: 'json | text | srt | verbose_json | vtt',
        descriptionKey: 'Optional transcription response format.',
      },
    ],
    formFields: [
      {
        name: 'model',
        type: 'whisper-1',
        required: true,
        descriptionKey: 'The transcription model identifier.',
      },
      {
        name: 'file',
        type: '@audio.mp3',
        required: true,
        descriptionKey: 'Audio file to transcribe.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful transcription',
        descriptionKey: 'The provider returns transcribed text.',
        body: '{\n  "text": "Hello from New API."\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The multipart body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'This endpoint expects multipart form data because audio bytes are uploaded with the request.',
      'Do not set the multipart boundary manually; let your HTTP client generate it.',
    ],
    keywords: ['audio', 'transcription', 'whisper'],
  },
  {
    id: 'audio-translations',
    method: 'POST',
    path: '/v1/audio/translations',
    titleKey: 'Create translation',
    summaryKey: 'Create translation',
    descriptionKey:
      'Translate uploaded audio into English text when supported.',
    groupId: 'audio',
    groupTitleKey: 'Audio',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'multipart/form-data',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The audio translation model identifier.',
      },
      {
        name: 'file',
        type: 'file',
        required: true,
        descriptionKey: 'Audio file to translate.',
      },
      {
        name: 'response_format',
        type: 'json | text | srt | verbose_json | vtt',
        descriptionKey: 'Optional translation response format.',
      },
    ],
    formFields: [
      {
        name: 'model',
        type: 'whisper-1',
        required: true,
        descriptionKey: 'The audio translation model identifier.',
      },
      {
        name: 'file',
        type: '@audio.mp3',
        required: true,
        descriptionKey: 'Audio file to translate.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful translation',
        descriptionKey: 'The provider returns translated text.',
        body: '{\n  "text": "Hello from New API."\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The multipart body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'This endpoint follows the OpenAI-compatible audio translation shape.',
      'Provider support and target language behavior depend on the configured upstream channel.',
    ],
    keywords: ['audio', 'translation', 'whisper'],
  },
  {
    id: 'realtime-open',
    method: 'GET',
    path: '/v1/realtime',
    samplePath: '/v1/realtime?model=gpt-realtime',
    transport: 'websocket',
    titleKey: 'Open realtime session',
    summaryKey: 'Open realtime session',
    descriptionKey:
      'Open a realtime relay connection for compatible low-latency audio clients.',
    groupId: 'realtime',
    groupTitleKey: 'Realtime audio',
    formatKey: 'OpenAI-compatible realtime',
    auth: 'bearer',
    contentType: 'none',
    responseType: 'websocket / realtime stream',
    queryFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        location: 'query',
        descriptionKey: 'The model identifier to use for generation.',
      },
    ],
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '101',
        titleKey: 'Realtime stream opened',
        descriptionKey: 'The connection is upgraded or streamed by the relay.',
        body: '"<realtime stream>"',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Realtime clients should keep authentication headers available during connection setup.',
      'The selected upstream channel must support realtime relay behavior.',
    ],
    keywords: ['realtime', 'audio', 'websocket'],
  },
  {
    id: 'images-generations',
    method: 'POST',
    path: '/v1/images/generations',
    titleKey: 'Create image generation',
    summaryKey: 'Create image generation',
    descriptionKey:
      'Generate images through compatible image generation models.',
    groupId: 'images',
    groupTitleKey: 'Images',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        descriptionKey: 'Optional image model identifier.',
      },
      {
        name: 'prompt',
        type: 'string',
        required: true,
        descriptionKey: 'Text prompt used to generate images.',
      },
      {
        name: 'n',
        type: 'integer',
        defaultValue: '1',
        descriptionKey: 'Number of images to generate when supported.',
      },
      {
        name: 'size',
        type: 'string',
        descriptionKey: 'Requested image size when supported by the model.',
      },
      {
        name: 'response_format',
        type: 'string',
        defaultValue: 'url',
        descriptionKey: 'Image output format requested from the provider.',
      },
    ],
    sampleBody:
      '{\n  "model": "gpt-image-2",\n  "prompt": "A compact API gateway dashboard in a clean product UI",\n  "n": 1,\n  "size": "1024x1024",\n  "response_format": "url"\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful image generation',
        descriptionKey:
          'Generated image URLs or base64 data are returned by the provider.',
        body: '{\n  "created": 1710000000,\n  "data": [\n    {\n      "url": "https://example.com/generated-image.png"\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Prefer response_format=url: the response stays tiny and the image downloads from object storage, instead of inflating the API response with multi-MB base64.',
      'Hosted image links have limited validity (about 1 hour) — download and persist images you need to keep.',
      'Image generation does not need streaming: with stream enabled you still receive one completion event carrying the final url.',
      'Large image sizes and multiple outputs may have higher billing impact.',
    ],
    keywords: ['image', 'generation'],
  },
  {
    id: 'images-edits',
    method: 'POST',
    path: '/v1/images/edits',
    titleKey: 'Create image edit',
    summaryKey: 'Create image edit',
    descriptionKey: 'Edit an uploaded image using a compatible image model.',
    groupId: 'images',
    groupTitleKey: 'Images',
    formatKey: 'Native OpenAI format',
    auth: 'bearer',
    contentType: 'multipart/form-data',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'image',
        type: 'file',
        required: true,
        descriptionKey: 'Source image file to edit.',
      },
      {
        name: 'prompt',
        type: 'string',
        required: true,
        descriptionKey: 'Text instruction describing the edit.',
      },
      {
        name: 'model',
        type: 'string',
        descriptionKey: 'Optional image model identifier.',
      },
      {
        name: 'response_format',
        type: 'string',
        defaultValue: 'url',
        descriptionKey: 'Image output format requested from the provider.',
      },
    ],
    formFields: [
      {
        name: 'image',
        type: '@image.png',
        required: true,
        descriptionKey: 'Source image file to edit.',
      },
      {
        name: 'prompt',
        type: 'Add a subtle product UI glow.',
        required: true,
        descriptionKey: 'Text instruction describing the edit.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful image edit',
        descriptionKey:
          'Edited image URLs or base64 data are returned by the provider.',
        body: '{\n  "created": 1710000000,\n  "data": [\n    {\n      "url": "https://example.com/edited-image.png"\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The multipart body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'This endpoint expects multipart form data because the source image is uploaded.',
      'Prefer response_format=url: the response stays tiny and the image downloads from object storage, instead of inflating the API response with multi-MB base64.',
      'Hosted image links have limited validity (about 1 hour) — download and persist images you need to keep.',
      'Provider-specific limits apply to image size, masks, and output formats.',
    ],
    keywords: ['image', 'edit'],
  },
  {
    id: 'videos-create',
    method: 'POST',
    path: '/v1/videos',
    titleKey: 'Create video',
    summaryKey: 'Create video',
    descriptionKey: 'Create an OpenAI-compatible video generation task.',
    groupId: 'videos',
    groupTitleKey: 'Videos',
    formatKey: 'OpenAI-compatible video',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey: 'The video model identifier.',
      },
      {
        name: 'prompt',
        type: 'string',
        required: true,
        descriptionKey: 'Text prompt used to generate the video.',
      },
      {
        name: 'size',
        type: 'string',
        descriptionKey: 'Requested video size when supported by the model.',
      },
      {
        name: 'seconds',
        type: 'integer',
        descriptionKey: 'Requested duration when supported by the model.',
      },
    ],
    sampleBody:
      '{\n  "model": "sora",\n  "prompt": "A clean API dashboard animating from request to response.",\n  "size": "1280x720",\n  "seconds": 5\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Video task created',
        descriptionKey: 'A task identifier is returned for later retrieval.',
        body: '{\n  "id": "video_task_abc123",\n  "object": "video",\n  "status": "queued"\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Video generation is task-based; use the retrieve endpoint to poll completion.',
      'Generated content can be downloaded through the content proxy endpoint after completion.',
    ],
    keywords: ['video', 'sora', 'task'],
  },
  {
    id: 'videos-retrieve',
    method: 'GET',
    path: '/v1/videos/{task_id}',
    samplePath: '/v1/videos/video_task_abc123',
    titleKey: 'Retrieve video task',
    summaryKey: 'Retrieve video task',
    descriptionKey: 'Fetch the latest status and metadata for a video task.',
    groupId: 'videos',
    groupTitleKey: 'Videos',
    formatKey: 'OpenAI-compatible video',
    auth: 'bearer',
    contentType: 'none',
    responseType: 'application/json',
    pathFields: [
      {
        name: 'task_id',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey:
          'Video task identifier returned by the create endpoint.',
      },
    ],
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Video task status',
        descriptionKey: 'The current task status and result metadata.',
        body: '{\n  "id": "video_task_abc123",\n  "object": "video",\n  "status": "completed",\n  "content_url": "/v1/videos/video_task_abc123/content"\n}',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '404',
        titleKey: 'Not found',
        descriptionKey: 'The requested video task was not found.',
        body: '{\n  "error": {\n    "message": "Video task not found.",\n    "type": "not_found_error",\n    "code": "task_not_found"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Poll this endpoint until the task reaches a terminal status.',
      'Use the content endpoint only after the task reports a generated asset.',
    ],
    keywords: ['video', 'task', 'retrieve'],
  },
  {
    id: 'videos-content',
    method: 'GET',
    path: '/v1/videos/{task_id}/content',
    samplePath: '/v1/videos/video_task_abc123/content',
    titleKey: 'Download video content',
    summaryKey: 'Download video content',
    descriptionKey:
      'Proxy the generated video content for a completed video generation task.',
    groupId: 'videos',
    groupTitleKey: 'Videos',
    formatKey: 'OpenAI-compatible video',
    auth: 'session-or-bearer',
    contentType: 'none',
    responseType: 'video/*',
    downloadFileName: 'video.mp4',
    pathFields: [
      {
        name: 'task_id',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey:
          'Video task identifier returned by the create endpoint.',
      },
    ],
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful video download',
        descriptionKey: 'Binary video bytes are streamed through the proxy.',
        body: '"<binary video bytes>"',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '404',
        titleKey: 'Not found',
        descriptionKey: 'The requested video content was not found.',
        body: '{\n  "error": {\n    "message": "Video content not found.",\n    "type": "not_found_error",\n    "code": "content_not_found"\n  }\n}',
      },
    ],
    analysisKeys: [
      'The route accepts either dashboard session auth or API token auth.',
      'Treat successful responses as binary media, not JSON.',
    ],
    keywords: ['video', 'download', 'content'],
  },
  {
    id: 'videos-remix',
    method: 'POST',
    path: '/v1/videos/{video_id}/remix',
    samplePath: '/v1/videos/video_abc123/remix',
    titleKey: 'Remix video',
    summaryKey: 'Remix video',
    descriptionKey:
      'Create a new video task from an existing video identifier.',
    groupId: 'videos',
    groupTitleKey: 'Videos',
    formatKey: 'OpenAI-compatible video',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    pathFields: [
      {
        name: 'video_id',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey: 'Source video identifier to remix.',
      },
    ],
    requestFields: [
      {
        name: 'prompt',
        type: 'string',
        required: true,
        descriptionKey: 'Text prompt describing the remix.',
      },
    ],
    sampleBody:
      '{\n  "prompt": "Make the motion slower and keep the dashboard readable."\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Video task created',
        descriptionKey:
          'A remix task identifier is returned for later retrieval.',
        body: '{\n  "id": "video_task_remix_abc123",\n  "object": "video",\n  "status": "queued"\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Use this route when an upstream video provider supports remixing existing assets.',
      'The source video identifier is part of the path, while remix instructions live in the body.',
    ],
    keywords: ['video', 'remix'],
  },
  {
    id: 'claude-messages',
    method: 'POST',
    path: '/v1/messages',
    titleKey: 'Claude messages',
    summaryKey: 'Create message',
    descriptionKey:
      'Use the Claude-compatible messages endpoint through the gateway.',
    groupId: 'claude',
    groupTitleKey: 'Claude messages',
    formatKey: 'Native Claude format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        descriptionKey:
          'The model identifier to route to an upstream provider.',
      },
      {
        name: 'messages',
        type: 'array<object>',
        required: true,
        descriptionKey: 'Ordered conversation messages with role and content.',
      },
      {
        name: 'max_tokens',
        type: 'integer',
        required: true,
        descriptionKey:
          'Maximum number of output tokens for compatible models.',
      },
    ],
    sampleBody:
      '{\n  "model": "claude-3-5-sonnet-latest",\n  "max_tokens": 256,\n  "messages": [\n    {\n      "role": "user",\n      "content": "Explain this gateway in one sentence."\n    }\n  ]\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful message',
        descriptionKey: 'A Claude-compatible message response.',
        body: '{\n  "id": "msg_abc123",\n  "type": "message",\n  "role": "assistant",\n  "content": [\n    {\n      "type": "text",\n      "text": "It unifies AI provider access behind one controlled API."\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Use this route for clients that target Anthropic Claude message semantics.',
      'The gateway still authenticates with its own API token and then distributes to configured upstream channels.',
    ],
    keywords: ['claude', 'anthropic', 'messages'],
  },
  {
    id: 'gemini-native',
    method: 'POST',
    path: '/v1beta/models/{model}:{action}',
    samplePath: '/v1beta/models/gemini-1.5-pro:generateContent',
    titleKey: 'Run Gemini model action',
    summaryKey: 'Run Gemini model action',
    descriptionKey: 'Forward native Gemini model actions through the gateway.',
    groupId: 'gemini',
    groupTitleKey: 'Gemini native',
    formatKey: 'Native Gemini format',
    auth: 'bearer',
    contentType: 'application/json',
    responseType: 'application/json',
    pathFields: [
      {
        name: 'model',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey: 'Gemini model identifier.',
      },
      {
        name: 'action',
        type: 'string',
        required: true,
        location: 'path',
        descriptionKey: 'Gemini action such as generateContent.',
      },
    ],
    requestFields: [
      {
        name: 'contents',
        type: 'array<object>',
        required: true,
        descriptionKey: 'Gemini content parts sent to the model.',
      },
    ],
    sampleBody:
      '{\n  "contents": [\n    {\n      "parts": [\n        {\n          "text": "Explain this API gateway in one sentence."\n        }\n      ]\n    }\n  ]\n}',
    responseExamples: [
      {
        status: '200',
        titleKey: 'Successful Gemini response',
        descriptionKey: 'A native Gemini response returned through the relay.',
        body: '{\n  "candidates": [\n    {\n      "content": {\n        "parts": [\n          {\n            "text": "Hlool API unifies access to multiple AI providers."\n          }\n        ]\n      }\n    }\n  ]\n}',
      },
      {
        status: '400',
        titleKey: 'Invalid request',
        descriptionKey:
          'The JSON body is malformed or missing a required field.',
        body: '{\n  "error": {\n    "message": "The request body is invalid.",\n    "type": "invalid_request_error",\n    "code": "invalid_request"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'The wildcard path preserves Gemini-native action syntax such as :generateContent.',
      'Use this route for native Gemini clients rather than OpenAI-compatible clients.',
    ],
    keywords: ['gemini', 'native', 'generateContent'],
  },
  {
    id: 'compatibility-stubs',
    method: 'GET',
    path: '/v1/files',
    titleKey: 'Compatibility stubs',
    summaryKey: 'Files list stub',
    descriptionKey:
      'Reserved OpenAI-compatible routes exist for SDK compatibility but currently return not implemented.',
    groupId: 'stubs',
    groupTitleKey: 'Compatibility stubs',
    formatKey: 'OpenAI-compatible format',
    auth: 'bearer',
    contentType: 'none',
    responseType: 'application/json',
    requestFields: [
      {
        name: 'request body',
        type: 'none',
        descriptionKey: 'This endpoint does not require a request body.',
      },
    ],
    responseExamples: [
      {
        status: '501',
        titleKey: 'Not implemented',
        descriptionKey: 'The compatibility route is reserved but unavailable.',
        body: '{\n  "error": {\n    "message": "This compatibility route is not implemented.",\n    "type": "not_implemented_error",\n    "code": "not_implemented"\n  }\n}',
      },
      {
        status: '401',
        titleKey: 'Authentication error',
        descriptionKey: 'The token is missing or invalid.',
        body: '{\n  "error": {\n    "message": "Missing or invalid API key.",\n    "type": "authentication_error",\n    "code": "invalid_api_key"\n  }\n}',
      },
      {
        status: '429',
        titleKey: 'Rate limited',
        descriptionKey:
          'The token, user group, or upstream channel is rate limited.',
        body: '{\n  "error": {\n    "message": "Rate limit exceeded. Please retry later.",\n    "type": "rate_limit_error",\n    "code": "rate_limit_exceeded"\n  }\n}',
      },
    ],
    analysisKeys: [
      'Stub routes help older SDKs fail consistently instead of reaching unknown paths.',
      'Do not build new integrations on these routes until they are implemented.',
    ],
    keywords: ['files', 'fine-tunes', 'stubs', 'not implemented'],
  },
]

export const ENDPOINT_MAP: Record<string, ApiEndpoint> = Object.fromEntries(
  API_ENDPOINTS.map((endpoint) => [endpoint.id, endpoint])
)

export const DEFAULT_ENDPOINT_ID = 'chat-completions'
