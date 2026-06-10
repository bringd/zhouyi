import { db } from '../db/client.js'
import { aiUsage } from '../db/schema.js'
import { sql, eq, and } from 'drizzle-orm'

/** Daily limit per IP — adjustable via env if needed */
export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT ?? 5)

/**
 * Get the current date in YYYY-MM-DD format (UTC for consistency).
 */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Compute the next UTC midnight as a Date.
 */
function nextUtcMidnight(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  )
}

/**
 * Extract the client IP from the request, respecting common proxy headers.
 *
 * Trusts the first IP in `X-Forwarded-For`. In production this header should
 * only be honored from known reverse proxies; for MVP we trust it as-is.
 */
export function getClientIp(req: {
  headers: Record<string, string | string[] | undefined>
  ip?: string
  socket?: { remoteAddress?: string }
}): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim()
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0]!.split(',')[0]!.trim()
  }
  const real = req.headers['x-real-ip']
  if (typeof real === 'string') return real
  if (req.ip) return req.ip
  if (req.socket?.remoteAddress) return req.socket.remoteAddress
  return 'unknown'
}

/**
 * Count today's usage for the given IP.
 */
export async function getTodayUsage(ip: string): Promise<number> {
  const today = todayUtc()
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(aiUsage)
    .where(and(eq(aiUsage.ipAddress, ip), eq(aiUsage.date, today)))
  return rows[0]?.count ?? 0
}

export interface RateLimitStatus {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  current: number
}

/**
 * Check if the IP can make another request. Counts the calls already made
 * today; the next call would be `current + 1`.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitStatus> {
  const current = await getTodayUsage(ip)
  const remaining = Math.max(0, DAILY_LIMIT - current - 1)
  const resetAt = nextUtcMidnight()
  return {
    allowed: current < DAILY_LIMIT,
    limit: DAILY_LIMIT,
    remaining,
    resetAt,
    current,
  }
}

export interface RecordUsageInput {
  ip: string
  userId?: string
  hexagramId: number
  tokensUsed?: number
}

/**
 * Record a successful AI call.
 */
export async function recordUsage(input: RecordUsageInput): Promise<void> {
  await db.insert(aiUsage).values({
    ipAddress: input.ip,
    userId: input.userId,
    hexagramId: input.hexagramId,
    tokensUsed: input.tokensUsed,
    date: todayUtc(),
  })
}
