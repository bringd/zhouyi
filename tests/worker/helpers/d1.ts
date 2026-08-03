import { applyD1Migrations as applyMigrations, env } from 'cloudflare:test'
import { inject } from 'vitest'

type Migration = {
  name: string
  queries: string[]
}

interface D1TestEnv {
  DB: D1Database
}

const db = (env as D1TestEnv).DB

export async function applyD1Migrations(_dir: string): Promise<void> {
  await applyMigrations(db, inject('d1Migrations') as Migration[])
}

export async function runD1Query<T>(sql: string): Promise<T[]> {
  const result = await db.prepare(sql).all<T>()
  return result.results ?? []
}
