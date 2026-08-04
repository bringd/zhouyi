import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { authRouter } from '../../worker/src/routes/auth'
import { sessionMiddleware } from '../../worker/src/middleware/session'
import { applyD1Migrations, runD1Query } from './helpers/d1'
import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { getDb } from '../../worker/src/db/client'
import { sessions as sessionsTable } from '../../worker/src/db/schema'

async function setupApp(): Promise<Hono> {
  await applyD1Migrations()
  const app = new Hono<{
    Bindings: { DB: D1Database }
    Variables: {
      userId: string
      sessionId: string
      mode: 'guest' | 'registered'
      remaining: number | null
    }
  }>()
  app.use('*', sessionMiddleware)
  app.route('/api/auth', authRouter)
  return app
}

describe('POST /api/auth/sms/send', () => {
  beforeEach(async () => {
    await applyD1Migrations()
    await runD1Query('DELETE FROM sessions')
    await runD1Query('DELETE FROM users')
  })

  it('rejects invalid phone format', async () => {
    const app = await setupApp()
    const res = await app.request(
      '/api/auth/sms/send',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '12345' }),
      },
      env
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('invalid_phone')
  })

  it('accepts valid 11-digit phone, returns 200 with ttl', async () => {
    const app = await setupApp()
    const res = await app.request(
      '/api/auth/sms/send',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '13800138000' }),
      },
      env
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ttl).toBe(300)
  })

  it('rate limits 60s resend', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const body = JSON.stringify({ phone: '13800138000' })

    const first = await app.request(
      '/api/auth/sms/send',
      { method: 'POST', headers, body },
      env
    )
    expect(first.status).toBe(200)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]

    // Reuse the same session cookie — the per-session rate limit
    // is keyed on the session id, not the phone.
    const second = await app.request(
      '/api/auth/sms/send',
      { method: 'POST', headers: { ...headers, cookie }, body },
      env
    )
    expect(second.status).toBe(429)
    const err = await second.json()
    expect(err.code).toBe('rate_limited')
  })

  it('writes 6-digit code to session, expires_at = now + 5min', async () => {
    const app = await setupApp()
    await app.request(
      '/api/auth/sms/send',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: '13800138000' }),
      },
      env
    )

    // Read via Drizzle so the timestamp column (mode: 'timestamp') is
    // converted back into a JS Date. runD1Query returns the raw
    // integer which on D1 is Unix seconds, not milliseconds.
    const db = getDb(env.DB as D1Database)
    const rows = await db
      .select({ smsCode: sessionsTable.smsCode, smsExpiresAt: sessionsTable.smsExpiresAt })
      .from(sessionsTable)
      .where(eq(sessionsTable.smsPhone, '13800138000'))
    expect(rows[0]?.smsCode).toMatch(/^\d{6}$/)
    expect(rows[0]?.smsExpiresAt).toBeInstanceOf(Date)
    expect((rows[0]?.smsExpiresAt as Date).getTime()).toBeGreaterThan(Date.now())
  })
})

describe('POST /api/auth/sms/verify', () => {
  beforeEach(async () => {
    await applyD1Migrations()
    await runD1Query('DELETE FROM sessions')
    await runD1Query('DELETE FROM users')
  })

  it('verifies correct code and upgrades user to registered', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const phone = '13800138000'
    const first = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone }) }, env)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    // The cookie value *is* the session id (sessions.refresh_token_hash).
    const sessionId = cookie.split('=')[1]
    const rows = await runD1Query<{ sms_code: string }>("SELECT sms_code FROM sessions WHERE sms_phone = '13800138000'")
    const code = rows[0]?.sms_code
    expect(code).toBeTruthy()
    const res = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ phone, code }) }, env)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe('registered')

    // The 'registered' string is a literal in the handler — assert the
    // actual DB mutation instead of trusting it.
    const userRows = await runD1Query<{ email: string; password_hash: string }>(
      `SELECT email, password_hash FROM users WHERE id = '${body.userId}'`
    )
    expect(userRows[0]?.email).toBe(phone)
    expect(userRows[0]?.password_hash).toBe('sms')

    const sessionRows = await runD1Query<{
      sms_code: string | null
      sms_expires_at: number | null
      sms_verify_attempts: number
      sms_locked_until: number | null
    }>(
      `SELECT sms_code, sms_expires_at, sms_verify_attempts, sms_locked_until FROM sessions WHERE refresh_token_hash = '${sessionId}'`
    )
    expect(sessionRows[0]?.sms_code).toBeNull()
    expect(sessionRows[0]?.sms_expires_at).toBeNull()
    expect(sessionRows[0]?.sms_verify_attempts).toBe(0)
    expect(sessionRows[0]?.sms_locked_until).toBeNull()
  })

  it('re-points a second session at the user that already owns the phone', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const phone = '13800138000'

    // Session A claims the phone.
    const sendA = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone }) }, env)
    const cookieA = sendA.headers.get('set-cookie')!.split(';')[0]
    const codeA = (await runD1Query<{ sms_code: string }>(`SELECT sms_code FROM sessions WHERE sms_phone = '${phone}'`))[0].sms_code
    const verifyA = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie: cookieA }, body: JSON.stringify({ phone, code: codeA }) }, env)
    expect(verifyA.status).toBe(200)
    const userIdA = (await verifyA.json()).userId

    // Session B (no cookie → fresh guest user) verifies the same phone.
    // `users.email` is UNIQUE, so the naive UPDATE would 500 here.
    const sendB = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone }) }, env)
    const cookieB = sendB.headers.get('set-cookie')!.split(';')[0]
    const sessionIdB = cookieB.split('=')[1]
    const codeB = (await runD1Query<{ sms_code: string }>(
      `SELECT sms_code FROM sessions WHERE refresh_token_hash = '${sessionIdB}'`
    ))[0].sms_code
    const verifyB = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie: cookieB }, body: JSON.stringify({ phone, code: codeB }) }, env)
    expect(verifyB.status).toBe(200)
    const bodyB = await verifyB.json()
    expect(bodyB.mode).toBe('registered')
    expect(bodyB.userId).toBe(userIdA)

    // Session B now points at user A.
    const sessionRows = await runD1Query<{ user_id: string }>(
      `SELECT user_id FROM sessions WHERE refresh_token_hash = '${sessionIdB}'`
    )
    expect(sessionRows[0]?.user_id).toBe(userIdA)
  })

  it('rejects wrong code with 401', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const first = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone: '13800138000' }) }, env)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const res = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ phone: '13800138000', code: '000000' }) }, env)
    expect(res.status).toBe(401)
  })

  it('rejects re-use of a code that already succeeded', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const phone = '13800138000'
    const first = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone }) }, env)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const code = (await runD1Query<{ sms_code: string }>(`SELECT sms_code FROM sessions WHERE sms_phone = '${phone}'`))[0].sms_code

    const ok = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ phone, code }) }, env)
    expect(ok.status).toBe(200)

    // Verify clears sms_code, so replaying the same code must fail.
    const replay = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ phone, code }) }, env)
    expect(replay.status).toBe(401)
    expect((await replay.json()).code).toBe('invalid_code')
  })

  it('rejects an expired code', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const phone = '13800138000'
    const first = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone }) }, env)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const code = (await runD1Query<{ sms_code: string }>(`SELECT sms_code FROM sessions WHERE sms_phone = '${phone}'`))[0].sms_code

    // Force expiry into the past (column is Unix seconds on D1).
    await runD1Query(`UPDATE sessions SET sms_expires_at = 1000 WHERE sms_phone = '${phone}'`)

    const res = await app.request('/api/auth/sms/verify', { method: 'POST', headers: { ...headers, cookie }, body: JSON.stringify({ phone, code }) }, env)
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('invalid_code')
  })

  it('locks after 5 wrong attempts', async () => {
    const app = await setupApp()
    const headers = { 'content-type': 'application/json' }
    const first = await app.request('/api/auth/sms/send', { method: 'POST', headers, body: JSON.stringify({ phone: '13800138000' }) }, env)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const wrong = { method: 'POST' as const, headers: { ...headers, cookie }, body: JSON.stringify({ phone: '13800138000', code: '000000' }) }

    // Attempts 1-4 must still report invalid_code — this pins the
    // threshold at 5 so an off-by-N lockout can't pass.
    for (let i = 0; i < 4; i++) {
      const res = await app.request('/api/auth/sms/verify', wrong, env)
      expect(res.status).toBe(401)
      expect((await res.json()).code).toBe('invalid_code')
    }

    // Attempt 5 flips to too_many_attempts.
    const fifth = await app.request('/api/auth/sms/verify', wrong, env)
    expect(fifth.status).toBe(401)
    expect((await fifth.json()).code).toBe('too_many_attempts')

    // And stays locked afterwards.
    const sixth = await app.request('/api/auth/sms/verify', wrong, env)
    expect(sixth.status).toBe(401)
    expect((await sixth.json()).code).toBe('too_many_attempts')
  })
})
