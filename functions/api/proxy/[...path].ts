/**
 * Cloudflare Pages Function: /api/proxy/*
 *
 * Reverse proxy for the BYOK Anthropic-compatible endpoint. Browser
 * sends a same-origin POST to /api/proxy/anthropic/v1/messages,
 * the Pages Function forwards it to the configured upstream
 * (defaults to https://api.minimaxi.com/anthropic), and streams
 * the SSE response back unchanged.
 *
 * Why this exists
 * ---------------
 * Anthropic's official endpoint only allows `anthropic-dangerous-
 * direct-browser-access` CORS for browser-direct calls, and third-
 * party Anthropic-compatible endpoints (MiniMax, self-hosted proxies)
 * don't always honour it. From the browser we see
 *   TypeError: Failed to fetch
 * even though a CLI curl against the same URL succeeds (curl doesn't
 * enforce CORS). A same-origin proxy turns the request into a
 * server-to-server call that no CORS check applies to.
 *
 * Configuration
 * -------------
 * Upstream URL is read from the `AI_PROXY_UPSTREAM` Pages env var.
 * Defaults to `https://api.minimaxi.com/anthropic`. In Pages:
 *   Settings → Functions → AI_PROXY_UPSTREAM (optional)
 *
 * Path mapping
 * ------------
 *   /api/proxy/<rest>          → ${AI_PROXY_UPSTREAM}/<rest>
 *   /api/proxy                 → 404 (no upstream path)
 *
 * The Function passes through headers, body, and SSE stream
 * transparently — it doesn't interpret the upstream payload.
 */

// Minimal structural types — avoids importing @cloudflare/workers-types
// from a root tsconfig that doesn't include the `functions/` dir.
type Env = Record<string, string | undefined>

interface CfContext {
  request: Request
  env: Env
  params: Record<string, string | string[]>
  data: Record<string, unknown>
}

type PagesHandler = (ctx: CfContext) => Promise<Response> | Response

const DEFAULT_UPSTREAM = 'https://api.minimaxi.com/anthropic'

// Hop-by-hop headers that must NOT be forwarded per RFC 7230 §6.1.
// Also strip Cloudflare-specific and host headers so the upstream
// doesn't see the wrong origin.
const HOP_BY_HOP = new Set([
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

function buildUpstream(path: string[], env: Env): string {
  const base = (env.AI_PROXY_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, '')
  if (path.length === 0) return base
  return base + '/' + path.join('/')
}

function sanitizeRequestHeaders(req: Request): Headers {
  const out = new Headers()
  req.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    out.set(key, value)
  })
  // Ensure these headers always reach the upstream so the call is
  // authenticated the same way the browser would have called it.
  if (!out.has('anthropic-version')) out.set('anthropic-version', '2023-06-01')
  if (!out.has('content-type')) out.set('content-type', 'application/json')
  return out
}

const handler: PagesHandler = async (context) => {
  const url = new URL(context.request.url)
  // Strip "/api/proxy" prefix and split the rest.
  const rest = url.pathname.replace(/^\/api\/proxy\/?/, '')
  const segments = rest.split('/').filter(Boolean)

  if (segments.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'missing-path',
        message: 'Use /api/proxy/<upstream-path>, e.g. /api/proxy/v1/messages',
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const upstreamUrl = buildUpstream(segments, context.env) + url.search

  const init: RequestInit = {
    method: context.request.method,
    headers: sanitizeRequestHeaders(context.request),
  }

  // Only attach body for non-GET/HEAD requests (matches the original
  // semantics; an empty GET body is harmless but we skip it).
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body
  }

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, init)
  } catch (err) {
    // Network failure reaching the upstream. Return 502 so the
    // browser surfaces a useful message instead of "Failed to fetch".
    const message = err instanceof Error ? err.message : 'upstream-unreachable'
    return new Response(
      JSON.stringify({ error: 'upstream-unreachable', message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // Forward the upstream response back to the browser unchanged.
  // Build a clean header set: drop hop-by-hop, keep content-type,
  // cache-control, and SSE headers intact.
  const headers = new Headers()
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key.toLowerCase())) return
    headers.set(key, value)
  })

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}

export const onRequest = handler