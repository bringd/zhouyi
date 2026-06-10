import { db } from '../db/client.js'
import { users, sessions } from '../db/schema.js'
import { eq } from 'drizzle-orm'

/**
 * Get or create a guest user for the given session ID.
 *
 * - First call: creates a new user + session row, returns the new user id
 * - Subsequent calls: looks up the existing user via the session row
 *
 * Guest users have no real email/password — they are identified solely by
 * their session cookie. The session id is stored in
 * `sessions.refreshTokenHash` (reused field — see note below).
 *
 * NOTE: We reuse `sessions.refreshTokenHash` to store the raw session id
 * for MVP. When Task B3 (real auth) lands, this column can be repurposed
 * to actually hold a hashed refresh token, and guest users can be
 * migrated to real accounts (or a dedicated `session_id` column added).
 */
export async function getOrCreateGuestUser(
  sessionId: string
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

  // 2. No session — create a new guest user
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
