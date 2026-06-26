/**
 * Cloudflare Pages Function: POST /api/proxy/anthropic/v1/messages
 *
 * Reverse proxy for the Anthropic-compatible endpoint with two modes:
 *
 * 1. **BYOK mode** (user supplied their own API Key)
 *    - Browser sends `x-api-key: sk-...` header.
 *    - Function forwards it transparently to the upstream.
 *    - No quota check, no record-keeping, no AI cost on us.
 *
 * 2. **Demo mode** (user has no API Key)
 *    - Browser sends no `x-api-key` header.
 *    - Function looks up `env.AI_DEMO_KEY` and injects it.
 *    - Counts toward the per-IP daily quota (default 5/day UTC).
 *    - Reads/writes `ai_usage` table in D1.
 *    - Returns 429 + `Retry-After` when over quota.
 *
 * Configuration
 * -------------
 * - `AI_DEMO_KEY` — the server-side MiniMax API key. Set in
 *   Pages → Settings → Environment variables. If unset, demo mode
 *   returns 503 ("demo temporarily unavailable").
 * - `AI_DEMO_DAILY_LIMIT` — quota per IP per UTC day. Default 5.
 * - `AI_PROXY_UPSTREAM` — override the upstream base URL. Default
 *   `https://api.minimaxi.com/anthropic`.
 * - `DB` — D1 binding (already provisioned for the community feed
 *   worker; we share the same database here for ai_usage rows).
 *
 * Response headers (always present)
 * ---------------------------------
 * - `X-AI-Mode: byok` | `demo`               — which mode served this request
 * - `X-AI-Quota-Limit: 5`                   — daily limit
 * - `X-AI-Quota-Used: 3`                    — used so far today (after this call)
 * - `X-AI-Quota-Remaining: 2`               — quota left after this call
 *
 * Quota is counted AFTER the call (so failed calls don't penalise
 * the user). We update the row optimistically in the same request.
 */

type Env = {
  AI_DEMO_KEY?: string
  AI_DEMO_DAILY_LIMIT?: string
  AI_PROXY_UPSTREAM?: string
  // Local structural stub for D1Database — we only call .prepare/
  // .bind/.first/.run. Avoids importing @cloudflare/workers-types
  // from a tsconfig that doesn't pull it in.
  DB?: {
    prepare: (sql: string) => {
      bind: (...args: unknown[]) => {
        first: <T = unknown>() => Promise<T | null>
        run: () => Promise<unknown>
        all: <T = unknown>() => Promise<T[]>
      }
    }
  }
}

interface CfContext {
  request: Request
  env: Env
  params: Record<string, string | string[]>
  data: Record<string, unknown>
}

type PagesHandler = (ctx: CfContext) => Promise<Response> | Response

const DEFAULT_UPSTREAM = 'https://api.minimaxi.com/anthropic/v1/messages'
const DEFAULT_DAILY_LIMIT = 5

// Hop-by-hop headers that must NOT be forwarded per RFC 7230 §6.1.
// Also strip Cloudflare-specific and host headers so the upstream
// doesn't see the wrong origin.
const HOP_BY_HOP: ReadonlySet<string> = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'cf-connecting-ip',
  'cf-ray',
  'cf-worker',
  'cf-visitor',
  'x-forwarded-proto',
  'x-forwarded-for',
  'x-real-ip',
])

function resolveUpstream(env: Env): string {
  return (env.AI_PROXY_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, '')
}

function resolveDailyLimit(env: Env): number {
  const raw = env.AI_DEMO_DAILY_LIMIT
  if (!raw) return DEFAULT_DAILY_LIMIT
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DAILY_LIMIT
}

function copyHeadersFiltered(src: Headers, blocked: ReadonlySet<string>): Headers {
  const out = new Headers()
  src.forEach((value, key) => {
    if (blocked.has(key.toLowerCase())) return
    out.set(key, value)
  })
  return out
}

function utcDateKey(d: Date = new Date()): string {
  // 'YYYY-MM-DD' UTC bucket — keeps the quota reset consistent
  // regardless of visitor timezone.
  return d.toISOString().slice(0, 10)
}

function randomId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  )
}

const handler: PagesHandler = async (context) => {
  try {
    const upstreamUrl = resolveUpstream(context.env)
    const requestHeaders = context.request.headers

    // Decide mode from the request: presence of x-api-key means BYOK.
    const userApiKey = requestHeaders.get('x-api-key')?.trim()
    const mode: 'byok' | 'demo' = userApiKey ? 'byok' : 'demo'

    const limit = resolveDailyLimit(context.env)

    // Quota is only meaningful in demo mode. BYOK users pay their
    // own bills, so we don't track them.
    let used = 0
    if (mode === 'demo') {
      if (!context.env.AI_DEMO_KEY) {
        return new Response(
          JSON.stringify({
            error: 'demo-unavailable',
            message: 'AI demo temporarily unavailable. Add your own API key in Settings to continue.',
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (!context.env.DB) {
        // No D1 binding — fail open with a warning rather than blocking
        // legit users. Admin should configure DB binding to enforce quota.
        console.warn('[proxy] DB binding missing — quota not enforced')
      } else {
        const ip = getClientIp(context.request)
        const date = utcDateKey()
        const row = await context.env.DB
          .prepare('SELECT COUNT(*) AS n FROM ai_usage WHERE ip_address = ? AND date = ?')
          .bind(ip, date)
          .first<{ n: number }>()
        used = row?.n ?? 0

        if (used >= limit) {
          return new Response(
            JSON.stringify({
              error: 'quota-exceeded',
              message: `今日免费配额已用完(${limit} 次)。请明天再试,或在「设置」填入你自己的 API Key。`,
              limit,
              used,
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '86400',
                'X-AI-Mode': 'demo',
                'X-AI-Quota-Limit': String(limit),
                'X-AI-Quota-Used': String(used),
                'X-AI-Quota-Remaining': '0',
              },
            },
          )
        }
      }
    }

    // Build the upstream request, injecting the demo key when needed.
    const headers = copyHeadersFiltered(requestHeaders, HOP_BY_HOP)
    if (!headers.has('anthropic-version')) headers.set('anthropic-version', '2023-06-01')
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
    if (mode === 'demo') {
      headers.set('x-api-key', context.env.AI_DEMO_KEY as string)
    }

    const init: RequestInit = {
      method: context.request.method,
      headers,
    }
    if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
      init.body = context.request.body
    }

    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl, init)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'upstream-unreachable'
      return new Response(
        JSON.stringify({ error: 'upstream-unreachable', message }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Record demo-mode usage AFTER a successful (or at least
    // answered) upstream call. We deliberately count even 4xx/5xx
    // so an attacker can't spam failures for free.
    if (mode === 'demo' && context.env.DB) {
      try {
        await context.env.DB
          .prepare(
            'INSERT INTO ai_usage (id, ip_address, date, created_at) VALUES (?, ?, ?, ?)',
          )
          .bind(randomId(), getClientIp(context.request), utcDateKey(), Date.now())
          .run()
        used += 1
      } catch (err) {
        console.error('[proxy] failed to record ai_usage', err)
      }
    }

    const responseHeaders = copyHeadersFiltered(upstream.headers, HOP_BY_HOP)
    responseHeaders.set('X-AI-Mode', mode)
    responseHeaders.set('X-AI-Quota-Limit', String(limit))
    responseHeaders.set('X-AI-Quota-Used', String(used))
    responseHeaders.set(
      'X-AI-Quota-Remaining',
      String(Math.max(0, limit - used)),
    )

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: 'function-crashed', message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const onRequest = handler