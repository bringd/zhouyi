import Anthropic from '@anthropic-ai/sdk'
import { config } from '../config.js'

if (!config.ANTHROPIC_API_KEY) {
  console.warn(
    '[claudeClient] ANTHROPIC_API_KEY is not set. /api/ai/interpret will return 503 until it is.'
  )
}

/**
 * The Anthropic SDK client. `null` if no API key is configured so callers can
 * detect the missing-key case without try/catching a constructor throw.
 */
export const anthropic: Anthropic | null = config.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: config.ANTHROPIC_API_KEY })
  : null

export interface InterpretationInput {
  mainName: string
  mainJudgement: string
  movingLineText: string
  changedName: string
  changedJudgement: string
  question?: string
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; usage?: { inputTokens: number; outputTokens: number } }

/**
 * Build the system prompt for a divination interpretation.
 */
export function buildSystemPrompt(input: InterpretationInput): string {
  return `你是周易文化研究助手，正在为一位普通用户解读一次起卦结果。

【卦象数据】
本卦：${input.mainName}（卦辞：${input.mainJudgement}）
动爻：第 ${input.movingLineText} 爻
变卦：${input.changedName}（卦辞：${input.changedJudgement}）
用户问题：${input.question || '（用户未提具体问题）'}

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

/**
 * Stream a Claude interpretation. Yields text deltas and a final usage event.
 *
 * Uses the high-level `messages.stream()` helper which gives an EventEmitter
 * and a `finalMessage()` promise. The async iterator surface here is plain
 * for-await, which is what Express handlers can consume directly.
 */
export async function* streamInterpretation(
  input: InterpretationInput
): AsyncGenerator<StreamEvent> {
  if (!anthropic) {
    throw new Error('Anthropic client not initialized — set ANTHROPIC_API_KEY')
  }

  const systemPrompt = buildSystemPrompt(input)
  const userPrompt = '请按上述要求输出解读。'

  const stream = anthropic.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield { type: 'delta', text: event.delta.text }
    }
  }

  const finalMessage = await stream.finalMessage()
  yield {
    type: 'done',
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
    },
  }
}
