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
 * Why this filename
 * -----------------
 * The Cloudflare Pages Functions catch-all convention is a file
 * named `[[slug]].ts` inside the routing directory. Placing this at
 * `functions/api/proxy/[[path]].ts` matches every URL under
 * /api/proxy/*. (`context.params.path` is the array of segments
 * after the prefix; we don't actually need it because we parse the
 * URL ourselves, but Pages sets it.)
 *
 * Configuration
 * -------------
 * Upstream URL is read from the `AI_PROXY_UPSTREAM` Pages env var.
 * Defaults to `https://api.minimaxi.com/anthropic`. In Pages:
 *   Settings → Functions → AI_PROXY_UPSTREAM (optional)
 *
 * The Function passes through headers, body, and SSE stream
 * transparently — it doesn't interpret the upstream payload.
 */

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

function buildUpstream(path: string[], env: Env): string {
  const base = (env.AI_PROXY_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, '')
  if (path.length === 0) return base
  return base + '/' + path.join('/')
}

function copyHeadersFiltered(src: Headers, blocked: ReadonlySet<string>): Headers {
  const out = new Headers()
  src.forEach((value, key) => {
    if (blocked.has(key.toLowerCase())) return
    out.set(key, value)
  })
  return out
}

const handler: PagesHandler = async (context) => {
  // Wrap everything so we never throw raw 500s — return JSON
  // diagnostics instead so the browser can surface a useful message.
  try {
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

    const headers = copyHeadersFiltered(context.request.headers, HOP_BY_HOP)
    // Ensure these headers always reach the upstream.
    if (!headers.has('anthropic-version')) headers.set('anthropic-version', '2023-06-01')
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')

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

    const responseHeaders = copyHeadersFiltered(upstream.headers, HOP_BY_HOP)

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  } catch (err) {
    // Last-resort safety net so the Worker runtime never sees a
    // raw throw (Cloudflare would return error code 1101).
    const message = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: 'function-crashed', message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

export const onRequest = handler