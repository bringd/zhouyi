import { Router, type Request, type Response } from 'express'
import { z } from 'zod'
import { getHexagramById } from '../lib/hexagramData.js'
import {
  anthropic,
  streamInterpretation,
} from '../services/claudeClient.js'
import {
  checkRateLimit,
  recordUsage,
  getClientIp,
  DAILY_LIMIT,
} from '../services/rateLimiter.js'

export const aiRouter = Router()

const interpretSchema = z.object({
  mainHexagramId: z.number().int().min(1).max(64),
  changedHexagramId: z.number().int().min(1).max(64),
  movingLine: z.number().int().min(1).max(6),
  question: z.string().max(500).optional(),
})

function setRateLimitHeaders(res: Response, status: {
  limit: number
  remaining: number
  resetAt: Date
}): void {
  res.setHeader('X-RateLimit-Limit', String(status.limit))
  res.setHeader('X-RateLimit-Remaining', String(status.remaining))
  res.setHeader(
    'X-RateLimit-Reset',
    String(Math.floor(status.resetAt.getTime() / 1000))
  )
}

aiRouter.post('/interpret', async (req: Request, res: Response) => {
  // 1. Validate request body
  const parseResult = interpretSchema.safeParse(req.body)
  if (!parseResult.success) {
    res.status(400).json({
      error: 'ValidationError',
      details: parseResult.error.flatten(),
    })
    return
  }
  const { mainHexagramId, changedHexagramId, movingLine, question } =
    parseResult.data

  // 2. Look up hexagrams
  const main = getHexagramById(mainHexagramId)
  const changed = getHexagramById(changedHexagramId)
  if (!main || !changed) {
    res.status(404).json({ error: 'HexagramNotFound' })
    return
  }

  const movingLineText =
    main.yaoLines[movingLine - 1]?.originalText ?? `第 ${movingLine} 爻`

  // 3. Check rate limit
  const ip = getClientIp(req)
  let rate
  try {
    rate = await checkRateLimit(ip)
  } catch (err) {
    console.error('[ai] rate limit check failed:', err)
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Rate limit check failed',
    })
    return
  }
  setRateLimitHeaders(res, rate)

  if (!rate.allowed) {
    res.status(429).json({
      error: 'RateLimitExceeded',
      message: '今日 AI 解读次数已用完，请明日再试。',
      limit: rate.limit,
      resetAt: rate.resetAt.toISOString(),
    })
    return
  }

  // 4. Bail with 503 if no API key is configured — the SSE handshake would
  //    otherwise hang on a key-less client.
  if (!anthropic) {
    res.status(503).json({
      error: 'ServiceUnavailable',
      message: 'AI service is not configured on the server.',
    })
    return
  }

  // 5. Switch to SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // 6. Stream Claude response
  try {
    let totalTokens = 0
    for await (const event of streamInterpretation({
      mainName: main.name,
      mainJudgement: main.judgement,
      movingLineText,
      changedName: changed.name,
      changedJudgement: changed.judgement,
      question,
    })) {
      if (event.type === 'delta') {
        res.write(
          `data: ${JSON.stringify({
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: event.text },
          })}\n\n`
        )
      } else if (event.type === 'done') {
        if (event.usage) {
          totalTokens = event.usage.inputTokens + event.usage.outputTokens
        }
        res.write(
          `data: ${JSON.stringify({ type: 'done', usage: event.usage })}\n\n`
        )
      }
    }

    // 7. Record usage (best-effort, must not break the stream that already
    //    finished successfully)
    try {
      await recordUsage({
        ip,
        hexagramId: mainHexagramId,
        tokensUsed: totalTokens,
      })
    } catch (err) {
      console.error('[ai] failed to record usage:', err)
    }
  } catch (err) {
    console.error('[ai] claude error:', err)
    // Headers may already be flushed; emit the error as an SSE event.
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      })}\n\n`
    )
  } finally {
    res.end()
  }
})

/**
 * Check the current IP's rate limit status. Useful for the frontend to
 * display remaining quota without making a full interpretation request.
 */
aiRouter.get('/usage', async (req: Request, res: Response) => {
  const ip = getClientIp(req)
  try {
    const rate = await checkRateLimit(ip)
    setRateLimitHeaders(res, rate)
    res.json({
      limit: rate.limit,
      remaining: rate.remaining,
      resetAt: rate.resetAt.toISOString(),
      current: rate.current,
    })
  } catch (err) {
    console.error('[ai] usage check failed:', err)
    res.status(500).json({
      error: 'InternalServerError',
      message: 'Usage check failed',
    })
  }
})

/** Re-export for tests / health checks. */
export { DAILY_LIMIT }
