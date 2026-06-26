/**
 * AI 解读调用 (BYOK — Bring Your Own Key)
 *
 * Browser-direct call to Anthropic's `/v1/messages` streaming endpoint.
 * The site has no backend, so the user supplies their own Anthropic
 * API key in Settings; we read it from localStorage and use it
 * client-side. The server-side Claude client in `server/src/services/`
 * is kept untouched for any future self-hosted deployment.
 *
 * The `anthropic-dangerous-direct-browser-access: true` header is
 * required by Anthropic to opt into CORS for browser clients — see
 * https://docs.anthropic.com/en/api/client-sdks#browser-cors
 *
 * Error handling (HTTP status → AIError.code):
 *   - 'no-api-key'      → no key stored; ask user to add one in Settings
 *   - 'invalid-api-key' → 401 / 403 from Anthropic
 *   - 'rate-limit'      → 429
 *   - 'server-error'    → 5xx
 *   - 'timeout'         → 60s AbortController
 *   - 'network-error'   → fetch failure / non-mapped HTTP status
 *   - 'content-filtered' / 'input-filtered' / 'quota-exceeded' /
 *     'upstream-error' / 'token-limit' → mapped from SSE `error` event
 */

import type { Hexagram } from '@/types'
import { getApiConfig } from './apiConfig'

export interface AIInterpretationInput {
  mainHexagram: Hexagram
  changedHexagram: Hexagram
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  question?: string
}

export interface AIInterpretationResult {
  text: string
  chunks: string[]
  usage?: { inputTokens: number; outputTokens: number }
  /** Quota info from the Pages Function response headers (demo mode only). */
  quota?: AiQuota
}

/**
 * Quota information surfaced by the Pages Function in
 * `X-AI-Quota-*` response headers. Present only when the call was
 * served in `demo` mode (Function injected its own key). BYOK
 * calls don't carry these headers (or carry zeros) since the user
 * pays their own bill.
 */
export interface AiQuota {
  /** 'byok' = user-supplied key, 'demo' = server demo key */
  mode: 'byok' | 'demo'
  /** Daily limit for demo mode (e.g. 5). Always present. */
  limit: number
  /** Quota used today (after this call). */
  used: number
  /** Quota remaining today. */
  remaining: number
}

/**
 * Read the quota headers off an AI response. Returns `null` for
 * BYOK calls (no quota tracking), when headers are missing
 * (older Function deployments, dev mode, etc.), or when the
 * caller passed a partial mock (tests).
 */
export function readQuotaFromHeaders(headers: Headers | undefined | null): AiQuota | null {
  if (!headers || typeof headers.get !== 'function') return null
  const mode = headers.get('X-AI-Mode') as 'byok' | 'demo' | null
  if (!mode) return null
  const limit = Number.parseInt(headers.get('X-AI-Quota-Limit') ?? '0', 10)
  const used = Number.parseInt(headers.get('X-AI-Quota-Used') ?? '0', 10)
  const remaining = Number.parseInt(headers.get('X-AI-Quota-Remaining') ?? '0', 10)
  return { mode, limit, used, remaining }
}

/**
 * Thrown by `generateInterpretation` to signal a recoverable failure
 * with a stable error code the UI can switch on.
 */
export class AIError extends Error {
  constructor(
    message: string,
    public code:
      | 'missing-api-key' // legacy alias
      | 'invalid-api-key' // legacy alias
      | 'no-api-key' // no key in localStorage
      | 'network-error' // fetch failure / non-mapped HTTP status
      | 'timeout' // 60s AbortController
      | 'rate-limit' // 429
      | 'server-error' // 5xx
      | 'unauthorized' // 401 from Anthropic
      | 'content-filtered' // 1027 — model output tripped safety filter
      | 'input-filtered' // 1026 — user input tripped safety filter
      | 'quota-exceeded' // 1008 — account balance exhausted
      | 'upstream-error' // 2013 etc. — malformed upstream parameter
      | 'token-limit', // 1039/2056 — max_tokens or plan cap exceeded
    public numericCode?: number,
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

// ---- Constants --------------------------------------------------------------

const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_BROWSER_HEADER = 'anthropic-dangerous-direct-browser-access'
const API_TIMEOUT_MS = 60_000

// ---- System prompt (mirrors server/src/services/claudeClient.ts) ------------

interface BuildPromptInput {
  mainName: string
  mainJudgement: string
  movingLineText: string
  changedName: string
  changedJudgement: string
  question?: string
}

function buildSystemPrompt(input: BuildPromptInput): string {
  return `你是周易文化研究助手，正在为一位普通用户解读一次起卦结果。

【卦象数据】
本卦：${input.mainName}（卦辞：${input.mainJudgement}）
动爻：第 ${input.movingLineText} 爻
变卦：${input.changedName}（卦辞：${input.changedJudgement}）
${input.question ? `【用户问题】${input.question}` : '（用户未提具体问题，做通用解读）'}

【输出格式 — 严格遵守】
用 Markdown 输出，6 段标题必须用 "## " 二级标题（不是粗体文本）。结构如下：

## 卦象概要
（80-120 字，介绍本卦基本含义）

## 当前状态
（80-120 字，**必须**结合用户问题，把卦象解读落回用户当下的具体处境）

## 变化原因
（80-120 字，解释动爻为何动、为何变为此卦）

## 后续趋势
（80-120 字，描述变卦指向的可能发展方向）

## 行动建议
（80-120 字，**必须**针对用户问题给出可操作建议，不要泛泛而谈）

## 风险提醒
（80-120 字，列出不宜冒进之处，呼应卦象本身的不确定性）

【写作要求】
- 用户问题章节（当前状态、行动建议）必须**直接回应**用户提问，不能只是复述卦辞
- 全文用现代汉语，避免"一定会""注定"等绝对化预测
- 用"周易文化研究中一种可能的解读是..."、"这个卦象提示..."等学术化语气
- 每段 80-120 字，不短不长，避免堆砌空话
- 鼓励用户结合自己的实际情况判断`
}

// ---- Public API -------------------------------------------------------------

/**
 * Stream an AI interpretation of a divination result.
 *
 * The second parameter is kept for backwards compatibility with the
 * old backend-proxy signature; it's silently ignored. Callers may pass
 * `null` or any string.
 *
 * @param input    The divination context
 * @param _apiKey  Ignored
 * @param onChunk  Optional streaming callback fired per text delta
 * @returns        The interpretation result
 * @throws         {AIError} with a stable `code` on any failure
 */
export async function generateInterpretation(
  input: AIInterpretationInput,
  _apiKey: string | null,
  onChunk?: (chunk: string) => void,
): Promise<AIInterpretationResult> {
  const config = getApiConfig()
  if (!config.apiKey) {
    throw new AIError(
      '请先在设置中填写 Anthropic API Key。',
      'no-api-key',
    )
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  const yaoLine = input.mainHexagram.yaoLines[input.movingLine - 1]
  const movingLineText =
    yaoLine?.originalText?.trim() || `第 ${input.movingLine} 爻`

  const systemPrompt = buildSystemPrompt({
    mainName: input.mainHexagram.name,
    mainJudgement: input.mainHexagram.judgement,
    movingLineText,
    changedName: input.changedHexagram.name,
    changedJudgement: input.changedHexagram.judgement,
    question: input.question,
  })

  let response: Response
  try {
    // Build headers — only include x-api-key when the user has set
    // one. When the key is empty, the proxy Function detects the
    // missing header and serves the request from its server-side
    // demo key + per-IP quota (X-AI-Mode: demo). Sending an empty
    // x-api-key header would silently bypass that path and trigger
    // 401 from upstream.
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
      [ANTHROPIC_BROWSER_HEADER]: 'true',
      Accept: 'text/event-stream',
    }
    if (config.apiKey) headers['x-api-key'] = config.apiKey

    response = await fetch(config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: '请按上述要求输出解读。' }],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new AIError('请求超时', 'timeout', undefined, err)
    }
    throw new AIError(
      err instanceof Error ? err.message : '网络错误',
      'network-error',
      undefined,
      err,
    )
  }

  clearTimeout(timeoutId)

  if (!response.ok) {
    if (response.status === 401) {
      throw new AIError('API Key 无效或已过期，请检查设置。', 'unauthorized')
    }
    if (response.status === 403) {
      throw new AIError('API Key 权限不足，请检查。', 'unauthorized')
    }
    if (response.status === 429) {
      let message = '请求过于频繁，请稍后再试。'
      try {
        const body = (await response.json()) as { error?: { message?: string } }
        if (body?.error?.message) message = body.error.message
      } catch {
        // ignore JSON parse failure
      }
      throw new AIError(message, 'rate-limit')
    }
    if (response.status === 529 || response.status >= 500) {
      throw new AIError('Anthropic 服务暂时不可用', 'server-error')
    }
    throw new AIError(`请求失败 (${response.status})`, 'network-error')
  }

  if (!response.body) {
    throw new AIError('响应体为空', 'network-error')
  }

  // Parse Anthropic SSE stream. Event format:
  //   event: message_start
  //   data: {"type":"message_start", ...}
  //   event: content_block_delta
  //   data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
  //   event: message_stop
  //   data: {"type":"message_stop"}
  //   event: error
  //   data: {"type":"error","error":{"type":"...","message":"..."}}
  const chunks: string[] = []
  let fullText = ''
  let usage: { inputTokens: number; outputTokens: number } | undefined
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // Anthropic SSE events are separated by \n\n. A single chunk can
      // contain multiple events or a partial one — keep the tail in
      // the buffer.
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        let dataPayload = ''
        for (const line of event.split('\n')) {
          if (line.startsWith('data:')) dataPayload += line.slice(5).trim()
        }
        if (!dataPayload) continue
        if (dataPayload === '[DONE]') continue

        let parsed: {
          type?: string
          delta?: { type?: string; text?: string }
          message?: { usage?: { input_tokens?: number; output_tokens?: number } }
          usage?: { input_tokens?: number; output_tokens?: number }
          error?: { type?: string; message?: string }
        }
        try {
          parsed = JSON.parse(dataPayload) as typeof parsed
        } catch {
          continue
        }

        if (
          parsed.type === 'content_block_delta' &&
          parsed.delta?.type === 'text_delta' &&
          typeof parsed.delta.text === 'string'
        ) {
          const chunk = parsed.delta.text
          chunks.push(chunk)
          fullText += chunk
          onChunk?.(chunk)
        } else if (parsed.type === 'message_start' && parsed.message?.usage) {
          usage = {
            inputTokens: parsed.message.usage.input_tokens ?? 0,
            outputTokens: parsed.message.usage.output_tokens ?? 0,
          }
        } else if (parsed.type === 'message_delta' && parsed.usage) {
          // Anthropic's `message_delta` event carries `usage` at the top
          // level (not under `message`). It's typically only updated for
          // output_tokens; fall back to the previous value for the rest.
          usage = {
            inputTokens: parsed.usage.input_tokens ?? usage?.inputTokens ?? 0,
            outputTokens: parsed.usage.output_tokens ?? usage?.outputTokens ?? 0,
          }
        } else if (parsed.type === 'error' && parsed.error) {
          throw new AIError(
            parsed.error.message ?? 'AI 解读失败',
            mapUpstreamErrorType(parsed.error.type),
            undefined,
          )
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return usage
    ? { text: fullText, chunks, usage, quota: readQuotaFromHeaders(response.headers) ?? undefined }
    : { text: fullText, chunks, quota: readQuotaFromHeaders(response.headers) ?? undefined }
}

/**
 * Map Anthropic's error.type values from the SSE `error` event to the
 * stable AIError codes. Anthropic's documented types include
 * `invalid_request_error`, `authentication_error`, `permission_error`,
 * `not_found_error`, `request_too_large`, `rate_limit_error`,
 * `api_error`, `overloaded_error`. Third-party endpoints (MiniMax
 * etc.) sometimes surface numeric codes (1008, 1026, 1027, 2013)
 * instead — those land here as `upstream-error`.
 */
function mapUpstreamErrorType(
  type: string | undefined,
): AIError['code'] {
  switch (type) {
    case 'invalid_request_error':
      return 'upstream-error'
    case 'authentication_error':
    case 'permission_error':
      return 'unauthorized'
    case 'not_found_error':
      return 'upstream-error'
    case 'rate_limit_error':
      return 'rate-limit'
    case 'api_error':
    case 'overloaded_error':
      return 'server-error'
    default:
      return 'server-error'
  }
}

// ---- Legacy helpers (kept for backwards compatibility) ----------------------

/** True when a key is configured. Use to gate AI UI. */
export function isApiKeyConfigured(): boolean {
  return getApiConfig().apiKey.length > 0
}

/** @deprecated — kept so older imports don't break. */
export function isBackendConfigured(): boolean {
  return isApiKeyConfigured()
}
