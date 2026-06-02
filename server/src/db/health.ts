import { pool } from './client.js'

/**
 * Returns true if the database is reachable (simple SELECT 1).
 */
export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1')
    return result.rows.length === 1
  } catch (err) {
    console.error('[db health] failed:', err)
    return false
  }
}
