/**
 * AI 解读调用 (Claude API Integration)
 *
 * Calls the Anthropic Messages API directly from the browser using the user's
 * own API key (no backend). Streams a 6-paragraph interpretation of a
 * divination result via Server-Sent Events.
 *
 * Error handling:
 *   - Missing API key → 'missing-api-key'
 *   - HTTP 401         → 'invalid-api-key'
 *   - HTTP 429         → 'rate-limit'
 *   - HTTP 5xx         → 'server-error'
 *   - Network failure  → 'network-error'
 *   - AbortController timeout → 'timeout'
 *
 * Security: the API key is never logged, never included in error messages,
 * and never sent anywhere except the Anthropic API endpoint.
 */

import type { Hexagram } from '@/types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'
const MODEL = 'claude-haiku-4-5'
const REQUEST_TIMEOUT_MS = 30_000

export interface AIInterpretationInput {
  mainHexagram: Hexagram
  changedHexagram: Hexagram
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  question?: string
}

export interface AIInterpretationResult {
  /** 6-paragraph interpretation, concatenated as a single string */
  text: string
  /** Raw streaming chunks collected (for debugging) */
  chunks: string[]
  /** Token usage (if available) */
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

/**
 * Thrown by `generateInterpretation` to signal a recoverable failure
 * with a stable error code the UI can switch on.
 */
export class AIError extends Error {
  constructor(
    message: string,
    public code:
      | 'missing-api-key'
      | 'invalid-api-key'
      | 'network-error'
      | 'timeout'
      | 'rate-limit'
      | 'server-error',
    public cause?: unknown,
  ) {
    super(message)
    this.name = 'AIError'
  }
}

/**
 * Build the system prompt that instructs Claude to produce a 6-paragraph
 * academic interpretation of the divination result.
 */
function buildSystemPrompt(input: AIInterpretationInput): string {
  const { mainHexagram, changedHexagram, movingLine, question } = input
  const movingLineText = mainHexagram.yaoLines[movingLine - 1]?.originalText ?? ''
  const userQuestion = question?.trim() ? question.trim() : '（用户未提具体问题）'

  return `你是周易文化研究助手，正在为一位普通用户解读一次起卦结果。

【卦象数据】
本卦：${mainHexagram.name}（卦辞：${mainHexagram.judgement}）
动爻：第 ${movingLine} 爻（${movingLineText}）
变卦：${changedHexagram.name}（卦辞：${changedHexagram.judgement}）
用户问题：${userQuestion}

【输出要求】
请以现代人易理解的语言，分 6 段输出（每段 80-120 字）：
1. 卦象概要
2. 当前状态
3. 变化原因
4. 后续趋势
5. 行动建议
6. 风险提醒

【语气约束】
- 不使用"一定会"、"注定"等绝对化预测
- 不承诺具体结果
- 不替代现实决策
- 用"周易文化研究中一种可能的解读是..."、"这个卦象提示..."等学术化语气
- 鼓励用户结合自己的实际情况判断`
}

/** Map an HTTP status code to an AIError code. */
function codeFromStatus(status: number): AIError['code'] {
  if (status === 401) return 'invalid-api-key'
  if (status === 429) return 'rate-limit'
  if (status >= 500 && status < 600) return 'server-error'
  // Other 4xx are treated as server errors too (caller can refine later).
  return 'server-error'
}

/**
 * Parse SSE lines out of a raw chunk buffer. Each line is either:
 *   - empty (event boundary)
 *   - starts with "data: " (the payload)
 *   - starts with ":" (comment, ignored)
 *   - other (ignored)
 * Returns the extracted text deltas and the leftover buffer.
 */
function parseSSEChunk(
  buffer: string,
): { deltas: string[]; usage: { input: number; output: number } | null; rest: string } {
  const deltas: string[] = []
  let usage: { input: number; output: number } | null = null
  // Split on newlines, keep the last partial line in `rest`.
  const lines = buffer.split('\n')
  const rest = lines.pop() ?? ''

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()
    if (!line || !line.startsWith('data:')) continue
    const payload = line.slice(5).trim()
    if (!payload || payload === '[DONE]') continue
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      // Skip malformed events silently — Anthropic may include heartbeats.
      continue
    }
    if (!parsed || typeof parsed !== 'object') continue
    const event = parsed as Record<string, unknown>
    if (event.type === 'content_block_delta') {
      const delta = event.delta as Record<string, unknown> | undefined
      if (delta && delta.type === 'text_delta' && typeof delta.text === 'string') {
        deltas.push(delta.text)
      }
    } else if (event.type === 'message_delta') {
      const u = event.usage as Record<string, unknown> | undefined
      if (u && typeof u.output_tokens === 'number') {
        const prevInput: number = usage ? usage.input : 0
        usage = { input: prevInput, output: u.output_tokens }
      }
    } else if (event.type === 'message_start') {
      const msg = event.message as Record<string, unknown> | undefined
      const u = msg?.usage as Record<string, unknown> | undefined
      if (u && typeof u.input_tokens === 'number') {
        const prevOutput: number = usage ? usage.output : 0
        usage = { input: u.input_tokens, output: prevOutput }
      }
    }
  }

  return { deltas, usage, rest }
}

/**
 * Iterate a streaming response body, parsing SSE chunks and collecting
 * text deltas. Updates the caller's `buffer` with any incomplete tail.
 */
async function consumeStream(
  body: ReadableStream<Uint8Array>,
  onChunk: ((chunk: string) => void) | undefined,
): Promise<{ chunks: string[]; usage: { input: number; output: number } | null }> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  const chunks: string[] = []
  let usage: { input: number; output: number } | null = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    // Process complete lines (everything up to the last newline).
    const lastNewline = buffer.lastIndexOf('\n')
    if (lastNewline === -1) continue
    const processable = buffer.slice(0, lastNewline)
    buffer = buffer.slice(lastNewline + 1)
    const { deltas, usage: u, rest } = parseSSEChunk(processable + '\n')
    if (u) usage = u
    // Anything after the last newline in `processable` re-becomes buffer;
    // we just re-append the trailing partial line (already in `buffer`).
    void rest
    for (const d of deltas) {
      chunks.push(d)
      onChunk?.(d)
    }
  }
  // Flush any trailing data.
  if (buffer.length > 0) {
    const { deltas, usage: u } = parseSSEChunk(buffer + '\n')
    if (u) usage = u
    for (const d of deltas) {
      chunks.push(d)
      onChunk?.(d)
    }
  }

  return { chunks, usage }
}

/**
 * Call Claude API to generate a 6-paragraph interpretation.
 *
 * The user must provide their own API key (stored in localStorage by the
 * settings module). The API key is sent only to the Anthropic API endpoint
 * and is never logged or echoed in error messages.
 *
 * @param input The divination context
 * @param apiKey User's Claude API key
 * @param onChunk Optional streaming callback
 * @returns The interpretation result
 * @throws AIError on API failure (with a stable `code`)
 */
export async function generateInterpretation(
  input: AIInterpretationInput,
  apiKey: string,
  onChunk?: (chunk: string) => void,
): Promise<AIInterpretationResult> {
  if (!apiKey || !apiKey.trim()) {
    throw new AIError('API key is required', 'missing-api-key')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        system: buildSystemPrompt(input),
        messages: [{ role: 'user', content: '请按照以上要求输出解读。' }],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('Request timed out', 'timeout', err)
    }
    // TypeError covers fetch network failures in the browser.
    throw new AIError('Network error', 'network-error', err)
  }
  clearTimeout(timeoutId)

  if (!response.ok) {
    // Never include the API key or the response body in the error message.
    const code = codeFromStatus(response.status)
    throw new AIError(
      `Anthropic API request failed (status ${response.status})`,
      code,
    )
  }

  if (!response.body) {
    throw new AIError('Response body missing', 'server-error')
  }

  const { chunks, usage } = await consumeStream(response.body, onChunk)
  const text = chunks.join('')
  return {
    text,
    chunks,
    ...(usage ? { usage: { inputTokens: usage.input, outputTokens: usage.output } } : {}),
  }
}
