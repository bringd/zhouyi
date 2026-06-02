import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateInterpretation, AIError } from '@/lib/ai'
import type { AIInterpretationInput } from '@/lib/ai'
import type { Hexagram, HexagramId } from '@/types'

// Helper: build a minimal valid hexagram fixture (all 64 fields typed).
// `id` lets us reuse the factory for both main and changed.
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

describe('ai: generateInterpretation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('throws AIError with missing-api-key when apiKey is empty', async () => {
    await expect(generateInterpretation(sampleInput, '')).rejects.toThrow(AIError)
    try {
      await generateInterpretation(sampleInput, '')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('missing-api-key')
    }
  })

  it('throws AIError with missing-api-key when apiKey is whitespace', async () => {
    try {
      await generateInterpretation(sampleInput, '   ')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('missing-api-key')
    }
  })

  it('calls Claude API with correct URL and headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"乾卦提示..."}}\n',
        'data: [DONE]\n',
      ]),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    await generateInterpretation(sampleInput, 'sk-test-key')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('sk-test-key')
    expect((init.headers as Record<string, string>)['anthropic-version']).toBe('2023-06-01')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('claude-haiku-4-5')
    expect(body.stream).toBe(true)
    expect(body.system).toContain('乾为天')
    expect(body.system).toContain('近期是否适合换工作？')
  })

  it('does not include the API key in error messages', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch
    try {
      await generateInterpretation(sampleInput, 'sk-supersecret')
      expect.fail('should have thrown')
    } catch (e) {
      const msg = (e as Error).message
      expect(msg).not.toContain('sk-supersecret')
    }
  })

  it('parses streaming SSE response and concatenates text', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾卦"}}\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"提示"}}\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"刚健"}}\n',
        'data: [DONE]\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, 'sk-test')
    expect(result.text).toBe('乾卦提示刚健')
    expect(result.chunks).toEqual(['乾卦', '提示', '刚健'])
  })

  it('calls onChunk for each streamed text delta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"乾"}}\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"卦"}}\n',
        'data: [DONE]\n',
      ]),
    }) as unknown as typeof fetch

    const chunks: string[] = []
    await generateInterpretation(sampleInput, 'sk-test', (c) => chunks.push(c))
    expect(chunks).toEqual(['乾', '卦'])
  })

  it('parses split SSE events (chunk boundary mid-line)', async () => {
    // Build a stream where the SSE event line is split across two chunks.
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"分片"}}\n'))
        controller.enqueue(encoder.encode('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"测试"}}\n'))
        controller.enqueue(encoder.encode('data: [DONE]\n'))
        controller.close()
      },
    })
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, body: stream }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, 'sk-test')
    expect(result.text).toBe('分片测试')
  })

  it('skips malformed SSE events gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: not-json-at-all\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"好的"}}\n',
        'data: {"type":"message_stop"}\n',
        'data: [DONE]\n',
      ]),
    }) as unknown as typeof fetch

    const result = await generateInterpretation(sampleInput, 'sk-test')
    expect(result.text).toBe('好的')
  })

  it('throws AIError with invalid-api-key on 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, 'sk-bad')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('invalid-api-key')
    }
  })

  it('throws AIError with rate-limit on 429', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, 'sk-test')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('rate-limit')
    }
  })

  it('throws AIError with server-error on 5xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    }) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, 'sk-test')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('server-error')
    }
  })

  it('throws AIError with network-error when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch

    try {
      await generateInterpretation(sampleInput, 'sk-test')
      expect.fail('should have thrown')
    } catch (e) {
      expect(e).toBeInstanceOf(AIError)
      expect((e as AIError).code).toBe('network-error')
    }
  })
})

/**
 * Helper: create a ReadableStream that yields SSE-formatted lines.
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
