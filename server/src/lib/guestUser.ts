import { db } from '../db/client.js'
import { users, sessions } from '../db/schema.js'
import { eq, sql } from 'drizzle-orm'

/**
 * Per-request observation signals we want to attach to a user. Captured
 * passively — no auth, no PII beyond what the browser sends in headers.
 */
export interface GuestContext {
  /** Client IP, resolved through proxy headers (X-Forwarded-For aware). */
  ipAddress: string
  /** User-Agent header (browser, version, OS hints). */
  userAgent: string
  /** Accept-Language header (raw, e.g. "zh-CN,zh;q=0.9,en;q=0.8"). */
  acceptLanguage: string
  /** Referer header (page they came from), or '' if absent. */
  referer: string
}

/**
 * Get or create a guest user for the given session ID, writing the
 * passive observation signals on creation.
 *
 * - First call: creates a new user + session row, returns the new user id
 * - Subsequent calls: looks up the existing user via the session row
 *
 * Guest users have no real email/password — they are identified solely by
 * their session cookie. The session id is stored in
 * `sessions.refreshTokenHash` (reused field — see note below).
 *
 * NOTE: We reuse `sessions.refreshTokenHash` to store the raw session id
 * for MVP. When real auth lands, this column can be repurposed to actually
 * hold a hashed refresh token, and guest users can be migrated to real
 * accounts (or a dedicated `session_id` column added).
 */
export async function getOrCreateGuestUser(
  sessionId: string,
  ctx: GuestContext
): Promise<{ id: string; createdNew: boolean }> {
  // 1. Check if a session row already exists for this sessionId
  const existingSession = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, sessionId))
    .limit(1)

  if (existingSession[0]) {
    return { id: existingSession[0].userId, createdNew: false }
  }

  // 2. No session — create a new guest user with observation signals
  const [newUser] = await db
    .insert(users)
    .values({
      // Synthetic email that cannot collide with real signups (the
      // `@zhouyi.local` TLD is reserved for guests). Using the session
      // id makes it unique per-session.
      email: `guest-${sessionId}@zhouyi.local`,
      // Placeholder hash — guest users cannot log in via password.
      passwordHash: '!',
      nickname: '访客',
      // Observation signals — written once on creation. touchUser() can
      // refresh ip/lastReferer later; userAgent/language are sticky.
      userAgent: ctx.userAgent,
      acceptLanguage: ctx.acceptLanguage,
      firstReferer: ctx.referer || null,
      lastReferer: ctx.referer || null,
      ipAddress: ctx.ipAddress,
    })
    .returning({ id: users.id })

  if (!newUser) {
    throw new Error('Failed to create guest user')
  }

  // 3. Persist the session row so the next request can find this user
  await db.insert(sessions).values({
    userId: newUser.id,
    refreshTokenHash: sessionId,
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  })

  return { id: newUser.id, createdNew: true }
}

/**
 * Touch a user row to record a fresh visit. Bumps last_seen_at, increments
 * visit_count, and refreshes IP / lastReferer. Skips a no-op write if the
 * row was touched less than 60s ago — this keeps the per-request write
 * cost bounded under bursty traffic without losing "today" granularity.
 *
 * Callers should `await` or `.catch(console.error)` — touch failures
 * must NEVER break the request path.
 */
const TOUCH_DEBOUNCE_MS = 60_000

export async function touchUser(
  userId: string,
  ctx: GuestContext
): Promise<void> {
  try {
    await db.execute(
      sql`
        UPDATE users
        SET
          last_seen_at = now(),
          visit_count = visit_count + 1,
          ip_address = ${ctx.ipAddress},
          last_referer = ${ctx.referer || null},
          updated_at = now()
        WHERE
          id = ${userId}::uuid
          AND (
            last_seen_at IS NULL
            OR last_seen_at < now() - interval '${sql.raw(String(TOUCH_DEBOUNCE_MS))} milliseconds'
          )
      `
    )
  } catch (err) {
    // Observation-only — log and move on. The user is identified by their
    // session cookie regardless of whether this write lands.
    console.error('[touchUser] failed:', err)
  }
}
