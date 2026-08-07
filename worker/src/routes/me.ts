import { Hono } from "hono";
import type { SessionEnv } from "../middleware/session";

/**
 * `/api/auth/me` — current session introspection.
 *
 * Mounted under `/api/auth` with `sessionMiddleware` upstream so
 * `c.var.userId` / `c.var.mode` are always populated. The frontend
 * uses this to render the "guest / registered" badge.
 *
 * The `remaining` field was removed in Phase 2 (single-user quota
 * was lifted). The auth contract on the frontend is intentionally
 * left compatible by leaving any other callers unchanged.
 */
export const meRouter = new Hono<SessionEnv>();

meRouter.get("/me", (c) => {
  return c.json({
    userId: c.var.userId,
    mode: c.var.mode,
  });
});
