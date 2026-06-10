import { Router, type Request, type Response, type NextFunction } from 'express'
import { z } from 'zod'
import { db } from '../db/client.js'
import { favoriteHexagrams } from '../db/schema.js'
import { and, desc, eq } from 'drizzle-orm'

export const favoritesRouter = Router()

/**
 * All favorite routes require an authenticated user (guest or real).
 */
favoritesRouter.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.userId) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
})

const addFavoriteSchema = z.object({
  hexagramId: z.number().int().min(1).max(64),
  note: z.string().max(500).optional(),
})

/**
 * POST /api/favorites — star a hexagram for the current user.
 * 409 if the user has already favorited the same hexagram (unique constraint).
 */
favoritesRouter.post('/', async (req: Request, res: Response) => {
  const parsed = addFavoriteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      error: 'ValidationError',
      details: parsed.error.flatten(),
    })
    return
  }

  try {
    const [created] = await db
      .insert(favoriteHexagrams)
      .values({
        userId: req.userId!,
        hexagramId: parsed.data.hexagramId,
        note: parsed.data.note,
      })
      .returning()
    res.status(201).json(created)
  } catch (err: unknown) {
    // PostgreSQL unique violation
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === '23505'
    ) {
      res.status(409).json({ error: 'AlreadyFavorited' })
      return
    }
    throw err
  }
})

/**
 * GET /api/favorites — list the current user's favorites, newest first.
 */
favoritesRouter.get('/', async (req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(favoriteHexagrams)
    .where(eq(favoriteHexagrams.userId, req.userId!))
    .orderBy(desc(favoriteHexagrams.createdAt))

  res.json({ favorites: rows })
})

/**
 * DELETE /api/favorites/:hexagramId — unstar a hexagram.
 */
favoritesRouter.delete('/:hexagramId', async (req: Request, res: Response) => {
  const hexagramId = parseInt(String(req.params.hexagramId), 10)
  if (Number.isNaN(hexagramId) || hexagramId < 1 || hexagramId > 64) {
    res.status(400).json({ error: 'InvalidHexagramId' })
    return
  }

  const [deleted] = await db
    .delete(favoriteHexagrams)
    .where(
      and(
        eq(favoriteHexagrams.userId, req.userId!),
        eq(favoriteHexagrams.hexagramId, hexagramId)
      )
    )
    .returning({ hexagramId: favoriteHexagrams.hexagramId })

  if (!deleted) {
    res.status(404).json({ error: 'FavoriteNotFound' })
    return
  }
  res.status(204).end()
})
