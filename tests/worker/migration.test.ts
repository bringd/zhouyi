import { describe, expect, it } from 'vitest'
import { applyD1Migrations, runD1Query } from './helpers/d1'

describe('migration 0002: sessions sms auth fields', () => {
  it('adds 5 new columns to sessions', async () => {
    await applyD1Migrations('./src/db/migrations')

    const columns = await runD1Query<{ name: string }>('PRAGMA table_info(sessions)')
    const names = columns.map((column) => column.name)

    expect(names).toContain('sms_phone')
    expect(names).toContain('sms_code')
    expect(names).toContain('sms_expires_at')
    expect(names).toContain('sms_verify_attempts')
    expect(names).toContain('sms_locked_until')
  })
})
