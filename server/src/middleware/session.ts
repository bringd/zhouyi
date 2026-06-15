import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import {
  getOrCreateGuestUser,
  touchUser,
  type GuestContext,
} from '../lib/guestUser.js'
import { getClientIp } from '../services/rateLimiter.js'

const SESSION_COOKIE_NAME = 'zhouyi_session'
const SESSION_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000 // 1 year

/**
 * Extract the passive observation signals from a request. Used both at
 * guest-user creation time and on every subsequent touch.
 */
function extractContext(req: Request): GuestContext {
  return {
    ipAddress: getClientIp(req),
    userAgent: String(req.headers['user-agent'] ?? ''),
    acceptLanguage: String(req.headers['accept-language'] ?? ''),
    referer: String(req.headers['referer'] ?? req.headers['referrer'] ?? ''),
  }
}

/**
 * Session middleware.
 *
 * Ensures every request is associated with a user (guest or, eventually,
 * a real account from Task B3):
 *
 * - Reads the `zhouyi_session` cookie.
 * - If absent: generates a fresh UUID, creates a guest user in the DB,
 *   and writes the cookie back to the client.
 * - If present: looks up (or re-creates) the guest user for that
 *   session id.
 * - Attaches `req.userId` and `req.sessionId` for downstream handlers.
 * - Captures passive request signals (UA, language, referer, IP) on
 *   creation and on every touch (debounced in touchUser).
 *
 * The cookie is `HttpOnly` + `SameSite=Lax`. In production behind HTTPS
 * the deployment proxy should add `Secure` (we don't set it here so
 * local dev over plain HTTP still works).
 */
export async function sessionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let sessionId: string | undefined = req.cookies?.[SESSION_COOKIE_NAME]
    let isNew = false

    if (!sessionId) {
      sessionId = randomUUID()
      isNew = true
    }

    const ctx = extractContext(req)
    const user = await getOrCreateGuestUser(sessionId, ctx)

    // Set the cookie on first encounter so subsequent requests carry it.
    if (isNew) {
      res.cookie(SESSION_COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: SESSION_COOKIE_MAX_AGE_MS,
        path: '/',
      })
    }

    req.userId = user.id
    req.sessionId = sessionId

    // Fire-and-forget touch — runs after the response is on the wire so
    // observation writes never add to request latency. Errors are
    // swallowed inside touchUser; we just don't await.
    void touchUser(user.id, ctx)

    next()
  } catch (err) {
    console.error('[session] error:', err)
    res.status(500).json({ error: 'SessionError' })
  }
}

// Type augmentation so `req.userId` / `req.sessionId` are recognised
// throughout the codebase.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string
      sessionId?: string
    }
  }
}
