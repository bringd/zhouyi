import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../db/client.js'
import { records } from '../db/schema.js'
import { and, desc, eq } from 'drizzle-orm'

export const recordsRouter = Router()

/**
 * All record routes require an authenticated user (guest or real).
 * `req.userId` is populated by the session middleware mounted in app.ts.
 */
recordsRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

const createRecordSchema = z.object({
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

/**
 * POST /api/records — create a new divination record for the current user.
 */
recordsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = createRecordSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'ValidationError',
      details: parsed.error.flatten(),
    })
    return
  }

  const [created] = await db
    .insert(records)
    .values({
      userId: req.userId!,
      ...parsed.data,
    })
    .returning()

  res.status(201).json(created)
})

/**
 * GET /api/records?limit=&offset= — list current user's records, newest first.
 */
recordsRouter.get('/', async (req: Request, res: Response) => {
  const limit = Math.min(
    Math.max(parseInt(String(req.query.limit ?? '50'), 10) || 50, 1),
    100
  )
  const offset = Math.max(
    parseInt(String(req.query.offset ?? '0'), 10) || 0,
    0
  )

  const rows = await db
    .select()
    .from(records)
    .where(eq(records.userId, req.userId!))
    .orderBy(desc(records.createdAt))
    .limit(limit)
    .offset(offset)

  res.json({ records: rows, limit, offset })
})

/**
 * GET /api/records/:id — fetch a single record (must belong to caller).
 */
recordsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const [row] = await db
    .select()
    .from(records)
    .where(and(eq(records.id, id), eq(records.userId, req.userId!)))
    .limit(1)

  if (!row) {
    res.status(404).json({ error: 'RecordNotFound' })
    return
  }
  res.json(row)
})

const updateNoteSchema = z.object({
  userNote: z.string().max(2_000),
})

/**
 * PATCH /api/records/:id — update the user's personal note on a record.
 */
recordsRouter.patch('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const parsed = updateNoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'ValidationError',
      details: parsed.error.flatten(),
    })
    return
  }

  const [updated] = await db
    .update(records)
    .set({ userNote: parsed.data.userNote, updatedAt: new Date() })
    .where(and(eq(records.id, id), eq(records.userId, req.userId!)))
    .returning()

  if (!updated) {
    res.status(404).json({ error: 'RecordNotFound' })
    return
  }
  res.json(updated)
})

/**
 * DELETE /api/records/:id — remove a record.
 */
recordsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const [deleted] = await db
    .delete(records)
    .where(and(eq(records.id, id), eq(records.userId, req.userId!)))
    .returning({ id: records.id })

  if (!deleted) {
    res.status(404).json({ error: 'RecordNotFound' })
    return
  }
  res.status(204).end()
})
