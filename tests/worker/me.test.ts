import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { meRouter } from "../../worker/src/routes/me";
import { sessionMiddleware } from "../../worker/src/middleware/session";
import { applyD1Migrations, runD1Query } from "./helpers/d1";
import { Hono } from "hono";

async function setupApp(): Promise<Hono> {
  await applyD1Migrations();
  const app = new Hono<{
    Bindings: { DB: D1Database };
    Variables: {
      userId: string;
      sessionId: string;
      mode: "guest" | "registered";
    };
  }>();
  app.use("*", sessionMiddleware);
  app.route("/api/auth", meRouter);
  return app;
}

describe("GET /api/auth/me", () => {
  beforeEach(async () => {
    await applyD1Migrations();
    await runD1Query("DELETE FROM sessions");
    await runD1Query("DELETE FROM users");
  });

  it("returns guest mode for new visitor", async () => {
    const app = await setupApp();
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mode).toBe("guest");
    expect(body.userId).toBeTruthy();
    // No `remaining` field anymore (Phase 2 lifted the per-user quota)
    expect(body.remaining).toBeUndefined();
  });

  it("returns registered mode for upgraded user (email = phone number)", async () => {
    const app = await setupApp();
    const first = await app.request("/api/auth/me", {}, env);
    const setCookie = first.headers.get("set-cookie") ?? "";
    const userId = (await first.json()).userId;

    await runD1Query(
      `UPDATE users SET email='13800138000' WHERE id='${userId}'`,
    );

    const second = await app.request(
      "/api/auth/me",
      {
        headers: { cookie: setCookie.split(";")[0] },
      },
      env,
    );
    const body = await second.json();
    expect(body.mode).toBe("registered");
    expect(body.remaining).toBeUndefined();
  });
});
