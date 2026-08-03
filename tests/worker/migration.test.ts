import { describe, expect, it } from 'vitest'
import { applyD1Migrations, runD1Query } from './helpers/d1'

describe('migration 0002: sessions sms auth fields', () => {
  it('adds 5 new columns with correct types/defaults and the sms_phone index', async () => {
    await applyD1Migrations()

    const columns = await runD1Query<{ name: string; type: string; notnull: number; dflt_value: string | null }>(
      'PRAGMA table_info(sessions)'
    )
    const byName = Object.fromEntries(columns.map((c) => [c.name, c]))

    expect(byName['sms_phone']?.type).toBe('TEXT')
    expect(byName['sms_code']?.type).toBe('TEXT')
    expect(byName['sms_expires_at']?.type).toBe('INTEGER')
    expect(byName['sms_verify_attempts']?.type).toBe('INTEGER')
    expect(byName['sms_verify_attempts']?.notnull).toBe(1)
    expect(byName['sms_verify_attempts']?.dflt_value).toBe('0')
    expect(byName['sms_locked_until']?.type).toBe('INTEGER')

    const indexes = await runD1Query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'"
    )
    const indexNames = indexes.map((i) => i.name)
    expect(indexNames).toContain('sessions_sms_phone_idx')
  })
})
