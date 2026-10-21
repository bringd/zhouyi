import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listCloudRecords,
  saveCloudRecord,
  updateCloudRecordNote,
  deleteCloudRecord,
} from '@/lib/records'

interface MockResponseInit {
  ok?: boolean
  status?: number
  statusText?: string
  body?: unknown
}

function mockResponse({
  ok = true,
  status = ok ? 200 : 500,
  statusText = ok ? 'OK' : 'Internal Server Error',
  body = {},
}: MockResponseInit = {}): Response {
  return {
    ok,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response
}

function stubFetchOnce(res: Response) {
  const fetchMock = vi.fn().mockResolvedValueOnce(res)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('listCloudRecords', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests the paginated endpoint with credentials', async () => {
    const fetchMock = stubFetchOnce(mockResponse({ body: { records: [] } }))
    await listCloudRecords({ limit: 10, offset: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/records?limit=10&offset=5')
    expect(init.credentials).toBe('include')
  })

  it('normalises ISO timestamps to epoch ms and decodes numbers_json', async () => {
    stubFetchOnce(
      mockResponse({
        body: {
          records: [
            {
              id: 'r1',
              type: 'three-number',
              question: '此事可行否',
              numbersJson: '[123,456,789]',
              region: 'Asia/Shanghai',
              timezone: 'Asia/Shanghai',
              mainHexagramId: 1,
              movingLine: 2,
              changedHexagramId: 3,
              aiInterpretation: null,
              userNote: '备注',
              createdAt: '2026-10-20T01:00:00.000Z',
              updatedAt: '2026-10-20T02:00:00.000Z',
            },
          ],
        },
      }),
    )

    const [record] = await listCloudRecords()
    expect(record.createdAt).toBe(Date.parse('2026-10-20T01:00:00.000Z'))
    expect(record.updatedAt).toBe(Date.parse('2026-10-20T02:00:00.000Z'))
    expect(typeof record.createdAt).toBe('number')
    expect(record.numbers).toEqual([123, 456, 789])
    expect(record.userNote).toBe('备注')
    expect(record.question).toBe('此事可行否')
  })

  it('tolerates a corrupt numbers_json column (numbers → null)', async () => {
    stubFetchOnce(
      mockResponse({
        body: {
          records: [
            {
              id: 'r1',
              type: 'three-number',
              numbersJson: 'not-json{',
              mainHexagramId: 1,
              movingLine: 1,
              changedHexagramId: 2,
              createdAt: 1_700_000_000_000,
            },
          ],
        },
      }),
    )
    const [record] = await listCloudRecords()
    expect(record.numbers).toBeNull()
    expect(record.createdAt).toBe(1_700_000_000_000)
  })

  it('returns [] when the payload has no records array', async () => {
    stubFetchOnce(mockResponse({ body: {} }))
    expect(await listCloudRecords()).toEqual([])
  })

  it('upgrades legacy second-precision timestamps to ms', async () => {
    stubFetchOnce(
      mockResponse({
        body: {
          records: [
            {
              id: 'legacy',
              type: 'three-number',
              mainHexagramId: 1,
              movingLine: 1,
              changedHexagramId: 2,
              // Written by an older path as `Date.now() / 1000`.
              createdAt: 1_781_872_481,
              updatedAt: 1_781_872_481,
            },
          ],
        },
      }),
    )
    const [record] = await listCloudRecords()
    expect(record.createdAt).toBe(1_781_872_481_000)
    expect(record.updatedAt).toBe(1_781_872_481_000)
    expect(new Date(record.createdAt).getFullYear()).toBe(2026)
  })

  it('throws on a non-2xx response', async () => {
    stubFetchOnce(mockResponse({ ok: false, status: 500 }))
    await expect(listCloudRecords()).rejects.toThrow(/500/)
  })
})

describe('saveCloudRecord', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs the mapped payload (numbers as a plain array)', async () => {
    const fetchMock = stubFetchOnce(
      mockResponse({
        status: 201,
        body: { id: 'new-id', createdAt: '2026-10-20T03:00:00.000Z' },
      }),
    )

    const saved = await saveCloudRecord({
      type: 'three-number',
      question: '问事业',
      numbers: [111, 222, 333],
      region: 'Asia/Shanghai',
      timezone: 'Asia/Shanghai',
      mainHexagramId: 5,
      movingLine: 3,
      changedHexagramId: 9,
      aiInterpretation: '解读文本',
      userNote: '我的备注',
    })

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/records')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    const sent = JSON.parse(String(init.body)) as Record<string, unknown>
    expect(sent.numbers).toEqual([111, 222, 333])
    expect(sent.mainHexagramId).toBe(5)
    expect(sent.userNote).toBe('我的备注')

    expect(saved.id).toBe('new-id')
    expect(saved.createdAt).toBe(Date.parse('2026-10-20T03:00:00.000Z'))
  })

  it('throws on validation failure (400)', async () => {
    stubFetchOnce(mockResponse({ ok: false, status: 400, statusText: 'Bad Request' }))
    await expect(
      saveCloudRecord({
        type: 'three-number',
        mainHexagramId: 1,
        movingLine: 1,
        changedHexagramId: 2,
      }),
    ).rejects.toThrow(/400/)
  })
})

describe('updateCloudRecordNote', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PATCHes { userNote } and normalises the returned row', async () => {
    const fetchMock = stubFetchOnce(
      mockResponse({
        body: {
          id: 'r1',
          type: 'three-number',
          mainHexagramId: 1,
          movingLine: 1,
          changedHexagramId: 2,
          userNote: '新备注',
          createdAt: '2026-10-20T01:00:00.000Z',
          updatedAt: '2026-10-20T04:00:00.000Z',
        },
      }),
    )

    const updated = await updateCloudRecordNote('r1', '新备注')

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/records/r1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(String(init.body))).toEqual({ userNote: '新备注' })
    expect(updated.userNote).toBe('新备注')
    expect(updated.updatedAt).toBe(Date.parse('2026-10-20T04:00:00.000Z'))
  })

  it('throws on 404', async () => {
    stubFetchOnce(mockResponse({ ok: false, status: 404, statusText: 'Not Found' }))
    await expect(updateCloudRecordNote('missing', 'x')).rejects.toThrow(/404/)
  })
})

describe('deleteCloudRecord', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resolves on 204 without parsing a body', async () => {
    const json = vi.fn()
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json,
    } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteCloudRecord('r1')).resolves.toBeUndefined()
    expect(json).not.toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/records/r1')
    expect(init.method).toBe('DELETE')
  })

  it('throws when the delete fails', async () => {
    stubFetchOnce(mockResponse({ ok: false, status: 500 }))
    await expect(deleteCloudRecord('r1')).rejects.toThrow(/500/)
  })
})
