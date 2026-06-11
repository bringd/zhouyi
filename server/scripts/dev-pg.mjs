/**
 * Boot an embedded PostgreSQL for local development.
 *
 * Usage: node scripts/dev-pg.mjs
 *
 * This script:
 *   1. Downloads (cached) PostgreSQL 16 binaries via embedded-postgres
 *   2. Initializes a data directory in .pg-data/
 *   3. Starts postgres on port 5432 with user=postgres / password=postgres
 *   4. Creates the `zhouyi` database if missing
 *   5. Prints the DATABASE_URL to copy into server/.env if needed
 *   6. Keeps the process alive (Ctrl+C to stop)
 */

import EmbeddedPostgres from 'embedded-postgres'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'

const DATA_DIR = resolve('./.pg-data')
const PORT = 5432
const USER = 'postgres'
const PASSWORD = 'postgres'
const DB = 'zhouyi'

async function main() {
  // Force C locale so initdb doesn't fail on Windows GBK/Chinese locales
  process.env.LANG = 'C'
  process.env.LC_ALL = 'C'
  process.env.LC_COLLATE = 'C'
  process.env.LC_CTYPE = 'C'
  process.env.LC_MESSAGES = 'C'
  process.env.LC_MONETARY = 'C'
  process.env.LC_NUMERIC = 'C'
  process.env.LC_TIME = 'C'

  // Fresh data dir on first run
  if (!existsSync(DATA_DIR)) {
    console.log('[dev-pg] initializing fresh data dir at', DATA_DIR)
    mkdirSync(DATA_DIR, { recursive: true })
  }

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    // embedded-postgres only sets LC_MESSAGES; force collate/ctype/monetary/time/numeric to C
    // so initdb doesn't fail on Windows GBK/Chinese locales
    initdbFlags: [
      '--lc-collate=C',
      '--lc-ctype=C',
      '--lc-monetary=C',
      '--lc-numeric=C',
      '--lc-time=C',
      '--encoding=UTF8',
    ],
    // On Windows, embedded-postgres uses pg-windows prebuilt binaries
  })

  console.log('[dev-pg] starting postgres on port', PORT)
  // Skip initdb if a cluster already exists in DATA_DIR
  const pgVersionFile = join(DATA_DIR, 'PG_VERSION')
  if (existsSync(pgVersionFile)) {
    console.log('[dev-pg] existing cluster detected at', DATA_DIR, '(PG_VERSION', readFileSync(pgVersionFile, 'utf8').trim() + ') — skipping initdb')
  } else {
    await pg.initialise()
  }
  await pg.start()

  // Create the zhouyi database if it doesn't exist
  try {
    await pg.createDatabase(DB)
    console.log(`[dev-pg] created database '${DB}'`)
  } catch (err) {
    if (String(err).includes('already exists')) {
      console.log(`[dev-pg] database '${DB}' already exists`)
    } else {
      throw err
    }
  }

  console.log('')
  console.log('========================================')
  console.log('PostgreSQL is running!')
  console.log(`  port:     ${PORT}`)
  console.log(`  user:     ${USER}`)
  console.log(`  password: ${PASSWORD}`)
  console.log(`  database: ${DB}`)
  console.log('')
  console.log('  DATABASE_URL for server/.env:')
  console.log(`  postgres://${USER}:${PASSWORD}@localhost:${PORT}/${DB}`)
  console.log('========================================')
  console.log('')
  console.log('Press Ctrl+C to stop.')

  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\n[dev-pg] stopping...')
    await pg.stop()
    process.exit(0)
  })
  process.on('SIGTERM', async () => {
    await pg.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('[dev-pg] failed:', err)
  process.exit(1)
})
