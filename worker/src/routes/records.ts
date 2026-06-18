import { Hono } from 'hono'
import { z } from 'zod'
import { getDb } from '../db/client'
import { records } from '../db/schema'
import { eq, and, desc } from 'drizzle-orm'

/**
 * Records routes (divination history).
 * All routes require a session (mounted under sessionMiddleware).
 */

const createSchema = z.object({
  type: z.enum(['three-number', 'daily']),
  question: z.string().max(500).optional(),
  numbers: z.tuple([z.number(), z.number(), z.number()]).optional(),
  region: z.string().max(100).optional(),
  timezone: z.string().max(100).optional(),
  mainHexagramId: z.number().int().min(1).max(64),
  movingLine: z.number().int().min(1).max(6),
  changedHexagramId: z.number().int().min(1).max(64),
  aiInterpretation: z.string().max(10_000).optional(),
  userNote: z.string().max(2_000).optional(),
})

const updateNoteSchema = z.object({
  userNote: z.string().max(2_000),
})

export const recordsRouter = new Hono<{ Variables: { userId: string } }>()

recordsRouter.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'ValidationError', details: parsed.error.flatten() }, 400)
  }
  const id = crypto.randomUUID()
  const now = new Date()
  const db = getDb(c.env.DB)
  await db.insert(records).values({
    id,
    userId: c.get('userId'),
    type: parsed.data.type,
    question: parsed.data.question ?? null,
    numbersJson: parsed.data.numbers ? JSON.stringify(parsed.data.numbers) : null,
    region: parsed.data.region ?? null,
    timezone: parsed.data.timezone ?? null,
    mainHexagramId: parsed.data.mainHexagramId,
    movingLine: parsed.data.movingLine,
    changedHexagramId: parsed.data.changedHexagramId,
    aiInterpretation: parsed.data.aiInterpretation ?? null,
    userNote: parsed.data.userNote ?? null,
    createdAt: now,
    updatedAt: now,
  })
  return c.json({ id, createdAt: now.toISOString() }, 201)
})

recordsRouter.get('/', async (c) => {
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') ?? '50', 10) || 50, 1), 100)
  const offset = Math.max(parseInt(c.req.query('offset') ?? '0', 10) || 0, 0)
  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(records)
    .where(eq(records.userId, c.get('userId')))
    .orderBy(desc(records.createdAt))
    .limit(limit)
    .offset(offset)
  return c.json({ records: rows, limit, offset })
})

recordsRouter.get('/:id', async (c) => {
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.userId, c.get('userId'))))
    .limit(1)
  if (!rows[0]) return c.json({ error: 'RecordNotFound' }, 404)
  return c.json(rows[0])
})

recordsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json().catch(() => null)
  const parsed = updateNoteSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'ValidationError', details: parsed.error.flatten() }, 400)
  }
  const db = getDb(c.env.DB)
  const now = new Date()
  const updated = await db
    .update(records)
    .set({ userNote: parsed.data.userNote, updatedAt: now })
    .where(and(eq(records.id, id), eq(records.userId, c.get('userId'))))
    .returning()
  if (!updated[0]) return c.json({ error: 'RecordNotFound' }, 404)
  return c.json(updated[0])
})

recordsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const db = getDb(c.env.DB)
  const deleted = await db
    .delete(records)
    .where(and(eq(records.id, id), eq(records.userId, c.get('userId'))))
    .returning({ id: records.id })
  if (!deleted[0]) return c.json({ error: 'RecordNotFound' }, 404)
  return c.body(null, 204)
})
