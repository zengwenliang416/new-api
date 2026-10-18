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
  BotMessageSquareIcon,
  Bug01Icon,
  CodeCircleIcon,
  DashboardCircleIcon,
  Rocket01Icon,
  TerminalIcon,
} from '@hugeicons/core-free-icons'

import type { DocsGuide, GuideCategory } from '../lib/types'

export const GUIDE_CATEGORIES: GuideCategory[] = [
  {
    id: 'getting-started',
    icon: Rocket01Icon,
    titleKey: 'Getting started',
  },
  {
    id: 'platform',
    icon: DashboardCircleIcon,
    titleKey: 'Platform features',
  },
  {
    id: 'coding-cli',
    icon: TerminalIcon,
    titleKey: 'Coding CLI tools',
  },
  {
    id: 'chat-clients',
    icon: BotMessageSquareIcon,
    titleKey: 'Clients & tools',
  },
  {
    id: 'sdk',
    icon: CodeCircleIcon,
    titleKey: 'SDK integration',
  },
  {
    id: 'troubleshooting',
    icon: Bug01Icon,
    titleKey: 'Troubleshooting',
  },
]

export const DOCS_GUIDES: DocsGuide[] = [
  {
    slug: 'quick-start',
    categoryId: 'getting-started',
    titleKey: 'Quick start: first request in 5 minutes',
    summaryKey:
      'Register, create an API key, and send your first request to the gateway.',
    keywords: ['quick start', 'register', 'token', 'curl', '快速开始', '注册'],
    content: {
      zh: '从注册、创建令牌到发出第一个请求，按下面五步开始使用 {{SITE_NAME}}。这是一个 AI API 网关：你在这里创建 API 令牌，再通过站点支持的 OpenAI / Anthropic 兼容接口调用可用模型。\n\n## 第 1 步：注册并登录\n\n在右上角注册并登录。如果站点启用了邀请制，需要先获取邀请码；注册关闭时，请使用已有账户或联系管理员。\n\n## 第 2 步：创建 API 令牌\n\n进入 **控制台 → API 密钥**，点击创建。建议：\n\n- 每个应用或工具使用独立令牌，方便单独禁用与统计。\n- 根据当前账户可用选项选择分组、额度和有效期；无限额度不代表调用免费，仍受账户余额、订阅和其他限制约束。\n- 令牌属于敏感凭据，不要公开分享；泄露后应立即禁用或删除并重新创建。\n\n> 本页示例使用占位值，不会自动读取你的真实密钥。请在本地环境设置 `NEW_API_KEY`，不要把凭据提交到代码仓库。\n\n## 第 3 步：确认余额\n\n进入 [钱包](/wallet) 查看可用余额或订阅。需要时使用站点启用的充值或兑换入口；调用后可在使用日志中核对已有的请求记录与费用。\n\n## 第 4 步：发送第一个请求\n\nAPI 根地址是 `{{BASE_URL}}`；OpenAI SDK 的 Base URL 通常使用 `{{BASE_URL}}/v1`。先通过 [定价](/pricing) 或使用自己的密钥请求 `/v1/models` 确认模型，将下面的 `available-model` 替换为可访问、支持 Chat Completions 的模型：\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/chat/completions\' \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -d \'{\n    "model": "available-model",\n    "messages": [{"role": "user", "content": "用一句话打个招呼"}]\n  }\'\n```\n\n## 第 5 步：验证与下一步\n\n成功响应证明这次密钥、模型和线路组合可用。站内聊天可能使用不同的认证或配置，不能代替外部密钥验证。失败时查看 HTTP 状态、响应正文和可用的使用日志。\n\n接下来按你的工具选择接入指南：\n\n{{QUICK_START_GUIDES}}\n',
      en: 'Start using {{SITE_NAME}} in five steps: sign in, create a key, and send your first request. This AI API gateway lets you call available models through its supported OpenAI / Anthropic-compatible endpoints.\n\n## Step 1: Register and sign in\n\nRegister and sign in from the top-right corner. Get an invitation code first if required. If registration is closed, use an existing account or contact the administrator.\n\n## Step 2: Create an API key\n\nOpen **Console → API Keys** and select Create. Recommendations:\n\n- Use a separate key for each application or tool so you can disable and audit them independently.\n- Choose a group, quota, and expiry from the options available to your account. Unlimited key quota does not make requests free; account balances, subscriptions, and other limits still apply.\n- Keys are sensitive credentials. Do not publish them; disable or delete a leaked key and create a replacement.\n\n> These examples use placeholders and do not automatically read your real key. Set `NEW_API_KEY` in your local environment and keep credentials out of source control.\n\n## Step 3: Check your balance\n\nOpen [Wallet](/wallet) to check your available balance or subscription. Use the site\'s enabled top-up or redemption options when needed. After a request, inspect available usage records and charges in Usage Logs.\n\n## Step 4: Send your first request\n\nThe API root is `{{BASE_URL}}`; OpenAI SDKs typically use `{{BASE_URL}}/v1`. Find a model on [Pricing](/pricing) or by requesting `/v1/models` with your own key. Replace `available-model` below with an accessible model that supports Chat Completions:\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/chat/completions\' \\\n  -H "Content-Type: application/json" \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -d \'{\n    "model": "available-model",\n    "messages": [{"role": "user", "content": "Say hello in one sentence"}]\n  }\'\n```\n\n## Step 5: Verify and continue\n\nA successful response validates this particular key, model, and route. Dashboard chat may use different authentication or configuration and does not replace testing the external key. On failure, inspect the HTTP status, response body, and available usage logs.\n\nNext, choose the guide for your tool:\n\n{{QUICK_START_GUIDES}}\n',
    },
  },
  {
    slug: 'image-gen',
    categoryId: 'getting-started',
    titleKey: 'Image generation and response formats',
    summaryKey:
      'Generate and edit images using the formats supported by your selected model.',
    keywords: [
      'image',
      'images',
      'url',
      'b64_json',
      'base64',
      '生图',
      '图片',
      '绘图',
    ],
    content: {
      zh: '图片接口的可用模型、参数和返回格式取决于站点配置与上游能力。先在 [定价](/pricing) 确认生图模型，再查看 [API 参考](/docs/api#images-generations)。\n\n## 发送请求\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/images/generations\' \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"model":"available-image-model","prompt":"A small red boat on a quiet lake","n":1}\'\n```\n\n请将模型占位值替换为实际模型。不要假定所有图像模型支持同一套尺寸、质量、格式或流式参数。\n\n## 读取图片\n\n成功响应可能包含 `data[].url` 或 `data[].b64_json`。使用 URL 时下载对应图片；使用 base64 时先解码再保存。URL 的有效期和存储策略由具体提供方与站点决定，本指南不承诺固定保留时长。\n\n部分模型支持流式图像事件。只有在确认模型与渠道支持、且客户端能解析对应事件协议时，才启用流式；普通 JSON 示例不用于解析 SSE。\n\n## 编辑图片\n\n`/v1/images/edits` 使用 multipart 上传。复用 [图片编辑参考](/docs/api#images-edits) 中的文件示例，填写模型所要求的字段。先检查 HTTP 状态，再读取结果；错误响应不能当作图片处理。\n',
      en: 'Available image models, parameters, and response formats depend on site configuration and upstream capabilities. Check [Pricing](/pricing), then the [API reference](/docs/api#images-generations).\n\n## Send a request\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/images/generations\' \\\n  -H "Authorization: Bearer $NEW_API_KEY" \\\n  -H \'Content-Type: application/json\' \\\n  -d \'{"model":"available-image-model","prompt":"A small red boat on a quiet lake","n":1}\'\n```\n\nReplace the model placeholder. Do not assume all image models support identical size, quality, format, or streaming options.\n\n## Read the image\n\nA successful response may contain `data[].url` or `data[].b64_json`. Download a URL result or decode the base64 bytes before saving. URL expiry and retention depend on the provider and site; no fixed retention period is promised here.\n\nSome models support streaming image events. Enable streaming only when the model/channel supports it and your client can parse the corresponding event protocol. A normal JSON example does not parse SSE.\n\n## Edit an image\n\n`/v1/images/edits` uses multipart uploads. Use the actual file examples in the [image edit reference](/docs/api#images-edits), including fields required by your model. Check HTTP status before reading results; error bodies are not images.\n',
    },
  },
  {
    slug: 'image-api-skill',
    categoryId: 'getting-started',
    titleKey: 'Use an AI assistant with the API reference',
    summaryKey:
      'Share public API documentation without sharing account credentials.',
    keywords: [
      'skill',
      'image',
      'async',
      'edits',
      'img2img',
      'task',
      '生图',
      '图生图',
      '异步',
      '改图',
    ],
    content: {
      zh: '可把文档中心的 **AI 可读文档** 链接交给助手，或使用接口页的 **复制 Markdown** 提供某个接口的说明。文档是公开指南与接口参考，不包含账户密钥、实时余额或当前渠道可用性。\n\n## 给助手的任务信息\n\n提供 API 根地址 `{{BASE_URL}}`、目标协议、可用模型名称和脱敏后的错误信息。要求助手从本机环境变量读取 `NEW_API_KEY`，不要把密钥写进提示词、日志或生成的仓库文件。\n\n例如：根据图片接口参考编写一个脚本，从环境变量读取密钥，检查 HTTP 状态，再根据响应里的 `url` 或 `b64_json` 保存图片。模型参数应以当前模型能力为准。\n\n本站文档不提供自动安装的 Skill 包。若使用第三方 Skill，先检查其代码、访问的域名和凭据处理方式，再按你的客户端官方文档安装。\n',
      en: "Share the documentation center's **AI-ready documentation** link, or use **Copy Markdown** on a specific endpoint. This is a public guide and API reference, without account keys, live balances, or current channel availability.\n\n## Describe the task\n\nProvide the API root `{{BASE_URL}}`, protocol, available model name, and redacted error details. Ask the assistant to read `NEW_API_KEY` from the local environment rather than placing credentials in prompts, logs, or repository files.\n\nFor example, ask for an image-generation script that checks HTTP status and saves the result from `url` or `b64_json`, using parameters supported by the selected model.\n\nThis documentation does not supply an automatically installed Skill package. Review a third-party Skill's code, destinations, and credential handling before installing it through your client's official workflow.\n",
    },
    recommended: true,
  },
  {
    slug: 'groups-and-chains',
    categoryId: 'platform',
    titleKey: 'API key groups and automatic routing',
    summaryKey:
      'Choose a key group and configure the available automatic group order.',
    keywords: [
      'group',
      'auto',
      'chain',
      'retry',
      'migration',
      '分组',
      '分组链',
      '跨组重试',
      '平滑迁移',
    ],
    content: {
      zh: '[API 密钥](/keys) 的分组控制请求可使用的渠道范围。可选择的分组由账户权限与站点配置决定；同一模型在不同分组下的价格请查看 [定价](/pricing)。\n\n## 选择分组\n\n编辑密钥时可选择跟随账户分组、指定分组，或站点允许的 `auto` 自动分组。自动模式支持继承站点顺序或设置当前密钥的自定义分组顺序；数量上限和可用选项以表单为准。\n\n自动模式的 **跨分组重试** 是可配置选项，并非无条件启用。它与站点重试策略共同决定失败后的处理，不能保证每次请求都成功。\n\n自定义分组顺序保存在当前密钥上；调整其他密钥时，请分别核对它们的配置。\n\n## 验证变更\n\n保存后用该密钥发送一次请求，并查看响应与可用的使用日志。分组或模型不可用时，核对当前权限、模型名称和配置，不要通过扩大密钥权限来绕过预期限制。仍有疑问时联系管理员或 [工单中心](/support)。\n',
      en: "The group on an [API key](/keys) controls which channel pool can serve its requests. Available groups depend on account permissions and site configuration. Compare model prices on [Pricing](/pricing).\n\n## Choose a group\n\nA key can follow its account group, select a specific group, or use `auto` when available. Automatic mode can inherit the site's order or define an order for this key; consult the form for available groups and limits.\n\n**Cross-group retry** is configurable in automatic mode, not unconditional. Together with site retry policies it controls failure handling and does not guarantee success.\n\nThe custom order belongs to the current key. Check each key separately when updating routing preferences.\n\n## Verify a change\n\nSave the key and send a request with it. Inspect the response and available usage logs. For unavailable groups/models, check permissions and configuration without removing intended key restrictions. Contact the administrator or [Support Center](/support) when needed.\n",
    },
    recommended: true,
  },
  {
    slug: 'coding-deposit',
    categoryId: 'platform',
    titleKey: 'Group access and account restrictions',
    summaryKey:
      'Check available groups and ask the site operator about access requirements.',
    keywords: ['coding', 'deposit', 'appeal', '押金', '开通', '申诉', '退款'],
    content: {
      zh: '编程工具与其他客户端一样，通过账户、API 密钥、分组和模型权限访问网关。请先核对当前账户开放的分组与模型，以及运营方公布的准入要求。\n\n## 开通前核对\n\n1. 在 [API 密钥](/keys) 创建或编辑密钥，确认分组可选且模型在权限范围内。\n2. 在 [定价](/pricing) 查看模型与分组的当前展示，在 [钱包](/wallet) 确认可用余额或订阅。\n3. 按工具指南填写正确地址和协议，发送实际请求验证。\n\n如果站点运营方另有准入条件，应通过该站点明确发布的协议与支持渠道核实；不要把其他站点的押金规则或支付入口当作本项目默认功能。\n\n## 遇到权限问题\n\n提交发生时间、模型、分组、客户端版本和脱敏错误详情。不要提供密码、API Key 或完整私有代码。可通过 [工单中心](/support) 联系工作人员；处理结果以实际回复为准。\n',
      en: "Coding clients access the gateway through account, API-key, group, and model permissions. Check the groups and models available to your account and any access requirements published by the operator.\n\n## Before connecting\n\n1. Create or edit an [API key](/keys) and confirm the group and model are permitted.\n2. Check [Pricing](/pricing) and your balance or subscription in [Wallet](/wallet).\n3. Configure the client's address and protocol, then verify with a real request.\n\nIf a site operator has additional access requirements, verify them through that site's published terms and support channels. Another site's deposit policy or payment link is not a default feature of this project.\n\n## Report an access problem\n\nProvide the time, model, group, client version, and redacted error details. Do not submit passwords, API keys, or complete private code. Contact [Support Center](/support); outcomes depend on the actual review and response.\n",
    },
    hideTokenBar: true,
  },
  {
    slug: 'kiro-credit-billing',
    categoryId: 'platform',
    titleKey: 'Understanding prices and usage',
    summaryKey:
      'Use the current pricing page and usage records to check request charges.',
    keywords: ['kiro', 'credits', 'billing', '1x', '积分', '计费', '倍率'],
    content: {
      zh: '模型与分组的收费方式以本站 [定价](/pricing) 页面及管理员公布的配置为准。上游产品自己的 credit、订阅或 Token 单位，不会自动成为本站计费规则。\n\n## 调用前\n\n核对模型标识、所选分组、计费单位与页面展示的价格。不要把不同单位的倍率直接比较；也不要根据另一个站点的 Kiro 示例推断本账户一定按积分计费。\n\n## 调用后\n\n查看使用日志中的实际请求、模型、分组、用量和费用。发生差异时，保留时间、请求标识和脱敏记录并联系管理员。退款或更正取决于站点规则和实际核查，本指南不保证自动退款或特定价格。\n\n在 [钱包](/wallet) 查看余额、订阅以及站点启用的充值入口。避免把钱包余额、令牌额度和第三方服务的积分混为同一个单位。\n',
      en: "Use this site's [Pricing](/pricing) page and published configuration for model/group charging rules. An upstream product's credits, subscription, or token units do not automatically define this gateway's billing policy.\n\n## Before a request\n\nCheck the model identifier, selected group, unit, and displayed price. Ratios using different units are not directly comparable. Another site's Kiro example does not establish credit-based charging for your account.\n\n## After a request\n\nInspect the request, model, group, usage, and charge in usage logs. For discrepancies, retain the time, request identifier, and redacted records and contact the administrator. Corrections and refunds depend on the site's policy and review; this guide does not promise automatic refunds or a particular price.\n\nUse [Wallet](/wallet) for balances, subscriptions, and enabled top-up options. Wallet balances, key quotas, and third-party credits are distinct concepts.\n",
    },
    hideTokenBar: true,
  },
  {
    slug: 'local-speed-test',
    categoryId: 'platform',
    titleKey: 'Endpoints & local speed test',
    summaryKey:
      'Distinguish basic endpoint reachability from a successful authenticated model request.',
    keywords: [
      'speed test',
      'endpoint',
      'latency',
      'route',
      '测速',
      '线路',
      '延迟',
    ],
    content: {
      zh: '控制台总览的 API 信息由站点配置。请使用站点明确提供的地址，不要假定所有域名共享账户或密钥。\n\n## 连通性与模型调用不同\n\nAPI 信息卡片可发起浏览器延迟测试并打开外部测速服务。浏览器测试使用 HEAD 和 `no-cors`；测得延迟只说明这次网络请求完成，不能证明 HTTP 成功、密钥有效或模型可用。浏览器扩展、代理和缓存也可能影响结果。\n\n## 本地验证\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/models\' \\\n  -H "Authorization: Bearer $NEW_API_KEY"\n```\n\n确认返回模型列表，再从中选择适用的模型按 [快速开始](/docs/guides/quick-start) 完成一次请求。不要向不信任的测试站点发送密钥。\n\n浏览器延迟测量适合初步观察，本地鉴权请求可进一步确认实际可用性。遇到连接问题时记录地址、时间、HTTP 状态与脱敏错误，参考 [排障指南](/docs/guides/troubleshooting)。\n',
      en: 'API information on the dashboard comes from site configuration. Use explicitly supplied addresses; do not assume arbitrary domains share accounts or keys.\n\n## Reachability is not model availability\n\nThe API information card can run a browser latency check or open an external testing service. Its browser check uses HEAD with `no-cors`: a duration means that network attempt completed, not that HTTP succeeded, the key is valid, or a model is available. Extensions, proxies, and caches may affect results.\n\n## Verify locally\n\n```bash\ncurl --fail-with-body \'{{BASE_URL}}/v1/models\' \\\n  -H "Authorization: Bearer $NEW_API_KEY"\n```\n\nConfirm a model list, then use a suitable model in a real request from [Quick start](/docs/guides/quick-start). Never send keys to untrusted test services.\n\nUse browser latency for an initial observation, followed by an authenticated local request to verify usability. Record the address, time, HTTP status, and redacted errors when troubleshooting.\n',
    },
  },
  {
    slug: 'support-center',
    categoryId: 'platform',
    titleKey: 'Support Center: tickets & replies',
    summaryKey:
      'Create tickets, provide useful evidence, and follow the status shown by the support service.',
    keywords: ['ticket', 'support', 'help', '工单', '客服', '售后'],
    content: {
      zh: '站点配置支持服务后，可从侧边栏进入 [工单中心](/support)。如果提示服务未配置，请联系运营方提供的其他支持渠道。\n\n## 创建工单\n\n按页面提示先绑定邮箱。表单支持标题（最多 120 字符）、分类、问题确认程度和描述（最多 8000 字符）。图片可使用 JPEG、PNG、WebP、GIF，每条消息最多 5 张、单张最多 8 MB；上传结果以服务端响应为准。\n\n写明发生时间、模型、客户端版本、复现步骤和脱敏错误。问题确认程度请选择未验证、疑似、可复现或已确认，不要把猜测写成事实。不要提交 API Key、密码或无关私有代码。\n\n## 跟进\n\n页面展示待处理、等待用户回复、已处理等状态，可按可用的筛选项查找工单、阅读回复、补充信息，并使用当前权限允许的关闭或重开操作。以服务实际返回的状态为准，不能假定每条回复都会自动改变状态。\n\n顶栏工单通知和列表会定期刷新，也可重新打开页面查看最新状态。邮件是否发送和送达取决于支持服务、站点通知配置与邮箱情况；需要及时处理时请直接查看工单。\n\n## 保留与限制\n\n工单保存期限、附件清理和请求频率以站点的支持服务配置及公告为准。重要回复和凭证请自行保存；遇到限流或清理提示时，按实际提示操作或咨询管理员。\n',
      en: 'When a support service is configured, open [Support Center](/support) from the sidebar. If the service is unavailable or unconfigured, use another support channel supplied by the operator.\n\n## Create a ticket\n\nBind an email address when prompted. The form accepts a title (up to 120 characters), category, verification level, and description (up to 8000 characters). Attach JPEG, PNG, WebP, or GIF images: up to 5 per message and 8 MB per image, subject to server validation.\n\nInclude the time, model, client version, reproduction steps, and redacted errors. Choose not verified, suspected, reproducible, or confirmed according to your evidence. Never submit API keys, passwords, or unrelated private source code.\n\n## Follow up\n\nThe page displays pending handling, awaiting user reply, and resolved states. Use available filters, read replies, provide more information, and use close/reopen actions permitted by your current access. Follow the state returned by the service rather than assuming every reply automatically changes it.\n\nTicket notifications and lists refresh periodically; reopen the page to check current status. Email sending and delivery depend on the support service, notification configuration, and mailbox. Check the ticket directly when timely action matters.\n\n## Retention and limits\n\nRetention, attachment cleanup, and request limits follow the deployed support service configuration and site announcements. Save important replies and receipts, and follow actual rate-limit or cleanup messages.\n',
    },
  },
  {
    slug: 'platform-tour',
    categoryId: 'platform',
    titleKey: 'Platform tour: wallet, logs, security & more',
    summaryKey:
      'Find the current key, wallet, usage, security, and support features.',
    keywords: [
      'wallet',
      'check-in',
      'subscription',
      'passkey',
      'logs',
      '钱包',
      '签到',
      '订阅',
      '功能',
    ],
    content: {
      zh: '{{SITE_NAME}} 的可见菜单由站点配置和账户权限控制。以下入口对应当前项目功能；具体可用操作以页面为准。\n\n- [API 密钥](/keys)：创建、编辑和管理密钥，设置分组、额度、有效期及限制；行操作支持导入到 CC Switch。\n- [钱包](/wallet)：查看余额、充值与账单，并使用站点启用的订阅和兑换能力。\n- 使用日志：查看当前账户可访问的请求记录和费用详情。并非所有失败都一定形成消费日志，排障时还需保留客户端响应。\n- [个人资料](/profile) 与 [安全设置](/security)：管理当前开放的账户、通知和安全选项。\n- [定价](/pricing)：查看模型和分组的展示信息；实际可用性需通过自己的密钥验证。\n- [文档中心](/docs)：中英文接入指南、接口示例、Markdown 复制和公开 AI 文档链接。示例中的密钥为占位值，使用前在本地配置自己的凭据。\n- [工单中心](/support)：服务配置后提交问题并查看回复，参见 [工单指南](/docs/guides/support-center)。\n\n功能是否可见不等于当前上游是否可用。调用失败时请核对实际响应与账户权限，避免把站内聊天成功扩大为所有外部工具都已配置正确。\n',
      en: 'Visible menus in {{SITE_NAME}} depend on site configuration and account permissions. The following entries reflect current project features; consult each page for available operations.\n\n- [API keys](/keys): create and manage keys, groups, quotas, expiry, and restrictions; row actions include CC Switch import.\n- [Wallet](/wallet): balances, top-ups, billing history, and enabled subscription/redemption features.\n- Usage logs: request records and charge details available to your account. Some failures do not create a consumption log, so retain the client response too.\n- [Profile](/profile) and [Security](/security): available account, notification, and security settings.\n- [Pricing](/pricing): model and group information; verify availability with your own key.\n- [Documentation](/docs): Chinese/English guides, request examples, Markdown copy, and public AI documentation links. Keys are placeholders; configure your own credentials locally before using examples.\n- [Support Center](/support): tickets and replies when configured; see the [support guide](/docs/guides/support-center).\n\nA visible feature does not establish current upstream availability. Check real responses and permissions, rather than treating successful dashboard chat as proof that every external tool is correctly configured.\n',
    },
  },
  {
    slug: 'xiaobai-switch',
    categoryId: 'coding-cli',
    titleKey: 'Configure XiaoBaiSwitch manually',
    summaryKey:
      'Configure a third-party client with the site address, key, and supported protocol.',
    keywords: [
      'xiaobai switch',
      'xiaobaiswitch',
      'import',
      'deeplink',
      '小白',
      '一键导入',
      '测速',
    ],
    content: {
      zh: '使用 XiaoBaiSwitch 前，请确认安装版本支持自定义 API 地址及目标协议。请在客户端自己的设置中添加提供方，并保存下列连接信息。\n\n## 连接信息\n\n- 站点根地址：`{{BASE_URL}}`\n- OpenAI Chat Completions / Responses 的常见 Base URL：`{{BASE_URL}}/v1`\n- Anthropic Messages 的常见 Base URL：`{{BASE_URL}}`\n- 密钥：从 [API 密钥](/keys) 创建，保存在客户端安全配置或环境变量中\n- 模型：从 [定价](/pricing) 和自己的 `/v1/models` 结果确认，不能假定某个品牌模型在当前分组可用\n\n地址是否需要 `/v1` 由客户端拼接规则决定，不要重复添加。选择与网关接口一致的协议；只有自定义地址而协议不兼容，仍无法调用。\n\n## 验证\n\n先按 [快速开始](/docs/guides/quick-start) 用同一密钥验证，再在客户端发送最小请求。若客户端版本没有对应设置，请查阅其官方文档，不能通过修改本站设置为客户端增加该能力。排障时提供版本、协议、脱敏请求和错误信息。\n',
      en: "Before using XiaoBaiSwitch, confirm that your installed version supports a custom API address and the required protocol. Add a provider in the client settings and save the connection information below.\n\n## Connection settings\n\n- Site root: `{{BASE_URL}}`\n- Typical OpenAI Chat Completions / Responses base: `{{BASE_URL}}/v1`\n- Typical Anthropic Messages base: `{{BASE_URL}}`\n- Key: create one in [API keys](/keys), stored in secure client settings or the environment\n- Model: confirm through [Pricing](/pricing) and `/v1/models` with your own key; a named vendor model is not necessarily available to your group\n\nWhether `/v1` is needed depends on the client's URL construction. Avoid doubling it. Match the client protocol to the gateway endpoint; a custom URL alone does not make incompatible protocols work.\n\n## Verify\n\nUse [Quick start](/docs/guides/quick-start) with the same key first, then send a minimal request from the client. If your version has no suitable settings, consult its official documentation; gateway settings cannot add a missing client capability. Include the version, protocol, and redacted request/error when troubleshooting.\n",
    },
    recommended: true,
  },
  {
    slug: 'cc-switch',
    categoryId: 'coding-cli',
    titleKey: 'One-click setup with CC Switch',
    summaryKey:
      'Import a supported client configuration from the API key action menu.',
    keywords: ['cc switch', 'ccswitch', 'import', 'deeplink', '一键导入'],
    content: {
      zh: '[CC Switch](https://github.com/farion1231/cc-switch) 管理本地客户端配置。先通过其官方发布页安装并启动软件。\n\n## 从本站导入\n\n1. 打开 [API 密钥](/keys)，在目标密钥的行操作中选择 **导入到 CC Switch**。\n2. 当前导入器支持 Claude、Codex 和 Gemini。选择应用、名称、主模型及界面允许的角色模型。\n3. 点击 **打开 CC Switch**，检查本地软件展示的地址与配置后确认。\n\nCodex 使用带 `/v1` 的地址，Claude 和 Gemini 使用根地址。该导入链接包含密钥，请勿公开或截屏传播。导入后请在本地客户端确认实际采用的配置。\n\n如果客户端不接受导入，查阅 CC Switch 当前版本的官方文档，或手动填写地址 `{{BASE_URL}}`、密钥和实际可用模型。完成后按 [快速开始](/docs/guides/quick-start) 与工具实际请求验证连接。\n',
      en: "[CC Switch](https://github.com/farion1231/cc-switch) manages local client configurations. Install and launch it from its official releases first.\n\n## Import from this site\n\n1. Open [API keys](/keys) and select **Import to CC Switch** in the target key's row actions.\n2. The current importer supports Claude, Codex, and Gemini. Select an application, name, primary model, and any offered role models.\n3. Select **Open CC Switch** and review the address and configuration in the local application before confirming.\n\nCodex uses a `/v1` base URL; Claude and Gemini use the root. Import links contain the API key and must not be shared. After importing, check the configuration actually selected by the local client.\n\nIf importing is unsupported by your installed version, follow CC Switch's current official documentation or configure the address `{{BASE_URL}}`, key, and available model manually. Verify with [Quick start](/docs/guides/quick-start) and a real request from the client.\n",
    },
    recommended: true,
  },
  {
    slug: 'claude-code',
    categoryId: 'coding-cli',
    titleKey: 'Use with Claude Code',
    summaryKey:
      'Point the Claude Code CLI at this site with two environment variables.',
    keywords: ['claude code', 'anthropic', 'cli', 'settings.json'],
    content: {
      zh: "Claude Code 可通过兼容的 Anthropic Messages 网关连接模型。安装方式与客户端要求请参阅 [Claude Code 官方文档](https://code.claude.com/docs/en/overview)。\n\n## 配置连接\n\n先在 [API 密钥](/keys) 创建密钥，并确认目标模型支持所需协议和工具能力。在运行 Claude Code 的终端设置：\n\n```bash\nexport ANTHROPIC_BASE_URL='{{BASE_URL}}'\nexport ANTHROPIC_AUTH_TOKEN=\"$NEW_API_KEY\"\nexport ANTHROPIC_MODEL='available-anthropic-model'\nclaude\n```\n\n将模型占位值替换为你实际可访问的模型。网关根地址不附加 `/v1`，由客户端拼接 Messages 路径。密钥从本地环境读取，不要提交到仓库。\n\n如果使用 `~/.claude/settings.json`，请按照 [官方网关配置说明](https://code.claude.com/docs/en/llm-gateway-connect) 合并 `env` 字段，不要覆盖已有配置。也可从 [API 密钥](/keys) 的 [CC Switch 导入](/docs/guides/cc-switch) 选择 Claude。\n\n## 验证\n\n检查客户端当前采用的地址、认证与模型，再发送最小请求。基础聊天成功不等于工具调用、长上下文或所有模型均兼容。模型名与可用分组以本站实际配置为准，本指南不预置旗舰型号或跨供应商转换保证。\n\n出现错误时保留脱敏响应并查看 [排障指南](/docs/guides/troubleshooting)。Claude Desktop 是独立客户端，其配置能力需要单独核对，参见 [桌面端指南](/docs/guides/claude-desktop)。\n",
      en: "Claude Code can connect through a compatible Anthropic Messages gateway. Consult the [official Claude Code documentation](https://code.claude.com/docs/en/overview) for installation and client requirements.\n\n## Configure the connection\n\nCreate an [API key](/keys) and confirm that the model supports the required protocol and tool capabilities. In the terminal that starts Claude Code:\n\n```bash\nexport ANTHROPIC_BASE_URL='{{BASE_URL}}'\nexport ANTHROPIC_AUTH_TOKEN=\"$NEW_API_KEY\"\nexport ANTHROPIC_MODEL='available-anthropic-model'\nclaude\n```\n\nReplace the model placeholder with an accessible model. Use the root without `/v1`; the client appends the Messages path. Keep credentials in the local environment and out of source control.\n\nFor `~/.claude/settings.json`, merge the `env` settings according to the [official gateway guide](https://code.claude.com/docs/en/llm-gateway-connect) without overwriting existing configuration. The [CC Switch importer](/docs/guides/cc-switch) in [API keys](/keys) also offers Claude.\n\n## Verify\n\nCheck the active address, authentication, and model, then send a minimal request. Basic chat success does not prove tool calling, long contexts, or every model is compatible. Available models/groups depend on the deployment; this guide does not guarantee a particular flagship model or cross-provider conversion.\n\nRetain redacted failures and see [Troubleshooting](/docs/guides/troubleshooting). Claude Desktop is a separate client whose configuration capabilities must be checked independently; see the [Desktop guide](/docs/guides/claude-desktop).\n",
    },
  },
  {
    slug: 'codex-cli',
    categoryId: 'coding-cli',
    titleKey: 'Use with Codex CLI',
    summaryKey: 'Configure config.toml so the Codex CLI talks to this gateway.',
    keywords: ['codex', 'openai', 'cli', 'config.toml', 'responses'],
    content: {
      zh: 'Codex 可以使用自定义模型提供方连接支持 Responses API 的网关。安装与客户端要求以 [Codex 官方文档](https://developers.openai.com/codex/cli) 为准。\n\n## 自定义提供方\n\n合并以下设置到 `~/.codex/config.toml`，不要覆盖已有配置。把 `available-responses-model` 换成本站对你的密钥开放、支持 Responses 和工具调用的模型：\n\n```toml\nmodel_provider = "newapi"\nmodel = "available-responses-model"\n\n[model_providers.newapi]\nname = "New API gateway"\nbase_url = "{{BASE_URL}}/v1"\nwire_api = "responses"\nenv_key = "NEW_API_KEY"\n```\n\n在启动 Codex 的环境中设置 `NEW_API_KEY`，再运行 `codex`。此方案使用独立环境变量，不要求覆盖 `auth.json` 中已有的登录状态，也不把密钥写入 TOML。\n\n配置依据：[官方自定义提供方文档](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers)。升级客户端后应重新核对其配置契约。\n\n## 验证与能力边界\n\n发送最小请求，并检查当前提供方、模型及实际响应。可从 [API 密钥](/keys) 的 [CC Switch](/docs/guides/cc-switch) 行操作导入基础设置。\n\n联网搜索、WebSocket、压缩或其他工具能力必须由网关、上游模型与客户端共同支持。请通过实际部署的接口说明与请求验证这些能力。使用前请核对实际部署能力，不要仅为启用某项功能改写认证方式。\n\n认证、路径或流式错误参见 [排障指南](/docs/guides/troubleshooting)。\n',
      en: 'Codex can use a custom provider with a gateway that supports the Responses API. Consult the [official Codex documentation](https://developers.openai.com/codex/cli) for installation and client requirements.\n\n## Custom provider\n\nMerge these settings into `~/.codex/config.toml` without replacing existing configuration. Replace `available-responses-model` with a model available to your key that supports Responses and tool calling:\n\n```toml\nmodel_provider = "newapi"\nmodel = "available-responses-model"\n\n[model_providers.newapi]\nname = "New API gateway"\nbase_url = "{{BASE_URL}}/v1"\nwire_api = "responses"\nenv_key = "NEW_API_KEY"\n```\n\nSet `NEW_API_KEY` in the environment that launches Codex, then run `codex`. This uses a separate environment variable without requiring you to overwrite an existing `auth.json` login or put credentials in TOML.\n\nReference: [official custom-provider documentation](https://learn.chatgpt.com/docs/config-file/config-advanced#custom-model-providers). Recheck the configuration contract after upgrading the client.\n\n## Verify capabilities\n\nSend a minimal request and inspect the active provider, model, and response. [API keys](/keys) also offers a basic [CC Switch](/docs/guides/cc-switch) import.\n\nWeb search, WebSockets, compaction, and other tools require compatible gateway, upstream, and client support. Verify these capabilities against the deployed endpoint documentation and real responses. Check deployed capabilities before enabling features rather than changing authentication to force them.\n\nSee [Troubleshooting](/docs/guides/troubleshooting) for authentication, path, or streaming failures.\n',
    },
  },
  {
    slug: 'deepseek-coding',
    categoryId: 'coding-cli',
    titleKey: 'Use DeepSeek with OpenCode & ZCode',
    summaryKey:
      'Connect a supported DeepSeek model through a compatible client provider.',
    keywords: [
      'deepseek',
      'ds',
      'opencode',
      'zcode',
      'coding',
      '国产模型',
      '编程',
    ],
    content: {
      zh: '使用 OpenCode / ZCode 前，请确认安装版本支持自定义 API 地址及目标协议。请在客户端自己的设置中添加提供方，并保存下列连接信息。\n\n## 连接信息\n\n- 站点根地址：`{{BASE_URL}}`\n- OpenAI Chat Completions / Responses 的常见 Base URL：`{{BASE_URL}}/v1`\n- Anthropic Messages 的常见 Base URL：`{{BASE_URL}}`\n- 密钥：从 [API 密钥](/keys) 创建，保存在客户端安全配置或环境变量中\n- 模型：从 [定价](/pricing) 和自己的 `/v1/models` 结果确认，不能假定某个品牌模型在当前分组可用\n\n地址是否需要 `/v1` 由客户端拼接规则决定，不要重复添加。选择与网关接口一致的协议；只有自定义地址而协议不兼容，仍无法调用。\n\n## 验证\n\n先按 [快速开始](/docs/guides/quick-start) 用同一密钥验证，再在客户端发送最小请求。若客户端版本没有对应设置，请查阅其官方文档，不能通过修改本站设置为客户端增加该能力。排障时提供版本、协议、脱敏请求和错误信息。\n',
      en: "Before using OpenCode / ZCode, confirm that your installed version supports a custom API address and the required protocol. Add a provider in the client settings and save the connection information below.\n\n## Connection settings\n\n- Site root: `{{BASE_URL}}`\n- Typical OpenAI Chat Completions / Responses base: `{{BASE_URL}}/v1`\n- Typical Anthropic Messages base: `{{BASE_URL}}`\n- Key: create one in [API keys](/keys), stored in secure client settings or the environment\n- Model: confirm through [Pricing](/pricing) and `/v1/models` with your own key; a named vendor model is not necessarily available to your group\n\nWhether `/v1` is needed depends on the client's URL construction. Avoid doubling it. Match the client protocol to the gateway endpoint; a custom URL alone does not make incompatible protocols work.\n\n## Verify\n\nUse [Quick start](/docs/guides/quick-start) with the same key first, then send a minimal request from the client. If your version has no suitable settings, consult its official documentation; gateway settings cannot add a missing client capability. Include the version, protocol, and redacted request/error when troubleshooting.\n",
    },
    recommended: true,
  },
  {
    slug: 'aqbot',
    categoryId: 'chat-clients',
    titleKey: 'Use with AQBot',
    summaryKey:
      'Configure an OpenAI-compatible provider in your installed AQBot version.',
    keywords: [
      'aqbot',
      'desktop',
      'client',
      'provider',
      'import',
      'deeplink',
      '客户端',
      '一键导入',
    ],
    content: {
      zh: '使用 AQBot 前，请确认安装版本支持自定义 API 地址及目标协议。请在客户端自己的设置中添加提供方，并保存下列连接信息。\n\n## 连接信息\n\n- 站点根地址：`{{BASE_URL}}`\n- OpenAI Chat Completions / Responses 的常见 Base URL：`{{BASE_URL}}/v1`\n- Anthropic Messages 的常见 Base URL：`{{BASE_URL}}`\n- 密钥：从 [API 密钥](/keys) 创建，保存在客户端安全配置或环境变量中\n- 模型：从 [定价](/pricing) 和自己的 `/v1/models` 结果确认，不能假定某个品牌模型在当前分组可用\n\n地址是否需要 `/v1` 由客户端拼接规则决定，不要重复添加。选择与网关接口一致的协议；只有自定义地址而协议不兼容，仍无法调用。\n\n## 验证\n\n先按 [快速开始](/docs/guides/quick-start) 用同一密钥验证，再在客户端发送最小请求。若客户端版本没有对应设置，请查阅其官方文档，不能通过修改本站设置为客户端增加该能力。排障时提供版本、协议、脱敏请求和错误信息。\n',
      en: "Before using AQBot, confirm that your installed version supports a custom API address and the required protocol. Add a provider in the client settings and save the connection information below.\n\n## Connection settings\n\n- Site root: `{{BASE_URL}}`\n- Typical OpenAI Chat Completions / Responses base: `{{BASE_URL}}/v1`\n- Typical Anthropic Messages base: `{{BASE_URL}}`\n- Key: create one in [API keys](/keys), stored in secure client settings or the environment\n- Model: confirm through [Pricing](/pricing) and `/v1/models` with your own key; a named vendor model is not necessarily available to your group\n\nWhether `/v1` is needed depends on the client's URL construction. Avoid doubling it. Match the client protocol to the gateway endpoint; a custom URL alone does not make incompatible protocols work.\n\n## Verify\n\nUse [Quick start](/docs/guides/quick-start) with the same key first, then send a minimal request from the client. If your version has no suitable settings, consult its official documentation; gateway settings cannot add a missing client capability. Include the version, protocol, and redacted request/error when troubleshooting.\n",
    },
  },
  {
    slug: 'claude-desktop',
    categoryId: 'chat-clients',
    titleKey: 'Connect Claude Desktop',
    summaryKey:
      'Check gateway support in your Claude Desktop version before configuring it.',
    keywords: [
      'claude desktop',
      'gateway',
      'cc switch',
      'cowork',
      '桌面端',
      '第三方推理',
      '网关',
    ],
    content: {
      zh: '使用 Claude Desktop 前，请确认安装版本支持自定义 API 地址及目标协议。请在客户端自己的设置中添加提供方，并保存下列连接信息。\n\n## 连接信息\n\n- 站点根地址：`{{BASE_URL}}`\n- OpenAI Chat Completions / Responses 的常见 Base URL：`{{BASE_URL}}/v1`\n- Anthropic Messages 的常见 Base URL：`{{BASE_URL}}`\n- 密钥：从 [API 密钥](/keys) 创建，保存在客户端安全配置或环境变量中\n- 模型：从 [定价](/pricing) 和自己的 `/v1/models` 结果确认，不能假定某个品牌模型在当前分组可用\n\n地址是否需要 `/v1` 由客户端拼接规则决定，不要重复添加。选择与网关接口一致的协议；只有自定义地址而协议不兼容，仍无法调用。\n\n## 验证\n\n先按 [快速开始](/docs/guides/quick-start) 用同一密钥验证，再在客户端发送最小请求。若客户端版本没有对应设置，请查阅其官方文档，不能通过修改本站设置为客户端增加该能力。排障时提供版本、协议、脱敏请求和错误信息。\n',
      en: "Before using Claude Desktop, confirm that your installed version supports a custom API address and the required protocol. Add a provider in the client settings and save the connection information below.\n\n## Connection settings\n\n- Site root: `{{BASE_URL}}`\n- Typical OpenAI Chat Completions / Responses base: `{{BASE_URL}}/v1`\n- Typical Anthropic Messages base: `{{BASE_URL}}`\n- Key: create one in [API keys](/keys), stored in secure client settings or the environment\n- Model: confirm through [Pricing](/pricing) and `/v1/models` with your own key; a named vendor model is not necessarily available to your group\n\nWhether `/v1` is needed depends on the client's URL construction. Avoid doubling it. Match the client protocol to the gateway endpoint; a custom URL alone does not make incompatible protocols work.\n\n## Verify\n\nUse [Quick start](/docs/guides/quick-start) with the same key first, then send a minimal request from the client. If your version has no suitable settings, consult its official documentation; gateway settings cannot add a missing client capability. Include the version, protocol, and redacted request/error when troubleshooting.\n",
    },
  },
  {
    slug: 'cherry-studio',
    categoryId: 'chat-clients',
    titleKey: 'Use with Cherry Studio',
    summaryKey: 'Add this site as an OpenAI-type provider in Cherry Studio.',
    keywords: ['cherry studio', 'client', 'desktop', '客户端'],
    content: {
      zh: 'Cherry Studio 是流行的开源桌面 AI 客户端（Windows / macOS / Linux），支持多服务商、知识库与绘图。把 {{SITE_NAME}} 添加为 OpenAI 类型的服务商后，可调用当前密钥有权访问且兼容该协议的模型。\n\n## 第 1 步：安装\n\n从官网下载安装：<https://www.cherry-ai.com>\n\n## 第 2 步：添加服务商\n\n1. 打开 **设置 → 模型服务**，点击「添加提供商」\n2. 名称随意（例如 `{{SITE_NAME}}`），类型选择 **OpenAI**\n3. 填写：\n   - **API 密钥**：`{{API_KEY}}`\n   - **API 地址**：`{{BASE_URL}}`\n\n> 地址填站点根地址即可，Cherry Studio 会自动补全 `/v1`。如果你填了完整路径，请以 `#` 结尾以强制使用原样地址。\n\n## 第 3 步：添加模型\n\n在该服务商的「模型」区域点击「管理」，Cherry Studio 会自动拉取本站可用模型列表；勾选你需要的模型（以 **定价** 页为准）。\n\n## 第 4 步：验证\n\n回到对话页，顶部模型选择器切换到刚添加的模型，发送一句话。收到回复即成功；本站 **使用日志** 中会出现这笔调用。\n\n## 常见问题\n\n- **拉取不到模型列表**：检查 API 地址是否为 `{{BASE_URL}}`、密钥是否有效。\n- **对话报 404**：模型名不在你的令牌分组内，换一个模型或调整令牌分组。\n- **想一键配置**：Cherry Studio 也支持从本站 **控制台侧边栏 → 聊天入口** 一键跳转导入（若管理员已配置）。\n',
      en: "Cherry Studio is a popular open-source desktop AI client (Windows / macOS / Linux) with multi-provider support, knowledge bases, and image generation. Add {{SITE_NAME}} as an OpenAI-type provider to use every model here.\n\n## Step 1: Install\n\nDownload from the official site: <https://www.cherry-ai.com>\n\n## Step 2: Add a provider\n\n1. Open **Settings → Model Services** and click \"Add Provider\"\n2. Any name works (e.g. `{{SITE_NAME}}`); choose the **OpenAI** type\n3. Fill in:\n   - **API Key**: `{{API_KEY}}`\n   - **API Host**: `{{BASE_URL}}`\n\n> The site root is enough — Cherry Studio appends `/v1` automatically. If you enter a full path, end it with `#` to force the exact URL.\n\n## Step 3: Add models\n\nClick \"Manage\" in the provider's model section; Cherry Studio fetches this site's model list automatically. Tick the models you need (see the **Pricing** page).\n\n## Step 4: Verify\n\nBack in a chat, switch the model picker to one of the new models and send a message. A reply means success, and the call shows up in **Usage Logs**.\n\n## Troubleshooting\n\n- **Model list won't load**: check that the host is `{{BASE_URL}}` and the key is valid.\n- **404 during chat**: the model isn't in your key's group — pick another model or adjust the key.\n- **Prefer one-click setup**: if the admin configured chat presets, the console sidebar's chat entries can deep-link Cherry Studio with your key pre-filled.\n",
    },
  },
  {
    slug: 'immersive-translate',
    categoryId: 'chat-clients',
    titleKey: 'Use with Immersive Translate',
    summaryKey:
      'Drive Immersive Translate with models relayed through this site.',
    keywords: ['immersive translate', '沉浸式翻译', 'translation'],
    content: {
      zh: '沉浸式翻译（Immersive Translate）是广受欢迎的浏览器双语翻译扩展。接入 {{SITE_NAME}} 后，可以用更强的模型获得远超机器翻译的质量。\n\n## 第 1 步：安装扩展\n\n从官网安装浏览器扩展：<https://immersivetranslate.com>\n\n## 第 2 步：配置自定义 API\n\n1. 点击扩展图标 → **设置** → **翻译服务**\n2. 找到 **OpenAI**（或「自定义 AI 翻译服务」），点击进入设置\n3. 填写：\n   - **APIKEY**：`{{API_KEY}}`\n   - **模型**：选「自定义」，填入模型名（推荐轻量快速的模型，如 `gpt-4o-mini`）\n   - **自定义 API 接口地址**：`{{BASE_URL}}/v1/chat/completions`\n\n## 第 3 步：控制并发与费用\n\n翻译整页会产生大量小请求，建议：\n\n- **每秒最大请求数**：从默认值调低到 5-10，避免触发限流（429）\n- **每次请求最大段落数**：适当调大可减少请求次数、降低费用\n- 选便宜的模型：翻译对模型要求不高，轻量模型性价比最高（价格见 **定价** 页）\n\n## 第 4 步：验证\n\n打开任意外文网页，点击扩展图标启用翻译。译文正常出现即接入成功；调用明细见本站 **使用日志**。\n\n## 常见问题\n\n- **提示 401**：APIKEY 是否完整（`sk-` 开头）？\n- **频繁 429**：调低每秒最大请求数；或令牌所在分组限流较紧，参见[错误码与排障](/docs/guides/troubleshooting)。\n- **返回内容为空**：更换模型重试；个别模型对翻译提示词兼容性差。\n',
      en: 'Immersive Translate is a widely used bilingual web-translation browser extension. Backed by {{SITE_NAME}}, it produces translations far beyond ordinary machine translation.\n\n## Step 1: Install the extension\n\nInstall from the official site: <https://immersivetranslate.com>\n\n## Step 2: Configure a custom API\n\n1. Click the extension icon → **Settings** → **Translation Services**\n2. Open **OpenAI** (or "Custom AI translation service")\n3. Fill in:\n   - **APIKEY**: `{{API_KEY}}`\n   - **Model**: choose "Custom" and enter a model name (a light, fast model such as `gpt-4o-mini` is ideal)\n   - **Custom API endpoint**: `{{BASE_URL}}/v1/chat/completions`\n\n## Step 3: Tune concurrency and cost\n\nWhole-page translation fires many small requests, so:\n\n- **Max requests per second**: lower it to 5–10 to avoid rate limits (429)\n- **Max paragraphs per request**: raising it reduces request count and cost\n- Pick a cheap model — translation doesn\'t need a frontier model (prices on the **Pricing** page)\n\n## Step 4: Verify\n\nOpen any foreign-language page and enable translation from the extension icon. Translated text appearing means success; details are in **Usage Logs**.\n\n## Troubleshooting\n\n- **401**: is the APIKEY complete (starts with `sk-`)?\n- **Frequent 429**: lower max requests per second, or see [Error codes & troubleshooting](/docs/guides/troubleshooting).\n- **Empty translations**: try another model; a few models handle translation prompts poorly.\n',
    },
  },
  {
    slug: 'openai-sdk',
    categoryId: 'sdk',
    titleKey: 'Use with the OpenAI SDK',
    summaryKey:
      'Call the gateway from Python or JavaScript with the official OpenAI SDK.',
    keywords: ['openai sdk', 'python', 'javascript', 'base_url'],
    content: {
      zh: '对于本站支持的 OpenAI 兼容接口，官方 SDK 可将 `base_url` 指向 `{{BASE_URL}}/v1` ；接口与模型支持范围请以 API 参考和实际响应为准。\n\n## Python\n\n```bash\npip install openai\n```\n\n```python\nfrom openai import OpenAI\n\nclient = OpenAI(\n    api_key="{{API_KEY}}",\n    base_url="{{BASE_URL}}/v1",\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o-mini",\n    messages=[{"role": "user", "content": "用一句话打个招呼"}],\n)\nprint(response.choices[0].message.content)\n```\n\n流式输出：\n\n```python\nstream = client.chat.completions.create(\n    model="gpt-4o-mini",\n    messages=[{"role": "user", "content": "写一首四行小诗"}],\n    stream=True,\n)\nfor chunk in stream:\n    delta = chunk.choices[0].delta.content\n    if delta:\n        print(delta, end="", flush=True)\n```\n\n## JavaScript / TypeScript\n\n```bash\nnpm install openai\n```\n\n```ts\nimport OpenAI from \'openai\'\n\nconst client = new OpenAI({\n  apiKey: \'{{API_KEY}}\',\n  baseURL: \'{{BASE_URL}}/v1\',\n})\n\nconst response = await client.chat.completions.create({\n  model: \'gpt-4o-mini\',\n  messages: [{ role: \'user\', content: \'用一句话打个招呼\' }],\n})\nconsole.log(response.choices[0].message.content)\n```\n\n## 建议\n\n- **密钥放环境变量**：生产代码用 `OPENAI_API_KEY` / `OPENAI_BASE_URL` 环境变量，避免硬编码\n- **模型名**以 **定价** 页为准；跨供应商模型（Claude、Gemini 等）同样通过此 OpenAI 兼容接口调用\n- **LangChain / LlamaIndex** 等框架：凡是支持自定义 `base_url` 的 OpenAI 集成均可直接使用\n- 报错处理参见[错误码与排障](/docs/guides/troubleshooting)\n',
      en: 'For supported OpenAI-compatible endpoints, point the official SDK\'s `base_url` at `{{BASE_URL}}/v1` and check the API reference and actual responses for supported capabilities.\n\n## Python\n\n```bash\npip install openai\n```\n\n```python\nfrom openai import OpenAI\n\nclient = OpenAI(\n    api_key="{{API_KEY}}",\n    base_url="{{BASE_URL}}/v1",\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o-mini",\n    messages=[{"role": "user", "content": "Say hello in one sentence"}],\n)\nprint(response.choices[0].message.content)\n```\n\nStreaming:\n\n```python\nstream = client.chat.completions.create(\n    model="gpt-4o-mini",\n    messages=[{"role": "user", "content": "Write a four-line poem"}],\n    stream=True,\n)\nfor chunk in stream:\n    delta = chunk.choices[0].delta.content\n    if delta:\n        print(delta, end="", flush=True)\n```\n\n## JavaScript / TypeScript\n\n```bash\nnpm install openai\n```\n\n```ts\nimport OpenAI from \'openai\'\n\nconst client = new OpenAI({\n  apiKey: \'{{API_KEY}}\',\n  baseURL: \'{{BASE_URL}}/v1\',\n})\n\nconst response = await client.chat.completions.create({\n  model: \'gpt-4o-mini\',\n  messages: [{ role: \'user\', content: \'Say hello in one sentence\' }],\n})\nconsole.log(response.choices[0].message.content)\n```\n\n## Notes\n\n- **Keys belong in env vars**: use `OPENAI_API_KEY` / `OPENAI_BASE_URL` in production instead of hardcoding\n- **Model names** come from the **Pricing** page; cross-vendor models (Claude, Gemini, …) are all callable through this OpenAI-compatible endpoint\n- **LangChain / LlamaIndex** and friends: any OpenAI integration with a configurable `base_url` works as-is\n- For errors, see [Error codes & troubleshooting](/docs/guides/troubleshooting)\n',
    },
  },
  {
    slug: 'anthropic-sdk',
    categoryId: 'sdk',
    titleKey: 'Use with the Anthropic SDK',
    summaryKey: 'Call Claude-format endpoints from the official Anthropic SDK.',
    keywords: ['anthropic sdk', 'claude', 'messages', 'python'],
    content: {
      zh: '本站兼容 Anthropic Messages 协议：官方 SDK 把 `base_url` 指向 `{{BASE_URL}}` 即可直接调用 Claude 系列模型。\n\n## Python\n\n```bash\npip install anthropic\n```\n\n```python\nimport anthropic\n\nclient = anthropic.Anthropic(\n    api_key="{{API_KEY}}",\n    base_url="{{BASE_URL}}",\n)\n\nmessage = client.messages.create(\n    model="claude-sonnet-4-5-20250929",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "用一句话打个招呼"}],\n)\nprint(message.content[0].text)\n```\n\n## JavaScript / TypeScript\n\n```bash\nnpm install @anthropic-ai/sdk\n```\n\n```ts\nimport Anthropic from \'@anthropic-ai/sdk\'\n\nconst client = new Anthropic({\n  apiKey: \'{{API_KEY}}\',\n  baseURL: \'{{BASE_URL}}\',\n})\n\nconst message = await client.messages.create({\n  model: \'claude-sonnet-4-5-20250929\',\n  max_tokens: 1024,\n  messages: [{ role: \'user\', content: \'用一句话打个招呼\' }],\n})\nconsole.log(message.content)\n```\n\n## 要点\n\n- `base_url` 填站点根地址 `{{BASE_URL}}`（SDK 自己会拼 `/v1/messages`），**不要加 `/v1`**\n- 认证既支持 SDK 默认的 `x-api-key`，也支持 `Authorization: Bearer`\n- `max_tokens` 是 Anthropic 协议的必填参数\n- Claude 模型也可以通过 [OpenAI 兼容接口](/docs/guides/openai-sdk)调用，二选一即可\n- 模型名以 **定价** 页为准；报错处理见[错误码与排障](/docs/guides/troubleshooting)\n',
      en: 'This site speaks the Anthropic Messages protocol: point the official SDK\'s `base_url` at `{{BASE_URL}}` and call Claude models directly.\n\n## Python\n\n```bash\npip install anthropic\n```\n\n```python\nimport anthropic\n\nclient = anthropic.Anthropic(\n    api_key="{{API_KEY}}",\n    base_url="{{BASE_URL}}",\n)\n\nmessage = client.messages.create(\n    model="claude-sonnet-4-5-20250929",\n    max_tokens=1024,\n    messages=[{"role": "user", "content": "Say hello in one sentence"}],\n)\nprint(message.content[0].text)\n```\n\n## JavaScript / TypeScript\n\n```bash\nnpm install @anthropic-ai/sdk\n```\n\n```ts\nimport Anthropic from \'@anthropic-ai/sdk\'\n\nconst client = new Anthropic({\n  apiKey: \'{{API_KEY}}\',\n  baseURL: \'{{BASE_URL}}\',\n})\n\nconst message = await client.messages.create({\n  model: \'claude-sonnet-4-5-20250929\',\n  max_tokens: 1024,\n  messages: [{ role: \'user\', content: \'Say hello in one sentence\' }],\n})\nconsole.log(message.content)\n```\n\n## Key points\n\n- `base_url` is the site root `{{BASE_URL}}` (the SDK appends `/v1/messages` itself) — **no `/v1` suffix**\n- Both the SDK\'s default `x-api-key` header and `Authorization: Bearer` work\n- `max_tokens` is required by the Anthropic protocol\n- Claude models are also reachable via the [OpenAI-compatible endpoint](/docs/guides/openai-sdk) — pick either\n- Model names come from the **Pricing** page; for errors see [Error codes & troubleshooting](/docs/guides/troubleshooting)\n',
    },
  },
  {
    slug: 'troubleshooting',
    categoryId: 'troubleshooting',
    titleKey: 'Error codes & troubleshooting',
    summaryKey:
      'Inspect HTTP status, response details, and the actual key and model configuration.',
    keywords: ['error', '401', '403', '413', '429', '503', '报错', '排障'],
    content: {
      zh: '先保留客户端收到的 HTTP 状态、响应正文、发生时间和请求标识，再定位故障。使用日志可作为补充，但不是所有失败请求都一定生成消费记录。\n\n| 现象 | 建议检查 |\n| --- | --- |\n| 401 / 403 | 密钥是否有效、是否到期或被停用，账户/模型/分组/IP 权限是否符合要求；具体含义以错误正文为准 |\n| 404 | 请求路径、API 版本和模型名；检查是否重复或缺少 `/v1` |\n| 400 / 413 | 请求体格式、内容长度和模型参数；上下文超限的具体错误码依提供方而异 |\n| 429 | 查看错误正文区分请求频率、并发、配额或上游限制；不要只根据状态码推断余额不足 |\n| 5xx / 连接失败 | 网关或上游错误、网络代理、DNS、TLS、超时；保留响应后再重试 |\n\n## 分层验证\n\n1. 用同一密钥请求 `/v1/models`，核对可访问模型。\n2. 按 [快速开始](/docs/guides/quick-start) 发一个最小请求。\n3. 比较外部工具的地址、协议、模型与凭据。站内聊天可能使用不同配置，不能单独证明外部密钥有效。\n\n## 响应格式\n\nJSON 示例不能解析音频、视频二进制或 SSE。语音和视频成功响应应按二进制保存；WebSocket 需要握手；流式接口需要相应的事件解析器。先检查 HTTP 状态，避免把 JSON 错误页保存成媒体文件。\n\n## 寻求帮助\n\n通过 [工单中心](/support) 或站点提供的支持渠道提交脱敏材料。不要发送完整密钥、密码或无关私有代码；不要通过取消安全限制来绕过权限错误。\n',
      en: "Retain the client's HTTP status, response body, time, and request identifier before troubleshooting. Usage logs can help, but not every failed request creates a consumption record.\n\n| Symptom | What to check |\n| --- | --- |\n| 401 / 403 | Key validity, expiry/status, and account/model/group/IP permissions; inspect the actual error body |\n| 404 | Path, API version, and model name; check for a missing or doubled `/v1` |\n| 400 / 413 | Body format, request size, and model parameters; context-limit error codes vary by provider |\n| 429 | Distinguish rate, concurrency, quota, and upstream limits using the error body, not status alone |\n| 5xx / connection failure | Gateway/upstream errors, proxies, DNS, TLS, or timeouts; preserve evidence before retrying |\n\n## Verify in layers\n\n1. Request `/v1/models` with the same key.\n2. Send a minimal request from [Quick start](/docs/guides/quick-start).\n3. Compare the external client's address, protocol, model, and credentials. Dashboard chat may use different settings and does not prove an external key is valid.\n\n## Response formats\n\nJSON examples do not parse binary media or SSE. Save successful speech/video responses as bytes, use a WebSocket handshake for realtime, and use the appropriate event parser for streaming. Check HTTP status before treating the body as a media file.\n\n## Get help\n\nUse [Support Center](/support) or the operator's published support channel. Send redacted evidence without full API keys, passwords, or unrelated private code. Do not remove intended security restrictions to bypass permission errors.\n",
    },
  },
]
