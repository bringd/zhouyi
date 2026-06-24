import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInterpretation, AIError, isApiKeyConfigured } from '@/lib/ai'
import {
  getApiConfig,
  setApiConfig,
  clearApiConfig,
  getApiKey,
  API_CONFIG_DEFAULTS,
} from '@/lib/apiConfig'
import type { AIInterpretationInput } from '@/lib/ai'
import type { Hexagram, HexagramId } from '@/types'

// Helper: build a minimal valid hexagram fixture (all fields typed).
function makeHexagram(id: HexagramId, name: string, judgement: string): Hexagram {
  const yaoLines: Hexagram['yaoLines'] = [
    { position: 1, type: 'yang', originalText: '初九：潜龙勿用。', explanation: '龙潜勿用。', modernMeaning: '起步阶段。' },
    { position: 2, type: 'yang', originalText: '九二：见龙在田。', explanation: '见龙在田。', modernMeaning: '展现才华。' },
    { position: 3, type: 'yang', originalText: '九三：君子终日乾乾。', explanation: '日夜勤勉。', modernMeaning: '努力精进。' },
    { position: 4, type: 'yang', originalText: '九四：或跃在渊。', explanation: '审时度势。', modernMeaning: '重要抉择。' },
    { position: 5, type: 'yang', originalText: '九五：飞龙在天。', explanation: '大展宏图。', modernMeaning: '事业巅峰。' },
    { position: 6, type: 'yang', originalText: '上九：亢龙有悔。', explanation: '盛极而衰。', modernMeaning: '知进退。' },
  ]
  return {
    id,
    number: id,
    name,
    shortName: name.slice(0, 1),
    upperTrigramId: 1,
    lowerTrigramId: 1,
    binaryCode: '111111',
    palace: 1,
    palaceRole: '本宫卦',
    theme: ['人生总论'],
    keywords: ['创造', '刚健'],
    judgement,
    tuanzhuan: '大哉乾元。',
    xiangzhuan: {
      daXiang: '天行健。',
      xiaoXiang: ['', '', '', '', '', ''],
    },
    yaoLines,
    modernInterpretation: '乾为天，刚健之象。',
    relations: { opposite: 2, inverse: 1, nuclear: 1 },
  }
}

const mockMain: Hexagram = makeHexagram(1, '乾为天', '元，亨，利，贞。')
const mockChanged: Hexagram = makeHexagram(2, '坤为地', '元，亨，利牝马之贞。')

const sampleInput: AIInterpretationInput = {
  mainHexagram: mockMain,
  changedHexagram: mockChanged,
  movingLine: 4,
  question: '近期是否适合换工作？',
}

const TEST_KEY = 'sk-ant-test-key-12345'
const TEST_BASE_URL = 'https://api.minimaxi.com/anthropic/v1/messages'
const TEST_MODEL = 'minimax-m3'

describe('ai: generateInterpretation (BYOK browser-direct)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    localStorage.clear()
    // Most tests need a key configured.
    setApiConfig({ apiKey: TEST_KEY, baseUrl: TEST_BASE_URL, model: TEST_MODEL })
  })

  it('throws AIError with no-api-key when no key is stored', async () => {
    clearApiConfig()
    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('no-api-key')
    }
  })

  it('isApiKeyConfigured mirrors localStorage state', () => {
    expect(isApiKeyConfigured()).toBe(true)
    clearApiConfig()
    expect(isApiKeyConfigured()).toBe(false)
    setApiConfig({ apiKey: TEST_KEY })
    expect(isApiKeyConfigured()).toBe(true)
  })

  it('calls Anthropic API with correct URL, headers, and body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await generateInterpretation(sampleInput, null, () => {})

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(TEST_BASE_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-api-key': TEST_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      Accept: 'text/event-stream',
    })
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe(TEST_MODEL)
    expect(body.max_tokens).toBe(1024)
    expect(body.stream).toBe(true)
    expect(body.system).toContain('乾为天')
    expect(body.system).toContain('坤为地')
    expect(body.system).toContain('近期是否适合换工作？')
    expect(body.messages).toEqual([{ role: 'user', content: '请按上述要求输出解读。' }])
  })

  it('does NOT use credentials: include (Anthropic uses x-api-key header, not cookies)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"type":"message_stop"}\n\n']),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await generateInterpretation(sampleInput, null)

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit
    expect(init.credentials).toBeUndefined()
  })

  it('parses streaming SSE response and concatenates text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"message_start","message":{"usage":{"input_tokens":10,"output_tokens":0}}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"提示"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"刚健"}}\n\n',
        'data: {"type":"message_delta","usage":{"input_tokens":10,"output_tokens":15}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('乾卦提示刚健')
    expect(result.chunks).toEqual(['乾卦', '提示', '刚健'])
    expect(result.usage).toEqual({ inputTokens: 10, outputTokens: 15 })
  })

  it('calls onChunk for each streamed text delta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"卦"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    }) as unknown as typeof fetch

    const chunks: string[] = []
    await generateInterpretation(sampleInput, null, (c) => chunks.push(c))
    expect(chunks).toEqual(['乾', '卦'])
  })

  it('parses split SSE events (chunk boundary mid-event)', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split the first event across multiple TCP chunks.
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":'))
        controller.enqueue(encoder.encode('{"type":"text_delta","text":"分片"}}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"测试"}}\n\n'))
        controller.enqueue(encoder.encode('data: {"type":"message_stop"}\n\n'))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('分片测试')
  })

  it('skips malformed SSE events gracefully', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: not-json-at-all\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"好的"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('好的')
  })

  it('throws AIError with unauthorized on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('unauthorized')
    }
  })

  it('throws AIError with unauthorized on 403', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as AIError).code).toBe('unauthorized')
    }
  })

  it('throws AIError with rate-limit on 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'rate limited' } }),
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as AIError).code).toBe('rate-limit')
      expect((e as AIError).message).toBe('rate limited')
    }
  })

  it('throws AIError with server-error on 5xx (500/529)', async () => {
    for (const status of [500, 502, 529]) {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status }) as unknown as typeof fetch
      try {
        await generateInterpretation(sampleInput, null)
        expect.fail(`should have thrown for ${status}`)
      } catch (e) {
        expect((e as AIError).code).toBe('server-error')
      }
    }
  })

  it('throws AIError with network-error on 4xx other than 401/403/429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 418,
    }) as unknown as typeof fetch
    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as AIError).code).toBe('network-error')
    }
  })

  it('throws AIError with network-error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('network-error')
    }
  })

  it('throws AIError with timeout when the request takes > 60s', async () => {
    // Use fake timers so the 60s AbortController fires immediately in
    // the test, without us actually waiting 60 seconds.
    vi.useFakeTimers()
    try {
      // Fetch that hangs forever until the AbortController fires.
      globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
        return new Promise((_resolve, reject) => {
          const signal = (init as RequestInit).signal as AbortSignal | undefined
          if (signal) {
            signal.addEventListener('abort', () => {
              const err = new Error('aborted')
              err.name = 'AbortError'
              reject(err)
            })
          }
        })
      }) as unknown as typeof fetch

      // Attach a catch handler BEFORE advancing timers so the rejection
      // is never unhandled (vitest reports false-positive unhandled
      // rejections otherwise).
      const promise = generateInterpretation(sampleInput, null).catch(
        (e: unknown) => e
      )
      await vi.advanceTimersByTimeAsync(61_000)
      const result = await promise
      expect(result).toBeInstanceOf(AIError)
      expect((result as AIError).code).toBe('timeout')
    } finally {
      vi.useRealTimers()
    }
  })

  it('ignores the apiKey arg (back-compat: still read from localStorage)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"type":"message_stop"}\n\n']),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    // All three should work the same way — the localStorage key is what
    // counts; the second arg is ignored.
    await expect(generateInterpretation(sampleInput, null)).resolves.toBeDefined()
    await expect(generateInterpretation(sampleInput, '')).resolves.toBeDefined()
    await expect(generateInterpretation(sampleInput, 'sk-some-other-key')).resolves.toBeDefined()

    // All three should have used the TEST_KEY from localStorage, not the arg.
    for (const call of mockFetch.mock.calls) {
      const init = call[1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers['x-api-key']).toBe(TEST_KEY)
    }
  })

  it('maps Anthropic SSE error event to AIError with mapped code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"部分"}}\n\n',
        'data: {"type":"error","error":{"type":"rate_limit_error","message":"上限"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('rate-limit')
      expect((e as AIError).message).toBe('上限')
    }
  })

  it('maps invalid_request_error to upstream-error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"error","error":{"type":"invalid_request_error","message":"bad"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]),
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect((e as AIError).code).toBe('upstream-error')
    }
  })
})

/**
 * Helper: create a ReadableStream that yields SSE-formatted byte chunks.
 */
function makeSSEStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line))
      }
      controller.close()
    },
  })
}

// Sanity check on the helper module
describe('apiConfig', () => {
  beforeEach(() => localStorage.clear())

  it('returns sensible defaults when nothing is stored', () => {
    const cfg = getApiConfig()
    expect(cfg.baseUrl).toBe(API_CONFIG_DEFAULTS.baseUrl)
    expect(cfg.model).toBe(API_CONFIG_DEFAULTS.model)
    expect(cfg.apiKey).toBe('')
  })

  it('round-trips a full config through localStorage', () => {
    setApiConfig({
      baseUrl: 'https://example.com/v1/messages',
      apiKey: 'sk-ant-foo',
      model: 'foo-model',
    })
    const cfg = getApiConfig()
    expect(cfg.baseUrl).toBe('https://example.com/v1/messages')
    expect(cfg.apiKey).toBe('sk-ant-foo')
    expect(cfg.model).toBe('foo-model')
    clearApiConfig()
    expect(getApiKey()).toBeNull()
  })

  it('trims whitespace from each field', () => {
    setApiConfig({ apiKey: '  sk-ant-bar  \n' })
    expect(getApiKey()).toBe('sk-ant-bar')
  })

  it('preserves unspecified fields when patching', () => {
    setApiConfig({ apiKey: 'sk-ant-foo', model: 'm1' })
    setApiConfig({ model: 'm2' })
    const cfg = getApiConfig()
    expect(cfg.apiKey).toBe('sk-ant-foo')
    expect(cfg.model).toBe('m2')
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('zhouyi:api-config:v1', '{not-json')
    // Falls back to defaults rather than throwing.
    expect(getApiConfig().apiKey).toBe('')
  })
})
