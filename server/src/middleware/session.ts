import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'node:crypto'
import { getOrCreateGuestUser } from '../lib/guestUser.js'

const SESSION_COOKIE_NAME = 'zhouyi_session'
const SESSION_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000 // 1 year

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

    const user = await getOrCreateGuestUser(sessionId)

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
