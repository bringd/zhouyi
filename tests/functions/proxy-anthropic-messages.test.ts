/**
 * Unit tests for the Cloudflare Pages Function:
 *   functions/api/proxy/anthropic/v1/messages.ts
 *
 * Architecture: candidate B (module-import + fetch spy + memory-stub D1).
 *
 * Why not candidate A (`unstable_dev` / real Pages dev)?
 *  - The source file has zero CF-runtime imports — it's a plain async
 *    function exported as `onRequest`. We can call it directly with a
 *    synthetic `Request` and a stub `env`, which is faster, fully
 *    deterministic, and avoids the miniflare/D1 file-hash mismatch
 *    documented in AGENTS.md.
 *  - Real wrangler pages dev requires a working D1 binding, which
 *    on Windows is documented as broken for the shared
 *    `wrangler d1 migrations apply --local` path.
 *
 * What we inject:
 *  - `env.DB` is a structural stub that records every `prepare(...).bind(...).first()/run()`
 *    call. The handler's local `Env.DB` type is already a structural
 *    stub (no `@cloudflare/workers-types` import), so plain objects
 *    satisfy it.
 *  - Global `fetch` is stubbed via `vi.spyOn(globalThis, 'fetch')` so
 *    we can assert the URL, headers, and body that reach the upstream.
 *
 * What we DO NOT touch:
 *  - The source file under `functions/`. The handler body, the
 *    `DEFAULT_UPSTREAM`, `DEFAULT_DAILY_LIMIT`, and `HOP_BY_HOP`
 *    constants are read as-is.
 *  - `AI_DEMO_KEY` is never printed; we use a synthetic
 *    sentinel string `"sk-demo-test-key"` and assert on that.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { onRequest } from "../../functions/api/proxy/anthropic/v1/messages";

type StubStatement = {
  sql: string;
  args: unknown[];
  firstResult?: unknown;
  runResult?: unknown;
};

type StubDb = {
  calls: StubStatement[];
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => {
      first: <T = unknown>() => Promise<T | null>;
      run: () => Promise<unknown>;
      all: <T = unknown>() => Promise<T[]>;
    };
  };
};

function makeStubDb(initialCount = 0): StubDb {
  const calls: StubStatement[] = [];
  const db: StubDb = {
    calls,
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          const stmt: StubStatement = { sql, args };
          calls.push(stmt);
          return {
            async first<T = unknown>(): Promise<T | null> {
              if (/SELECT COUNT/i.test(sql)) {
                return { n: initialCount } as unknown as T;
              }
              return stmt.firstResult as T | null;
            },
            async run(): Promise<unknown> {
              return stmt.runResult ?? { success: true };
            },
            async all<T = unknown>(): Promise<T[]> {
              return (stmt.firstResult as T[]) ?? [];
            },
          };
        },
      };
    },
  };
  return db;
}

const BODY_JSON =
  '{"model":"minimax-m3","messages":[{"role":"user","content":"hi"}]}';

function makeRequest(
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit | null;
    ip?: string;
  } = {},
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
    ...init.headers,
  };
  if (init.ip) headers["cf-connecting-ip"] = init.ip;
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
  it("BYOK: forwards original headers + body verbatim, returns X-AI-Mode: byok, never touches D1", async () => {
    const db = makeStubDb();
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const ctx = makeContext({
      env: { DB: db }, // present but should not be used
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
    expect(url).toBe("https://api.minimaxi.com/anthropic/v1/messages");
    expect(init.method).toBe("POST");

    const sentHeaders = new Headers(init.headers as HeadersInit);
    expect(sentHeaders.get("x-api-key")).toBe("sk-user-supplied-xyz");
    expect(sentHeaders.get("x-custom-app")).toBe("orix-studio");
    expect(sentHeaders.get("anthropic-version")).toBe("2023-06-01");
    expect(sentHeaders.get("content-type")).toBe("application/json");
    // Hop-by-hop headers must be stripped
    expect(sentHeaders.has("cf-connecting-ip")).toBe(false);
    expect(sentHeaders.has("host")).toBe(false);

    // Body preserved bit-for-bit
    const sentBody = await new Response(init.body as BodyInit).text();
    expect(sentBody).toBe(BODY_JSON);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Mode")).toBe("byok");
    expect(res.headers.get("X-AI-Quota-Limit")).toBe("5");
    expect(res.headers.get("X-AI-Quota-Used")).toBe("0");
    expect(res.headers.get("X-AI-Quota-Remaining")).toBe("5");

    // D1 must not be touched in BYOK mode
    expect(db.calls).toHaveLength(0);
  });

  // ────────────────────────────────────────────────────────────────────
  // 2) demo happy path (under quota)
  // ────────────────────────────────────────────────────────────────────
  it("demo (under quota): injects AI_DEMO_KEY, returns X-AI-Mode: demo + Limit:5/Used:1/Remaining:4, INSERTs ai_usage once", async () => {
    const db = makeStubDb(0); // current count = 0
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const ctx = makeContext({
      env: { DB: db, AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "203.0.113.7" }),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.minimaxi.com/anthropic/v1/messages");
    const sentHeaders = new Headers(init.headers as HeadersInit);
    // Demo key injection, user's x-api-key was absent so no override
    expect(sentHeaders.get("x-api-key")).toBe(DEMO_KEY);

    expect(res.status).toBe(200);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBe("5");
    expect(res.headers.get("X-AI-Quota-Used")).toBe("1");
    expect(res.headers.get("X-AI-Quota-Remaining")).toBe("4");

    // D1: one SELECT (quota check) + one INSERT (record usage)
    expect(db.calls).toHaveLength(2);
    expect(db.calls[0].sql).toMatch(/SELECT COUNT\(\*\) AS n FROM ai_usage/i);
    expect(db.calls[0].args).toEqual([
      "203.0.113.7",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ]);
    expect(db.calls[1].sql).toMatch(/INSERT INTO ai_usage/i);
  });

  // ────────────────────────────────────────────────────────────────────
  // 3) demo over quota (count >= limit)
  // ────────────────────────────────────────────────────────────────────
  it("demo (over quota): returns 429 + Retry-After:86400 + X-AI-Mode:demo, never calls upstream and never INSERTs", async () => {
    const db = makeStubDb(5); // already at the 5/day limit
    const ctx = makeContext({
      env: { DB: db, AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "198.51.100.4" }),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("86400");
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBe("5");
    expect(res.headers.get("X-AI-Quota-Used")).toBe("5");
    expect(res.headers.get("X-AI-Quota-Remaining")).toBe("0");

    // Only the quota-check SELECT happened; no INSERT
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toMatch(/SELECT COUNT/i);

    const body = await res.json();
    expect(body.error).toBe("quota-exceeded");
    expect(body.limit).toBe(5);
    expect(body.used).toBe(5);
  });

  // ────────────────────────────────────────────────────────────────────
  // 4) demo missing AI_DEMO_KEY
  // ────────────────────────────────────────────────────────────────────
  it("demo (no AI_DEMO_KEY configured): returns 503 + X-AI-Mode:demo, never calls upstream and never touches D1", async () => {
    const db = makeStubDb();
    const ctx = makeContext({
      env: { DB: db /* AI_DEMO_KEY intentionally absent */ },
      request: makeRequest({ ip: "192.0.2.42" }),
    });

    const res = await onRequest(ctx);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.status).toBe(503);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBe("5");

    expect(db.calls).toHaveLength(0);

    const body = await res.json();
    expect(body.error).toBe("demo-unavailable");
    expect(typeof body.message).toBe("string");
  });

  // ────────────────────────────────────────────────────────────────────
  // 5) demo INSERT details — bound args conform to ai_usage contract
  // ────────────────────────────────────────────────────────────────────
  it("demo (INSERT contract): id is UUID-v4-shape, ip comes from cf-connecting-ip, date is YYYY-MM-DD UTC, created_at is numeric ms", async () => {
    const db = makeStubDb(0);
    fetchSpy.mockResolvedValueOnce(upstreamOk());

    const before = Date.now();
    const ctx = makeContext({
      env: { DB: db, AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "203.0.113.99" }),
    });

    await onRequest(ctx);
    const after = Date.now();

    expect(db.calls).toHaveLength(2);
    const insert = db.calls[1];
    expect(insert.sql).toMatch(
      /INSERT INTO ai_usage \(id, ip_address, date, created_at\)/i,
    );
    const [id, ip, date, createdAt] = insert.args;
    // UUID v4 shape: 8-4-4-4-12 hex with version nibble '4' and variant nibble in {8,9,a,b}
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(ip).toBe("203.0.113.99");
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Should match today's UTC date
    const expectedDate = new Date().toISOString().slice(0, 10);
    expect(date).toBe(expectedDate);
    expect(typeof createdAt).toBe("number");
    expect(createdAt).toBeGreaterThanOrEqual(before);
    expect(createdAt).toBeLessThanOrEqual(after);
  });

  // ────────────────────────────────────────────────────────────────────
  // 6) demo upstream fetch-throws → no INSERT + 502 upstream-unreachable
  //    + upstream returns 5xx → status passthrough (INSERT still happens,
  //    per source comment: anti-spam).
  // ────────────────────────────────────────────────────────────────────
  it("demo (upstream network failure): fetch throws → 502 upstream-unreachable, no INSERT, X-AI-Mode:demo", async () => {
    const db = makeStubDb(0);
    fetchSpy.mockRejectedValueOnce(new Error("ECONNRESET"));

    const ctx = makeContext({
      env: { DB: db, AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "203.0.113.55" }),
    });

    const res = await onRequest(ctx);

    expect(res.status).toBe(502);
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Limit")).toBe("5");

    // Quota-check SELECT still happened, but no INSERT after a thrown fetch
    expect(db.calls).toHaveLength(1);
    expect(db.calls[0].sql).toMatch(/SELECT COUNT/i);

    const body = await res.json();
    expect(body.error).toBe("upstream-unreachable");
    expect(body.message).toContain("ECONNRESET");
  });

  it("demo (upstream 5xx): status passes through to client; INSERT still recorded (anti-spam design)", async () => {
    const db = makeStubDb(0);
    fetchSpy.mockResolvedValueOnce(upstream500());

    const ctx = makeContext({
      env: { DB: db, AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "203.0.113.56" }),
    });

    const res = await onRequest(ctx);

    expect(res.status).toBe(500); // passthrough
    expect(res.headers.get("X-AI-Mode")).toBe("demo");
    expect(res.headers.get("X-AI-Quota-Used")).toBe("1");

    // Documented behaviour: 5xx still counts toward the quota.
    // (If this assumption is wrong, the test will catch it; this is the
    // current behaviour of the source — see line ~226–238.)
    expect(db.calls).toHaveLength(2);
    expect(db.calls[1].sql).toMatch(/INSERT INTO ai_usage/i);
  });

  // ────────────────────────────────────────────────────────────────────
  // 7) X-AI-Mode header contract across all paths
  // ────────────────────────────────────────────────────────────────────
  //
  // Docstring contract:
  //   "Response headers (always present): X-AI-Mode: byok|demo ..."
  // The 503 (demo-unavailable) and 502 (upstream-unreachable)
  // early-return paths now both set X-AI-Mode (and X-AI-Quota-Limit
  // on the 503 path), matching the docstring. X-AI-Mode reflects the
  // active mode at the time of the early return (always 'demo' for
  // 503; either 'byok' or 'demo' for 502 depending on the request).
  it("X-AI-Mode header contract: present on every response, matching the docstring", async () => {
    // BYOK 200
    fetchSpy.mockResolvedValueOnce(upstreamOk());
    const byokCtx = makeContext({
      env: { DB: makeStubDb() },
      request: makeRequest({ headers: { "x-api-key": "sk-user-1" } }),
    });
    const r1 = await onRequest(byokCtx);
    expect(r1.headers.get("X-AI-Mode")).toBe("byok");

    // demo 200
    fetchSpy.mockResolvedValueOnce(upstreamOk());
    const demo200Ctx = makeContext({
      env: { DB: makeStubDb(0), AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "10.0.0.1" }),
    });
    const r2 = await onRequest(demo200Ctx);
    expect(r2.headers.get("X-AI-Mode")).toBe("demo");

    // demo 429 (over quota)
    const demo429Ctx = makeContext({
      env: { DB: makeStubDb(5), AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "10.0.0.2" }),
    });
    const r3 = await onRequest(demo429Ctx);
    expect(r3.headers.get("X-AI-Mode")).toBe("demo");

    // demo 503 (no AI_DEMO_KEY) — now sets X-AI-Mode + X-AI-Quota-Limit
    const demo503Ctx = makeContext({
      env: { DB: makeStubDb() /* no AI_DEMO_KEY */ },
      request: makeRequest({ ip: "10.0.0.3" }),
    });
    const r4 = await onRequest(demo503Ctx);
    expect(r4.headers.get("X-AI-Mode")).toBe("demo");
    expect(r4.headers.get("X-AI-Quota-Limit")).toBe("5");

    // demo 502 (fetch throws) — now sets X-AI-Mode (closed over `mode`)
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    const demo502Ctx = makeContext({
      env: { DB: makeStubDb(0), AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "10.0.0.4" }),
    });
    const r5 = await onRequest(demo502Ctx);
    expect(r5.headers.get("X-AI-Mode")).toBe("demo");
    expect(r5.headers.get("X-AI-Quota-Limit")).toBe("5");

    // demo upstream 500
    fetchSpy.mockResolvedValueOnce(upstream500());
    const demo5xxCtx = makeContext({
      env: { DB: makeStubDb(0), AI_DEMO_KEY: DEMO_KEY },
      request: makeRequest({ ip: "10.0.0.5" }),
    });
    const r6 = await onRequest(demo5xxCtx);
    expect(r6.headers.get("X-AI-Mode")).toBe("demo");
  });
});
