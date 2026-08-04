import { Hono } from 'hono'
import type { SessionEnv } from '../middleware/session'

/**
 * `/api/auth/me` — current session introspection.
 *
 * Mounted under `/api/auth` with `sessionMiddleware` upstream so
 * `c.var.userId` / `c.var.mode` / `c.var.remaining` are always
 * populated. The frontend uses this to render the
 * "guest / registered" badge and the remaining-quota banner.
 */
export const meRouter = new Hono<SessionEnv>()

meRouter.get('/me', (c) => {
  return c.json({
    userId: c.var.userId,
    mode: c.var.mode,
    remaining: c.var.remaining,
  })
})
