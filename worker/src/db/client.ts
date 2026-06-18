import { drizzle } from 'drizzle-orm/d1'
import * as schema from './schema'

/**
 * Drizzle ORM bound to the worker's D1 instance.
 *
 * Usage in a Hono route:
 *   const db = drizzle(c.env.DB, { schema })
 *   const rows = await db.select().from(schema.records).where(...)
 */
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema })
}

export type Db = ReturnType<typeof getDb>
