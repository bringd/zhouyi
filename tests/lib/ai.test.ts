import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInterpretation, AIError } from '@/lib/ai'
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

describe('ai: generateInterpretation (via backend)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws AIError with server-error on 503 (back-compat: apiKey arg ignored)', async () => {
    // The new behavior: the apiKey arg is ignored. The backend may return
    // 503 if Claude is not configured. The call is attempted regardless
    // of apiKey value.
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, '')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('server-error')
    }
  })

  it('calls backend with correct URL and JSON body', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n\n',
        'data: {"type":"done","usage":{"inputTokens":150,"outputTokens":350}}\n\n',
      ]),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await generateInterpretation(sampleInput, null, () => {})

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/ai/interpret',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          mainHexagramId: 1,
          changedHexagramId: 2,
          movingLine: 4,
          question: '近期是否适合换工作？',
        }),
      }),
    )
  })

  it('parses streaming SSE response and concatenates text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"提示"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"刚健"}}\n\n',
        'data: {"type":"done","usage":{"inputTokens":150,"outputTokens":350}}\n\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('乾卦提示刚健')
    expect(result.chunks).toEqual(['乾卦', '提示', '刚健'])
    expect(result.usage).toEqual({ inputTokens: 150, outputTokens: 350 })
  })

  it('calls onChunk for each streamed text delta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"卦"}}\n\n',
        'data: {"type":"done"}\n\n',
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
        controller.enqueue(encoder.encode('data: {"type":"done"}\n\n'))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('分片测试')
  })

  it('skips malformed SSE events gracefully', async () => {
    // Suppress the console.warn that the parser emits for malformed events.
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: not-json-at-all\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"好的"}}\n\n',
        'data: {"type":"done"}\n\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, null)
    expect(result.text).toBe('好的')
  })

  it('throws AIError with unauthorized on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('unauthorized')
    }
  })

  it('throws AIError with rate-limit on 429 (and surfaces backend message)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: async () => ({ error: 'RateLimitExceeded', message: '今日 AI 解读次数已用完' }),
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('rate-limit')
      expect((e as AIError).message).toBe('今日 AI 解读次数已用完')
    }
  })

  it('throws AIError with server-error on 5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('server-error')
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

  it('ignores the apiKey arg (back-compat with old signature)', async () => {
    const makeMockResp = () => ({
      ok: true,
      body: makeSSEStream(['data: {"type":"done"}\n\n']),
    })
    globalThis.fetch = vi.fn().mockImplementation(async () => makeMockResp()) as unknown as typeof fetch

    // All three of these should work the same way — apiKey is ignored.
    await expect(generateInterpretation(sampleInput, null)).resolves.toBeDefined()
    await expect(generateInterpretation(sampleInput, '')).resolves.toBeDefined()
    await expect(generateInterpretation(sampleInput, 'sk-some-key')).resolves.toBeDefined()
  })

  it('sends credentials: include (session cookie)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: {"type":"done"}\n\n']),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await generateInterpretation(sampleInput, null)

    const init = mockFetch.mock.calls[0]?.[1] as RequestInit
    expect(init.credentials).toBe('include')
  })

  it('throws AIError on backend error event in stream', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"error","error":"Claude upstream failed"}\n\n',
      ]),
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, null)
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('server-error')
      expect((e as AIError).message).toBe('Claude upstream failed')
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
