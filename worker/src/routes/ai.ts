import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db/client'
import { aiUsage } from '../db/schema'
import { and, eq, sql } from 'drizzle-orm'

/**
 * AI route — kept as a stub for now.
 *
 * The MVP currently uses BYOK (frontend direct → Anthropic via the
 * user's own API key from Settings). The backend AI route used to
 * proxy Claude from a server-side key, but the operator chose to
 * remove that path to keep static deploys simple.
 *
 * This stub returns 503 with a clear message so the frontend can
 * show "AI 解读功能暂未上线" rather than crashing.
 */

const interpretSchema = z.object({
  mainHexagramId: z.number().int().min(1).max(64),
  changedHexagramId: z.number().int().min(1).max(64),
  movingLine: z.number().int().min(1).max(6),
  question: z.string().max(500).optional(),
})

export const aiRouter = new Hono<{ Variables: { userId: string } }>()

aiRouter.post('/interpret', async (c) => {
  // Even if request is malformed, we return 503 instead of 400 to
  // signal "feature not available" without leaking validation noise.
  await c.req.json().catch(() => null)

  // Best-effort: record the attempt for future stats, but don't fail
  // the request if the table is unavailable.
  try {
    const db = getDb(c.env.DB)
    const today = new Date().toISOString().slice(0, 10)
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? ''
    await db.insert(aiUsage).values({
      id: crypto.randomUUID(),
      userId: c.get('userId'),
      ipAddress: ip,
      date: today,
      hexagramId: null,
      tokensUsed: null,
      createdAt: new Date(),
    })
  } catch {
    // swallow — stats are best-effort
  }

  return c.json(
    {
      error: 'ServiceUnavailable',
      message: '后端 AI 解读已停用，请在设置中填入你自己的 Anthropic API Key（BYOK）使用。',
    },
    503,
  )
})
