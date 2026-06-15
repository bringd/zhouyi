/**
 * Upstream error categorizer.
 *
 * The Anthropic SDK (and any third-party Anthropic-compatible endpoint like
 * MiniMax) raises errors that come in a few different shapes:
 *
 *   - HTTP errors with a `status` field and a JSON body containing
 *     `{ type: 'error', error: { type, message, code?, ... } }`.
 *   - The Anthropic SDK also throws `Anthropic.APIError` subclasses
 *     (`AuthenticationError`, `RateLimitError`, `BadRequestError`, …).
 *   - Third-party endpoints sometimes surface their own numeric error
 *     codes in the response body (e.g. MiniMax 1008 / 1026 / 1027 / 2013).
 *
 * This module normalizes all of those into a single `UpstreamError` shape
 * with a stable `code` that the SSE `error` event in `routes/ai.ts` and the
 * frontend (`src/lib/ai.ts` `map`) can switch on.
 *
 *   - code         one of the literal union types below
 *   - numericCode  optional upstream numeric code (for support quoting)
 *   - rawMessage   the original error message, untranslated (for logs)
 *   - userMessage  a short, Chinese, user-facing message (for the SSE event)
 */

export type UpstreamErrorCode =
  | 'content_filtered' // 1027 — model output tripped safety filter
  | 'input_filtered' // 1026 — user input tripped safety filter
  | 'quota_exceeded' // 1008 — account balance / quota exhausted
  | 'unauthorized' // 401 — bad/missing API key
  | 'invalid_params' // 2013 — malformed upstream parameter
  | 'rate_limited' // 429 — upstream rate limit
  | 'token_limit' // 1039 / 2056 — max_tokens or plan token cap exceeded
  | 'upstream_internal' // 5xx — generic upstream failure
  | 'unknown' // anything else

export interface UpstreamError {
  code: UpstreamErrorCode
  numericCode?: number
  rawMessage: string
  userMessage: string
}

interface MaybeUpstreamBody {
  status?: number
  code?: string | number
  numericCode?: number
  error?: {
    code?: string | number
    type?: string
    message?: string
  }
  type?: string
  message?: string
}

/**
 * Best-effort shape probe: pull the fields we care about off whatever the
 * upstream (or its SDK) handed us. Unknown shapes yield `undefined`s, which
 * the classifier then falls back on.
 */
function probeError(err: unknown): MaybeUpstreamBody & { status?: number; name?: string } {
  if (!err) return {}
  if (typeof err !== 'object') {
    return { message: String(err) }
  }
  const e = err as Record<string, unknown>
  const out: MaybeUpstreamBody & { status?: number; name?: string } = {}

  // Top-level fields
  if (typeof e.status === 'number') out.status = e.status
  if (typeof e.code === 'string' || typeof e.code === 'number') out.code = e.code
  if (typeof e.numericCode === 'number') out.numericCode = e.numericCode
  if (typeof e.type === 'string') out.type = e.type
  if (typeof e.message === 'string') out.message = e.message
  if (typeof e.name === 'string') out.name = e.name

  // Anthropic SDK: `error.error` is the API's own error object
  if (e.error && typeof e.error === 'object') {
    const inner = e.error as Record<string, unknown>
    out.error = {}
    if (typeof inner.code === 'string' || typeof inner.code === 'number') {
      out.error.code = inner.code
    }
    if (typeof inner.type === 'string') out.error.type = inner.type
    if (typeof inner.message === 'string') out.error.message = inner.message
  }

  return out
}

/**
 * Look at every field we know about and try to extract a numeric error code.
 * Prefers explicit `numericCode` → `error.code` if numeric → `code` if numeric.
 */
function extractNumericCode(p: MaybeUpstreamBody): number | undefined {
  if (typeof p.numericCode === 'number') return p.numericCode
  if (p.error && typeof p.error.code === 'number') return p.error.code
  if (typeof p.code === 'number') return p.code
  return undefined
}

/**
 * Map an extracted status / numeric code to a stable `UpstreamErrorCode`.
 */
function classify(p: MaybeUpstreamBody, numeric: number | undefined): UpstreamErrorCode {
  // Numeric codes first — they are more specific than HTTP status.
  if (numeric === 1027) return 'content_filtered'
  if (numeric === 1026) return 'input_filtered'
  if (numeric === 1008) return 'quota_exceeded'
  if (numeric === 2013) return 'invalid_params'
  if (numeric === 1039 || numeric === 2056) return 'token_limit'

  // SDK name hints (Anthropic SDK raises these for clear categories).
  const name = (p as { name?: string }).name ?? ''
  if (name === 'AuthenticationError') return 'unauthorized'
  if (name === 'RateLimitError') return 'rate_limited'
  if (name === 'BadRequestError') {
    // Could be content-filtered; defer to message text below.
    const msg = (p.error?.message ?? p.message ?? '').toLowerCase()
    if (msg.includes('content') && msg.includes('filter')) return 'content_filtered'
    if (msg.includes('input') && msg.includes('filter')) return 'input_filtered'
    return 'invalid_params'
  }

  // HTTP status fallback.
  const status = p.status
  if (status === 401) return 'unauthorized'
  if (status === 429) return 'rate_limited'
  if (typeof status === 'number' && status >= 500) return 'upstream_internal'
  if (typeof status === 'number' && status >= 400) return 'invalid_params'

  return 'unknown'
}

const USER_MESSAGES: Record<UpstreamErrorCode, string> = {
  content_filtered: '模型输出触发了内容安全过滤，请调整问题后重试。',
  input_filtered: '问题触发了内容安全过滤，请换个问法。',
  quota_exceeded: '服务端 AI 配额已用完，请联系管理员。',
  unauthorized: 'AI 服务未授权，请联系管理员检查 API Key。',
  invalid_params: '上游 AI 服务参数错误，请稍后重试。',
  rate_limited: '上游 AI 服务限流，请稍后再试。',
  token_limit: '回复超出长度限制，请简化问题后重试。',
  upstream_internal: '上游 AI 服务异常，请稍后重试。',
  unknown: 'AI 解读失败，请稍后重试。',
}

/**
 * Categorize any error thrown by the Anthropic SDK (or a compatible
 * third-party endpoint) into a stable `UpstreamError`.
 */
export function categorizeUpstreamError(err: unknown): UpstreamError {
  const probed = probeError(err)
  const numeric = extractNumericCode(probed)
  const code = classify(probed, numeric)
  const rawMessage =
    probed.error?.message ?? probed.message ?? probed.name ?? String(err ?? '')
  return {
    code,
    numericCode: numeric,
    rawMessage,
    userMessage: USER_MESSAGES[code],
  }
}
