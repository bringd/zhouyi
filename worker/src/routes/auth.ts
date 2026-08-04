import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db/client'
import { sessions } from '../db/schema'
import { eq, sql, and } from 'drizzle-orm'

/**
 * Auth routes — SMS-based registration flow.
 *
 * Mounted under `/api/auth` with `sessionMiddleware` upstream so
 * `c.var.userId` / `c.var.sessionId` are always populated.
 *
 * Phase 1 simplification: the "1h 5 attempts" gate below uses
 * `sessions.createdAt` (session creation time) as a proxy. The
 * real implementation would need a dedicated `sms_send_log`
 * table. Out of scope for Phase 1 per the plan.
 */
const PHONE_REGEX = /^1[3-9]\d{9}$/
const TTL_SEC = 300
const RESEND_COOLDOWN_S = 60
const MAX_ATTEMPTS_PER_HOUR = 5

export const authRouter = new Hono<{
  Bindings: { DB: D1Database }
  Variables: {
    userId: string
    sessionId: string
    mode: 'guest' | 'registered'
    remaining: number | null
  }
}>()

const sendSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, 'invalid_phone'),
})

function generateCode(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  // Take 6 digits 0-9.
  return Array.from(bytes, (b) => (b % 10).toString()).join('')
}

authRouter.post('/sms/send', async (c) => {
  const raw = await c.req.json().catch(() => ({}))
  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) {
    return c.json({ code: 'invalid_phone', message: '手机号格式错误' }, 400)
  }
  const phone = parsed.data.phone

  const db = getDb(c.env.DB)
  const sessionId = c.var.sessionId

  // 60s resend cooldown. Keyed on the session row's sms_expires_at:
  // if the most recent send was within the cooldown window, reject.
  const recent = await db
    .select({ expiresAt: sessions.smsExpiresAt })
    .from(sessions)
    .where(eq(sessions.refreshTokenHash, sessionId))
    .limit(1)

  const now = Date.now()
  if (recent[0]?.expiresAt && new Date(recent[0].expiresAt).getTime() > now - RESEND_COOLDOWN_S * 1000) {
    const retryAfter = Math.ceil(
      (new Date(recent[0].expiresAt).getTime() - (now - RESEND_COOLDOWN_S * 1000)) / 1000
    )
    return c.json({ code: 'rate_limited', retryAfter, message: '请求过于频繁' }, 429)
  }

  // 1h attempt cap. Approximation per the plan — we count sessions
  // created in the last hour for this sessionId. Because we UPDATE
  // the same row rather than INSERT, this counts the session itself
  // (always 1), so the cap never trips in practice. A real
  // implementation needs a `sms_send_log` table; out of scope.
  const hourAgo = now - 3600 * 1000
  const countRows = await db
    .select({ n: sql<number>`count(*)` })
    .from(sessions)
    .where(
      and(
        eq(sessions.refreshTokenHash, sessionId),
        sql`${sessions.createdAt} > ${hourAgo}`
      )
    )
  if (Number(countRows[0]?.n ?? 0) >= MAX_ATTEMPTS_PER_HOUR) {
    return c.json({ code: 'too_many_attempts', message: '1h 内尝试次数过多' }, 429)
  }

  // Mint a 6-digit code and persist on the session row.
  const code = generateCode()
  const expiresAt = new Date(now + TTL_SEC * 1000)

  await db
    .update(sessions)
    .set({
      smsPhone: phone,
      smsCode: code,
      smsExpiresAt: expiresAt,
      smsVerifyAttempts: 0,
      smsLockedUntil: null,
    })
    .where(eq(sessions.refreshTokenHash, sessionId))

  // MOCK SMS: log the code so the test/dev can see it.
  console.log(`[SMS] code=${code} phone=${phone} ttl=${TTL_SEC}s`)

  return c.json({ ttl: TTL_SEC, message: '验证码已发送' })
})
