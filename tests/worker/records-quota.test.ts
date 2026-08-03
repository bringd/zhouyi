import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { recordsRouter } from '../../worker/src/routes/records'
import { sessionMiddleware } from '../../worker/src/middleware/session'
import { applyD1Migrations, runD1Query } from './helpers/d1'
import { Hono } from 'hono'

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
  app.route('/api/records', recordsRouter)
  return app
}

const validRecordBody = {
  type: 'three-number' as const,
  mainHexagramId: 1,
  movingLine: 1,
  changedHexagramId: 2,
}

describe('records: quota gate', () => {
  beforeEach(async () => {
    await applyD1Migrations()
    await runD1Query('DELETE FROM records')
    await runD1Query('DELETE FROM sessions')
    await runD1Query('DELETE FROM users')
  })

  it('guest 1st POST succeeds with 201 (remaining=1)', async () => {
    const app = await setupApp()
    const res = await app.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validRecordBody),
      },
      env
    )
    expect(res.status).toBe(201)
    // Cookie should be set on first request
    expect(res.headers.get('set-cookie')).toBeTruthy()
  })

  it('guest 2nd POST returns 402 quota_exceeded (remaining=0)', async () => {
    const app = await setupApp()
    // 1st request — creates session + record, succeeds
    const first = await app.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validRecordBody),
      },
      env
    )
    expect(first.status).toBe(201)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]

    // 2nd request — quota now 0, must be rejected
    const second = await app.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ ...validRecordBody, mainHexagramId: 3, changedHexagramId: 4 }),
      },
      env
    )
    expect(second.status).toBe(402)
    const body = await second.json()
    expect(body.code).toBe('quota_exceeded')
    expect(body.action).toBe('register_sms')
    expect(body.trigger).toBe('open_sms_modal')
    expect(typeof body.message).toBe('string')
  })

  it('registered user is not blocked by quota gate', async () => {
    const app = await setupApp()
    // 1st request — capture the userId, then promote to registered
    const first = await app.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(validRecordBody),
      },
      env
    )
    expect(first.status).toBe(201)
    const cookie = first.headers.get('set-cookie')!.split(';')[0]
    const firstBody = await first.json() as { id: string }

    // Read userId by inserting a probe record's row — easier: query users table
    // via the schema-canonical id we get back from insert. Records table has userId
    // but we need it from session row. Use a simple D1 query.
    const users = await runD1Query<{ id: string }>('SELECT id FROM users LIMIT 1')
    const userId = users[0]?.id
    expect(userId).toBeTruthy()

    await runD1Query(
      `UPDATE users SET email='13800138000' WHERE id='${userId}'`
    )

    // subsequent POST should NOT be blocked (remaining is null for registered)
    const second = await app.request(
      '/api/records',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ ...validRecordBody, mainHexagramId: 5, changedHexagramId: 6 }),
      },
      env
    )
    expect(second.status).toBe(201)
    // suppress unused-var warning
    void firstBody
  })
})
