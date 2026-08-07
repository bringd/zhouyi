import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { sessionMiddleware } from "../../worker/src/middleware/session";
import { applyD1Migrations, runD1Query } from "./helpers/d1";
import { Hono } from "hono";

async function setupApp(): Promise<Hono> {
  await applyD1Migrations();
  const app = new Hono<{
    Bindings: { DB: D1Database };
    Variables: { userId: string; sessionId: string; mode: string };
  }>();
  app.use("*", sessionMiddleware);
  app.get("/test", (c) =>
    c.json({
      userId: c.var.userId,
      mode: c.var.mode,
    }),
  );
  return app;
}

describe("sessionMiddleware: mode derivation", () => {
  beforeEach(async () => {
    await applyD1Migrations();
    await runD1Query("DELETE FROM sessions");
    await runD1Query("DELETE FROM users");
  });

  it("new visitor = mode:guest", async () => {
    const app = await setupApp();
    const res = await app.request("/test", {}, env);
    const body = await res.json();
    expect(body.mode).toBe("guest");
  });

  it("upgraded user email ends in 11-digit = mode:registered", async () => {
    const app = await setupApp();
    const first = await app.request("/test", {}, env);
    const cookie = first.headers.get("set-cookie")!;
    const userId = (await first.json()).userId;

    await runD1Query(
      `UPDATE users SET email='13800138000' WHERE id='${userId}'`,
    );

    const second = await app.request(
      "/test",
      { headers: { cookie: cookie.split(";")[0] } },
      env,
    );
    const body = await second.json();
    expect(body.mode).toBe("registered");
  });
});
