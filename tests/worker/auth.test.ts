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
