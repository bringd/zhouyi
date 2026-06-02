import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { config } from '../config.js'
import * as schema from './schema.js'

/**
 * PostgreSQL connection pool. Singleton — one pool per process.
 * Connection string comes from DATABASE_URL env var.
 */
export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
})

// Handle pool errors so they don't crash the process
pool.on('error', (err) => {
  console.error('[pg pool] unexpected error:', err)
})

/**
 * Drizzle ORM instance, typed with our schema.
 * Use this in routes: `await db.select().from(users).where(...)`
 */
export const db = drizzle(pool, { schema })

export type Db = typeof db
