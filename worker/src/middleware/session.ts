import type { MiddlewareHandler } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { getDb } from '../db/client'
import { users, sessions, records } from '../db/schema'
import { eq, sql } from 'drizzle-orm'

/**
 * Session cookie middleware.
 *
 * Mirrors the Express server's behaviour on Workers: every visitor
 * gets a guest user row keyed off a session UUID stored in an
 * `HttpOnly` cookie. On Workers we use D1 (SQLite) for the upsert
 * instead of Postgres.
 *
 * - Reads `zhouyi_session` cookie.
 * - If absent: mints a new UUID, inserts a guest user + session row,
 *   writes the cookie.
 * - If present: looks up (or re-creates) the guest user.
 * - Sets `req.userId` and `req.sessionId` on the Hono context.
 *
 * The cookie is `HttpOnly` + `SameSite=Lax`. In production behind
 * HTTPS the deployment proxy should add `Secure` (we don't set it
 * here so local dev over plain HTTP still works).
 */

const COOKIE_NAME = 'zhouyi_session'
const COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60 // 1 year

export type SessionEnv = {
  Bindings: {
    DB: D1Database
  }
  Variables: {
    userId: string
    sessionId: string
    mode: 'guest' | 'registered'
    remaining: number | null
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    userId: string
    sessionId: string
    mode: 'guest' | 'registered'
    remaining: number | null
  }
}

function randomId(): string {
  // Workers' crypto.subtle isn't synchronous; use crypto.getRandomValues
  // and format as a v4 UUID ourselves. Sufficient for a session id.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // RFC 4122 v4
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const sessionMiddleware: MiddlewareHandler<SessionEnv> = async (c, next) => {
  const db = getDb(c.env.DB)
  let sessionId = getCookie(c, COOKIE_NAME)
  let isNew = false

  if (!sessionId) {
    sessionId = randomId()
    isNew = true
  }

  // Look up existing session row
  const existing = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, sessionId))
    .limit(1)

  let userId: string

  if (existing[0]) {
    userId = existing[0].userId
  } else {
    // Mint a new guest user (synthetic email; placeholder password)
    const newId = randomId()
    const now = new Date()
    await db.insert(users).values({
      id: newId,
      email: `guest-${sessionId}@zhouyi.local`,
      passwordHash: '!',
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert(sessions).values({
      id: randomId(),
      userId: newId,
      refreshTokenHash: sessionId,
      expiresAt: new Date(Date.now() + COOKIE_MAX_AGE_S * 1000),
      createdAt: now,
    })
    userId = newId
  }

  // Refresh passive observation fields on every request.
  // Skip on /health so the probe doesn't write.
  if (!c.req.path.startsWith('/health')) {
    const userAgent = c.req.header('user-agent') ?? ''
    const acceptLanguage = c.req.header('accept-language') ?? ''
    const referer = c.req.header('referer') ?? c.req.header('referrer') ?? ''
    const ipAddress = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? ''
    try {
      await db
        .update(users)
        .set({
          lastSeenAt: new Date(),
          visitCount: sql`${users.visitCount} + 1`,
          userAgent,
          acceptLanguage,
          lastReferer: referer || null,
          ipAddress,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))
    } catch (err) {
      console.error('[session] touch failed:', err)
    }
  }

  if (isNew) {
    setCookie(c, COOKIE_NAME, sessionId, {
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: COOKIE_MAX_AGE_S,
      path: '/',
    })
  }

  c.set('userId', userId)
  c.set('sessionId', sessionId)

  const userRow = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const email = userRow[0]?.email ?? ''
  const mode: 'guest' | 'registered' = /^guest-.*@zhouyi\.local$/.test(email)
    ? 'guest'
    : 'registered'

  let remaining: number | null = null
  if (mode === 'guest') {
    const count = await db
      .select({ n: sql<number>`count(*)` })
      .from(records)
      .where(eq(records.userId, userId))
    remaining = Math.max(0, 1 - Number(count[0]?.n ?? 0))
  }

  c.set('mode', mode)
  c.set('remaining', remaining)
  await next()
}
