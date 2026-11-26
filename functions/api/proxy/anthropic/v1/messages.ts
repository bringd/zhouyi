/**
 * Cloudflare Pages Function: POST /api/proxy/anthropic/v1/messages
 *
 * Reverse proxy for the Anthropic-compatible endpoint with two modes:
 *
 * 1. **BYOK mode** (user supplied their own API Key)
 *    - Browser sends `x-api-key: sk-...` header.
 *    - Function forwards it transparently to the upstream — including the
 *      `model` the browser asked for. No quota check, no record-keeping.
 *
 * 2. **Demo mode** (user has no API Key)
 *    - Browser sends no `x-api-key` header.
 *    - Function looks up `env.AI_DEMO_KEY` and injects it.
 *    - **The model is pinned server-side**: whatever `model` the browser
 *      sent is rewritten to `env.AI_MODEL` (default `deepseek-v4.1-flash`,
 *      served by the OpenCode Go gateway). Old browsers with a stale
 *      localStorage model therefore still hit the intended model.
 *    - No quota is enforced (Phase 2 lifted the demo-mode daily limit).
 *
 * 3. **Gateway session header**
 *    - The OpenCode Go gateway rejects requests without `x-opencode-session`
 *      (`400 MissingSessionID`). When the incoming request doesn't carry one,
 *      a per-request id is generated. The header is harmless to other
 *      Anthropic-compatible upstreams.
 *
 * Configuration
 * -------------
 * - `AI_DEMO_KEY`        — server-side gateway key (OpenCode Go: `oc_sk_...`).
 *                          If unset, demo mode returns 503.
 * - `AI_MODEL`           — server-pinned model for demo mode.
 *                          Default `deepseek-v4.1-flash`.
 * - `AI_PROXY_UPSTREAM`  — override the upstream URL.
 *                          Default `https://opencode.ai/zen/go/v1/messages`.
 * - `AI_THINKING_BUDGET` — reasoning budget for demo mode. Default `1024`.
 *                          A/B on the same reading showed the reasoning pass
 *                          catches conditions the fast path glosses over
 *                          (e.g. 「贞吉」要求守正), at the cost of a slower
 *                          first token. Set to `0` (or `AI_ENABLE_THINKING=0`)
 *                          to fall back to the non-reasoning path.
 * - `AI_ENABLE_THINKING` — legacy off-switch (`0`/`false`/`off`/`no`).
 *                          Any other value keeps the budget above.
 *
 * Demo-mode output budget
 * -----------------------
 * Reasoning models spend `max_tokens` on thinking *before* emitting the
 * six-section interpretation, so a small budget truncates it (a 1024 budget
 * with the gateway's default reasoning size produced an empty reading).
 * Demo mode therefore floors `max_tokens` at `DEFAULT_MAX_TOKENS` (4096)
 * and keeps it strictly above `budget_tokens`, which the upstream requires.
 * BYOK requests are left untouched — the caller's provider may not accept
 * `thinking` at all.
 *
 * Response headers (always present)
 * ---------------------------------
 * - `X-AI-Mode: byok` | `demo`  — which mode served this request
 * - `X-AI-Model`                — model the request was actually sent with
 *
 * Note: AI demo quota headers (`X-AI-Quota-Limit/Used/Remaining`)
 * were removed in Phase 2 alongside the per-IP quota enforcement.
 * The DB binding is no longer required.
 */

type Env = {
  AI_DEMO_KEY?: string;
  AI_MODEL?: string;
  AI_PROXY_UPSTREAM?: string;
  AI_ENABLE_THINKING?: string;
  AI_THINKING_BUDGET?: string;
};

interface CfContext {
  request: Request;
  env: Env;
  params: Record<string, string | string[]>;
  data: Record<string, unknown>;
}

type PagesHandler = (ctx: CfContext) => Promise<Response> | Response;

const DEFAULT_UPSTREAM = "https://opencode.ai/zen/go/v1/messages";
const DEFAULT_MODEL = "deepseek-v4.1-flash";
/**
 * Minimum output budget for demo mode. The six-section interpretation is
 * roughly 700-900 Chinese characters (~1100-1400 tokens); reasoning models
 * charge thinking to the same budget. 4096 leaves headroom for a longer
 * prompt style without being a cost commitment — `max_tokens` is a cap, and
 * billing follows the tokens actually generated (typically 500-900).
 */
const DEFAULT_MAX_TOKENS = 4096;
/**
 * Default reasoning budget for demo mode. 1024 keeps the reading responsive
 * (~18s to first token instead of 35s with the gateway default of 2724) while
 * still letting the model check its own conclusion before writing.
 */
const DEFAULT_THINKING_BUDGET = 1024;
/** Headroom kept between `budget_tokens` and `max_tokens` (upstream rule: budget < max). */
const THINKING_HEADROOM = 2048;

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

function resolveModel(env: Env): string {
  const pinned = env.AI_MODEL?.trim();
  return pinned && pinned.length > 0 ? pinned : DEFAULT_MODEL;
}

/**
 * Reasoning budget for demo mode, in tokens. `0` disables the reasoning block.
 * `AI_ENABLE_THINKING=0|false|off|no` is a legacy off-switch; otherwise
 * `AI_THINKING_BUDGET` wins and falls back to `DEFAULT_THINKING_BUDGET`.
 */
function resolveThinkingBudget(env: Env): number {
  const flag = env.AI_ENABLE_THINKING?.trim().toLowerCase();
  if (flag && /^(0|false|off|no)$/.test(flag)) return 0;
  const raw = env.AI_THINKING_BUDGET?.trim();
  if (!raw) return DEFAULT_THINKING_BUDGET;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
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

/**
 * Rewrite the JSON body for demo mode: pin `model`, floor `max_tokens`, and
 * set the reasoning budget. Anything we can't parse is passed through
 * untouched (never drop a request just to apply server-side defaults).
 */
function applyDemoBodyPolicy(
  raw: string,
  model: string,
  thinkingBudget: number,
): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return raw;
    }
    const body: Record<string, unknown> = {
      ...(parsed as Record<string, unknown>),
      model,
    };
    const requested =
      typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)
        ? body.max_tokens
        : 0;
    // Upstream requires budget_tokens < max_tokens, so the floor has to clear
    // both the shared constant and the reasoning budget.
    body.max_tokens = Math.max(
      requested,
      DEFAULT_MAX_TOKENS,
      thinkingBudget + THINKING_HEADROOM,
    );
    body.thinking =
      thinkingBudget > 0
        ? { type: "enabled", budget_tokens: thinkingBudget }
        : { type: "disabled" };
    return JSON.stringify(body);
  } catch {
    return raw;
  }
}

function newSessionId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `orix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    if (!headers.has("x-opencode-session")) {
      headers.set("x-opencode-session", newSessionId());
    }

    const init: RequestInit = {
      method: context.request.method,
      headers,
    };

    let appliedModel: string | undefined;
    if (context.request.method !== "GET" && context.request.method !== "HEAD") {
      if (mode === "demo") {
        // Server-side generation policy: pin the model, guarantee enough
        // output budget, and set the reasoning budget.
        appliedModel = resolveModel(context.env);
        const rawBody = await context.request.text();
        init.body = applyDemoBodyPolicy(
          rawBody,
          appliedModel,
          resolveThinkingBudget(context.env),
        );
      } else {
        init.body = context.request.body;
      }
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
    if (appliedModel) responseHeaders.set("X-AI-Model", appliedModel);

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
