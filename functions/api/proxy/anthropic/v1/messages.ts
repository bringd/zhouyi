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
 *    - Forwards to upstream. No quota is enforced (Phase 2 lifted
 *      the demo-mode daily limit; the server is responsible for its
 *      own AI budget via upstream key throttling).
 *
 * Configuration
 * -------------
 * - `AI_DEMO_KEY` — the server-side MiniMax API key. Set in
 *   Pages → Settings → Environment variables. If unset, demo mode
 *   returns 503 ("demo temporarily unavailable").
 * - `AI_PROXY_UPSTREAM` — override the upstream base URL. Default
 *   `https://api.minimaxi.com/anthropic/v1/messages`.
 *
 * Response headers (always present)
 * ---------------------------------
 * - `X-AI-Mode: byok` | `demo`               — which mode served this request
 *
 * Note: AI demo quota headers (`X-AI-Quota-Limit/Used/Remaining`)
 * were removed in Phase 2 alongside the per-IP quota enforcement.
 * The DB binding is no longer required.
 */

type Env = {
  AI_DEMO_KEY?: string;
  AI_PROXY_UPSTREAM?: string;
};

interface CfContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
}

type PagesHandler = (ctx: CfContext) => Promise<Response> | Response;

const DEFAULT_UPSTREAM = "https://api.minimaxi.com/anthropic/v1/messages";

// Hop-by-hop headers that must NOT be forwarded per RFC 7230 §6.1.
// Also strip Cloudflare-specific and host headers so the upstream
// doesn't see the wrong origin.
const HOP_BY_HOP: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "cf-connecting-ip",
  "cf-ray",
  "cf-worker",
  "cf-visitor",
  "x-forwarded-proto",
  "x-forwarded-for",
  "x-real-ip",
]);

function resolveUpstream(env: Env): string {
  return (env.AI_PROXY_UPSTREAM ?? DEFAULT_UPSTREAM).replace(/\/+$/, "");
}

function copyHeadersFiltered(
  src: Headers,
  blocked: ReadonlySet<string>,
): Headers {
  const out = new Headers();
  src.forEach((value, key) => {
    if (blocked.has(key.toLowerCase())) return;
    out.set(key, value);
  });
  return out;
}

const handler: PagesHandler = async (context) => {
  try {
    const upstreamUrl = resolveUpstream(context.env);
    const requestHeaders = context.request.headers;

    // Decide mode from the request: presence of x-api-key means BYOK.
    const userApiKey = requestHeaders.get("x-api-key")?.trim();
    const mode: "byok" | "demo" = userApiKey ? "byok" : "demo";

    // Demo mode requires the server-side key.
    if (mode === "demo" && !context.env.AI_DEMO_KEY) {
      return new Response(
        JSON.stringify({
          error: "demo-unavailable",
          message:
            "AI demo temporarily unavailable. Add your own API key in Settings to continue.",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json", "X-AI-Mode": "demo" },
        },
      );
    }

    // Build the upstream request, injecting the demo key when needed.
    const headers = copyHeadersFiltered(requestHeaders, HOP_BY_HOP);
    if (!headers.has("anthropic-version"))
      headers.set("anthropic-version", "2023-06-01");
    if (!headers.has("content-type"))
      headers.set("content-type", "application/json");
    if (mode === "demo") {
      headers.set("x-api-key", context.env.AI_DEMO_KEY as string);
    }

    const init: RequestInit = {
      method: context.request.method,
      headers,
    };
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      init.body = context.request.body;
    }

    let upstream: Response;
    try {
      upstream = await fetch(upstreamUrl, init);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "upstream-unreachable";
      return new Response(
        JSON.stringify({ error: "upstream-unreachable", message }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", "X-AI-Mode": mode },
        },
      );
    }

    const responseHeaders = copyHeadersFiltered(upstream.headers, HOP_BY_HOP);
    responseHeaders.set("X-AI-Mode", mode);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "function-crashed", message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};

export const onRequest = handler;
