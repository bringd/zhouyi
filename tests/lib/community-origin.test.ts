import { afterEach, expect, it, vi } from 'vitest'
import { listFeed } from '@/lib/feed'
import { listCloudRecords } from '@/lib/records'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('keeps production records and feed on the Pages origin with credentials', async () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('VITE_FEED_API_BASE', '')
  const fetch = vi.fn().mockImplementation(async () => Response.json({ records: [], posts: [] }))
  vi.stubGlobal('fetch', fetch)
  await listCloudRecords()
  await listFeed()
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    '/api/records?limit=50&offset=0',
    '/api/feed?limit=20&offset=0',
  ])
  for (const [, init] of fetch.mock.calls) expect(init.credentials).toBe('include')
})

it('retains the explicit staging API override for both clients', async () => {
  vi.stubEnv('VITE_FEED_API_BASE', 'https://staging.example')
  const fetch = vi.fn().mockImplementation(async () => Response.json({ records: [], posts: [] }))
  vi.stubGlobal('fetch', fetch)
  await listCloudRecords()
  await listFeed()
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([
    'https://staging.example/api/records?limit=50&offset=0',
    'https://staging.example/api/feed?limit=20&offset=0',
  ])
})
