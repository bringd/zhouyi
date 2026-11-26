/**
 * Unit tests for the Cloudflare Pages Function:
 *   functions/api/proxy/anthropic/v1/messages.ts
 *
 * Architecture: module-import + fetch spy. The handler is exported
 * as `onRequest` and takes a structural `{request, env, params, data}`
 * context, so we can call it directly with synthetic data — no
 * wrangler/miniflare required.
 *
 * Phase 2 changes under test:
 *   - The per-IP daily AI quota (default 5/day) was removed.
 *   - `X-AI-Quota-Limit/Used/Remaining` response headers were removed.
 *   - The handler no longer reads or writes the `ai_usage` D1 table.
 *   - A D1 binding is no longer required by the function.
 *
 * What is still asserted:
 *   - BYOK transparency (header/body verbatim, no upstream key rewrite,
 *     no model pinning).
 *   - Demo mode injects AI_DEMO_KEY.
 *   - Demo mode pins the model server-side (body.model → AI_MODEL or
 *     the built-in default `deepseek-v4.1-flash`), exposed as X-AI-Model.
 *   - Demo mode floors `max_tokens` at 4096 and disables reasoning unless
 *     `AI_ENABLE_THINKING` is set — otherwise thinking eats the budget and
 *     the interpretation's tail sections get truncated. BYOK is untouched.
 *   - Both modes ensure the OpenCode Go `x-opencode-session` header.
 *   - Demo mode without AI_DEMO_KEY returns 503.
 *   - BYOK always sets X-AI-Mode: byok; demo always sets X-AI-Mode: demo.
 *   - Upstream fetch failure → 502 upstream-unreachable.
 *   - Upstream 5xx → status passes through.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../functions/api/proxy/anthropic/v1/messages";

const BODY_JSON =
  '{"model":"minimax-m3","messages":[{"role":"user","content":"hi"}]}';

const DEFAULT_UPSTREAM_URL = "https://opencode.ai/zen/go/v1/messages";
const DEFAULT_MODEL = "deepseek-v4.1-flash";

function makeRequest(
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
  } = {},
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    ...init.headers,
  };
  return new Request("https://example.com/api/proxy/anthropic/v1/messages", {
    method: init.method ?? "POST",
    headers,
    body: init.body ?? BODY_JSON,
  });
}

function makeContext(
  opts: {
    env?: Record<string, unknown>;
    request?: Request;
  } = {},
) {
  const request = opts.request ?? makeRequest();
  const env = (opts.env ?? {}) as Record<string, unknown>;
  return { request, env, params: {}, data: {} };
}

const DEMO_KEY = "sk-demo-test-key";

const upstreamOk = (headers: Record<string, string> = {}) =>
  new Response('{"ok":true}', {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });

const upstream500 = () =>
  new Response('{"error":"oops"}', {
    status: 500,
    headers: { "content-type": "application/json" },
  });

describe("functions/api/proxy/anthropic/v1/messages", () => {
  let fetchSpy: import("vitest").MockInstance;

  beforeEach(() => {
    fetchSpy = vi.spyOn(
      globalThis,
      "fetch",
    ) as unknown as import("vitest").MockInstance;
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────
  // 1) BYOK transparency
  // ────────────────────────────────────────────────────────────────────
  it("BYOK: forwards original headers + body verbatim, returns X-AI-Mode: byok", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const ctx = makeContext({
      // no AI_DEMO_KEY configured — BYOK path doesn't need it
      env: {},
      request: makeRequest({
        headers: {
          "x-api-key": "sk-user-supplied-xyz",
          "x-custom-app": "orix-studio",
        },
      }),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_UPSTREAM_URL);
    expect(init.method).toBe("POST");

    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("x-api-key")).toBe("sk-user-supplied-xyz");
    expect(sentHeaders.get("x-custom-app")).toBe("orix-studio");
    expect(sentHeaders.get("anthropic-version")).toBe("2023-06-01");
    expect(sentHeaders.get("content-type")).toBe("application/json");
    // Hop-by-hop headers must be stripped
    expect(sentHeaders.has("cf-connecting-ip")).toBe(false);
    expect(sentHeaders.has("host")).toBe(false);

    // Body preserved bit-for-bit — BYOK keeps the caller's model.
    const sentBody = await new Response(init.body as BodyInit).text();
    expect(sentBody).toBe(BODY_JSON);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Mode")).toBe("byok");
    // No pinning happened, so no model hint is advertised.
    expect(res.headers.get("X-AI-Model")).toBeNull();
    // Quota headers removed in Phase 2
    expect(res.headers.get("X-AI-Quota-Limit")).toBeNull();
    expect(res.headers.get("X-AI-Quota-Used")).toBeNull();
    expect(res.headers.get("X-AI-Quota-Remaining")).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────
  // 2) demo happy path: injects AI_DEMO_KEY, no quota writes
  // ────────────────────────────────────────────────────────────────────
  it("demo: injects AI_DEMO_KEY, returns X-AI-Mode: demo, no quota headers, no D1 needed", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const ctx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(DEFAULT_UPSTREAM_URL);
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("x-api-key")).toBe(DEMO_KEY);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBeNull();
    expect(res.headers.get("X-AI-Quota-Used")).toBeNull();
    expect(res.headers.get("X-AI-Quota-Remaining")).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────
  // 3) demo missing AI_DEMO_KEY
  // ────────────────────────────────────────────────────────────────────
  it("demo (no AI_DEMO_KEY configured): returns 503 + X-AI-Mode:demo, never calls upstream", async () => {
    const ctx = makeContext({
      env: {
        /* AI_DEMO_KEY intentionally absent */
      },
      request: makeRequest(),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBeNull();

    const body = await res.json();
    expect(body.error).toBe("demo-unavailable");
    expect(typeof body.message).toBe("string");
  });

  // ────────────────────────────────────────────────────────────────────
  // 4) upstream fetch-throws → 502
  // ────────────────────────────────────────────────────────────────────
  it("upstream network failure: fetch throws → 502 upstream-unreachable, X-AI-Mode reflects active mode", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("ECONNRESET"));

    const ctx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });

    const res = await onRequest(ctx);

    expect(res.status).toBe(502);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");

    const body = await res.json();
    expect(body.error).toBe("upstream-unreachable");
    expect(body.message).toContain("ECONNRESET");
  });

  // ────────────────────────────────────────────────────────────────────
  // 5) upstream 5xx passes through
  // ────────────────────────────────────────────────────────────────────
  it("upstream 5xx: status passes through to client", async () => {
    fetchSpy.mockResolvedValueOnce(upstream500());

    const ctx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });

    const res = await onRequest(ctx);

    expect(res.status).toBe(500);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
  });

  // ────────────────────────────────────────────────────────────────────
  // 6) X-AI-Mode header contract across all paths (Phase 2 — no quota headers)
  // ────────────────────────────────────────────────────────────────────
  it("X-AI-Mode present on every response; X-AI-Quota-* never present", async () => {
    // BYOK 200
    fetchSpy.mockResolvedValueOnce(upstreamOk());
    const byokCtx = makeContext({
      env: {},
      request: makeRequest({ headers: { "x-api-key": "sk-user-1" } }),
    });
    const r1 = await onRequest(byokCtx);
    expect(r1.headers.get("X-AI-Mode")).toBe("byok");
    expect(r1.headers.get("X-AI-Quota-Limit")).toBeNull();

    // demo 200
    fetchSpy.mockResolvedValueOnce(upstreamOk());
    const demo200Ctx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });
    const r2 = await onRequest(demo200Ctx);
    expect(r2.headers.get("X-AI-Mode")).toBe("demo");
    expect(r2.headers.get("X-AI-Quota-Limit")).toBeNull();

    // demo 503 (no AI_DEMO_KEY)
    const demo503Ctx = makeContext({
      env: {},
      request: makeRequest(),
    });
    const r3 = await onRequest(demo503Ctx);
    expect(r3.headers.get("X-AI-Mode")).toBe("demo");
    expect(r3.headers.get("X-AI-Quota-Limit")).toBeNull();

    // demo 502 (fetch throws)
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    const demo502Ctx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });
    const r4 = await onRequest(demo502Ctx);
    expect(r4.headers.get("X-AI-Mode")).toBe("demo");
    expect(r4.headers.get("X-AI-Quota-Limit")).toBeNull();

    // demo upstream 500
    fetchSpy.mockResolvedValueOnce(upstream500());
    const demo5xxCtx = makeContext({
      env: { AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest(),
    });
    const r5 = await onRequest(demo5xxCtx);
    expect(r5.headers.get("X-AI-Mode")).toBe("demo");
    expect(r5.headers.get("X-AI-Quota-Limit")).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────
  // 7) demo mode pins the model server-side
  // ────────────────────────────────────────────────────────────────────
  it("demo: rewrites body.model to the pinned default and reports X-AI-Model", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const res = await onRequest(
      makeContext({ env: { AI_DEMO_KEY: DEMO_KEY } }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(
      await new Response(init.body as BodyInit).text(),
    ) as { model: string; messages: unknown };
    expect(sentBody.model).toBe(DEFAULT_MODEL);
    // Everything except the server-side output policy is untouched.
    expect(sentBody.messages).toEqual([{ role: "user", content: "hi" }]);

    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Model")).toBe(DEFAULT_MODEL);
  });

  it("demo: floors max_tokens at 4096 and disables thinking so the six sections fit", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    // A stale browser bundle still sends max_tokens: 1024 and no thinking flag.
    await onRequest(
      makeContext({
        env: { AI_DEMO_KEY: DEMO_KEY },
        request: makeRequest({
          body: '{"model":"minimax-m3","max_tokens":1024,"messages":[]}',
        }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(
      await new Response(init.body as BodyInit).text(),
    ) as { max_tokens: number; thinking?: { type?: string } };
    expect(sentBody.max_tokens).toBe(4096);
    expect(sentBody.thinking).toEqual({ type: "disabled" });
  });

  it("demo: never lowers a caller-supplied max_tokens above the floor", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    await onRequest(
      makeContext({
        env: { AI_DEMO_KEY: DEMO_KEY },
        request: makeRequest({
          body: '{"model":"minimax-m3","max_tokens":8192,"messages":[]}',
        }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(
      await new Response(init.body as BodyInit).text(),
    ) as { max_tokens: number };
    expect(sentBody.max_tokens).toBe(8192);
  });

  it("demo: AI_ENABLE_THINKING=1 keeps the caller's reasoning settings", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    await onRequest(
      makeContext({
        env: { AI_DEMO_KEY: DEMO_KEY, AI_ENABLE_THINKING: "1" },
        request: makeRequest({
          body: '{"model":"minimax-m3","thinking":{"type":"enabled","budget_tokens":512},"messages":[]}',
        }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(
      await new Response(init.body as BodyInit).text(),
    ) as { thinking?: { type?: string; budget_tokens?: number } };
    expect(sentBody.thinking).toEqual({ type: "enabled", budget_tokens: 512 });
  });

  it("demo: AI_MODEL overrides the pinned default", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const res = await onRequest(
      makeContext({ env: { AI_DEMO_KEY: DEMO_KEY, AI_MODEL: "some-other-model" } }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(
      await new Response(init.body as BodyInit).text(),
    ) as { model: string };
    expect(sentBody.model).toBe("some-other-model");
    expect(res.headers.get("X-AI-Model")).toBe("some-other-model");
  });

  it("demo: a non-JSON body is forwarded unchanged instead of failing", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    await onRequest(
      makeContext({
        env: { AI_DEMO_KEY: DEMO_KEY },
        request: makeRequest({ body: "not json at all" }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentBody = await new Response(init.body as BodyInit).text();
    expect(sentBody).toBe("not json at all");
  });

  // ────────────────────────────────────────────────────────────────────
  // 8) OpenCode Go requires x-opencode-session
  // ────────────────────────────────────────────────────────────────────
  it("injects x-opencode-session when the caller didn't send one", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    await onRequest(makeContext({ env: { AI_DEMO_KEY: DEMO_KEY } }));

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    const session = sentHeaders.get("x-opencode-session");
    expect(session).toBeTruthy();
    expect((session as string).length).toBeGreaterThan(8);
  });

  it("keeps a caller-supplied x-opencode-session", async () => {
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    await onRequest(
      makeContext({
        env: { AI_DEMO_KEY: DEMO_KEY },
        request: makeRequest({
          headers: { "x-opencode-session": "session-from-caller" },
        }),
      }),
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("x-opencode-session")).toBe("session-from-caller");
  });
});
