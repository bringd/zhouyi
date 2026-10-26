import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequest } from '../../functions/_middleware'

afterEach(() => vi.restoreAllMocks())

const context = (path = '/api/records', init: RequestInit = {}) => ({
  request: new Request('https://orix-studio.pages.dev' + path, init),
  env: {},
  next: vi.fn(async () => new Response('next')),
})

describe('same-origin community proxy', () => {
  it.each([
    '/api/proxy/anthropic/v1/messages',
    '/assets/app.js',
    '/api/records-unrelated',
  ])('leaves %s to the existing handler', async (path) => {
    const c = context(path)
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(await (await onRequest(c)).text()).toBe('next')
    expect(c.next).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('keeps the guest identity across save and list with a host-only secure session', async () => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response('{"id":"saved"}', {
          status: 201,
          headers: {
            'set-cookie':
              'zhouyi_session=guest-session; Domain=zhouyi-worker.bringd.workers.dev; Path=/; HttpOnly; SameSite=Lax',
            'access-control-allow-origin': '*',
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ records: [{ id: 'saved' }] }))
    const saved = await onRequest(
      context('/api/records', {
        method: 'POST',
        headers: {
          origin: 'https://orix-studio.pages.dev',
          'content-type': 'application/json',
        },
        body: '{}',
      }),
    )
    expect(saved.status).toBe(201)
    expect(saved.headers.get('set-cookie')).toBe(
      'zhouyi_session=guest-session; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
    expect(saved.headers.get('access-control-allow-origin')).toBeNull()
    expect(saved.headers.get('cache-control')).toBe('no-store')
    const listed = await onRequest(
      context('/api/records?limit=10', {
        headers: { cookie: 'other=private; zhouyi_session=guest-session' },
      }),
    )
    const [url, init] = fetch.mock.calls[1]
    expect(String(url)).toBe(
      'https://zhouyi-worker.bringd.workers.dev/api/records?limit=10',
    )
    expect(new Headers(init?.headers).get('cookie')).toBe(
      'zhouyi_session=guest-session',
    )
    expect(await listed.json()).toEqual({ records: [{ id: 'saved' }] })
  })

  it.each([
    '/api/records/id',
    '/api/feed/id/replies',
    '/api/auth/me',
    '/api/favorites',
  ])('preserves the route %s', async (path) => {
    const fetch = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ ok: true }))
    await onRequest(context(path))
    expect(String(fetch.mock.calls[0][0])).toBe(
      'https://zhouyi-worker.bringd.workers.dev' + path,
    )
  })

  it('rejects a cross-site write before forwarding a session', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch')
    expect(
      (
        await onRequest(
          context('/api/feed', {
            method: 'POST',
            headers: { origin: 'https://unrelated.example' },
            body: '{}',
          }),
        )
      ).status,
    ).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns a recoverable failure when the Worker cannot be reached', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    expect((await onRequest(context())).status).toBe(502)
  })
})
