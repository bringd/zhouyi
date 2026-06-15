/**
 * AI 解读调用 (Backend AI Proxy Integration)
 *
 * Calls the backend `/api/ai/interpret` endpoint. The backend holds the
 * Claude API key and applies per-user rate limiting; the browser no longer
 * talks to the Anthropic API directly.
 *
 * Streams Server-Sent Events with the same event shape as Claude:
 *   - `content_block_delta` with `delta.text` for each text fragment
 *   - `done` event (with optional `usage`) when the stream finishes
 *   - `error` event on backend failure
 *
 * Error handling (HTTP status → AIError.code):
 *   - 401  → 'unauthorized'  (session expired / not logged in)
 *   - 429  → 'rate-limit'    (per-user daily quota hit)
 *   - 503  → 'server-error'  (Claude unreachable / not configured)
 *   - 5xx  → 'server-error'
 *   - other 4xx → 'network-error'
 *   - fetch failure → 'network-error'
 *   - AbortController timeout (30s) → 'timeout'
 */

import type { Hexagram } from '@/types'

export interface AIInterpretationInput {
  mainHexagram: Hexagram
  changedHexagram: Hexagram
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  question?: string
}

export interface AIInterpretationResult {
  /** Concatenated streamed text */
  text: string
  /** Raw streaming chunks (for debugging) */
  chunks: string[]
  /** Token usage (if reported by backend) */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Thrown by `generateInterpretation` to signal a recoverable failure
 * with a stable error code the UI can switch on.
 */
export class AIError extends Error {
  constructor(
    message: string,
    public code:
      | 'missing-api-key' // kept for back-compat (no longer thrown in practice)
      | 'invalid-api-key' // kept for back-compat
      | 'network-error' // fetch failure / non-401/429/5xx HTTP error
      | 'timeout' // 30s AbortController timeout
      | 'rate-limit' // 429 from backend
      | 'server-error' // 5xx from backend
      | 'unauthorized' // 401 from backend (session expired)
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

/** Backend base URL. Configurable via VITE_API_BASE_URL for production. */
const API_BASE_URL =
  (import.meta.env?.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:3001'
const API_TIMEOUT_MS = 60_000

/**
 * Call the backend AI interpretation endpoint.
 * The backend holds the Claude API key and applies rate limiting.
 *
 * The second parameter `_apiKey` is kept for backwards compatibility with
 * the previous BYOK signature; it is silently ignored. Callers may pass
 * `null`, `''`, or any string without affecting behavior.
 *
 * @param input    The divination context
 * @param _apiKey  Ignored (kept for back-compat signature)
 * @param onChunk  Optional streaming callback fired per text delta
 * @returns        The interpretation result
 * @throws         {AIError} on backend failure (with a stable `code`)
 */
export async function generateInterpretation(
  input: AIInterpretationInput,
  _apiKey: string | null,
  onChunk?: (chunk: string) => void,
): Promise<AIInterpretationResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/ai/interpret`, {
      method: 'POST',
      credentials: 'include', // Send session cookie so backend can identify the user
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mainHexagramId: input.mainHexagram.id,
        changedHexagramId: input.changedHexagram.id,
        movingLine: input.movingLine,
        question: input.question,
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

  // Map HTTP status to AIError
  if (!response.ok) {
    if (response.status === 401) {
      throw new AIError('会话已过期，请刷新页面', 'unauthorized')
    }
    if (response.status === 429) {
      let message = '请求过于频繁，请稍后再试'
      try {
        const body = (await response.json()) as { message?: string } | null
        if (body?.message) message = body.message
      } catch {
        // ignore JSON parse failure
      }
      throw new AIError(message, 'rate-limit')
    }
    if (response.status === 503) {
      throw new AIError('服务暂时不可用', 'server-error')
    }
    if (response.status >= 500) {
      throw new AIError('服务器错误', 'server-error')
    }
    throw new AIError(`请求失败 (${response.status})`, 'network-error')
  }

  if (!response.body) {
    throw new AIError('响应体为空', 'network-error')
  }

  // Parse SSE stream — events are separated by \n\n
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

      // Split on \n\n (SSE event separator); keep any incomplete tail in buffer
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        const lines = event.split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data) continue

          try {
            const parsed = JSON.parse(data) as {
              type?: string
              delta?: { type?: string; text?: string }
              usage?: { inputTokens: number; outputTokens: number }
              error?: string
              code?: string
              numericCode?: number
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
            } else if (parsed.type === 'done' && parsed.usage) {
              usage = parsed.usage
            } else if (parsed.type === 'error') {
              // Map backend's structured error.code to a stable AIError code.
              // Backend never sends 'unauthorized' / 'rate-limit' here (those
              // come back as HTTP 401/429 before the SSE stream opens).
              const backendCode = parsed.code as
                | 'content_filtered'
                | 'input_filtered'
                | 'quota_exceeded'
                | 'unauthorized'
                | 'invalid_params'
                | 'rate_limited'
                | 'token_limit'
                | 'upstream_internal'
                | 'unknown'
                | undefined
              const map: Record<
                NonNullable<typeof backendCode>,
                AIError['code']
              > = {
                content_filtered: 'content-filtered',
                input_filtered: 'input-filtered',
                quota_exceeded: 'quota-exceeded',
                unauthorized: 'unauthorized',
                invalid_params: 'upstream-error',
                rate_limited: 'rate-limit',
                token_limit: 'token-limit',
                upstream_internal: 'server-error',
                unknown: 'server-error',
              }
              throw new AIError(
                parsed.error ?? 'AI 解读失败',
                backendCode ? map[backendCode] : 'server-error',
                parsed.numericCode,
              )
            }
          } catch (err) {
            if (err instanceof AIError) throw err
            console.warn('[ai] failed to parse SSE event:', data, err)
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  return usage
    ? { text: fullText, chunks, usage }
    : { text: fullText, chunks }
}
