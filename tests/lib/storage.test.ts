import { describe, it, expect, beforeEach } from 'vitest'
import {
  getAllRecords,
  getRecord,
  saveRecord,
  deleteRecord,
  updateRecordNote,
  getSettings,
  saveSettings,
  clearAllRecords,
  MAX_RECORDS,
  DEFAULT_SETTINGS,
} from '@/lib/storage'
import type { UserRecord } from '@/types'

const sampleRecord: UserRecord = {
  id: 'test-1',
  type: 'three-number',
  createdAt: 1700000000000,
  question: 'test question',
  numbers: [427, 831, 562],
  region: 'Singapore',
  timezone: 'Asia/Singapore',
  mainHexagramId: 22,
  movingLine: 4,
  changedHexagramId: 30,
  version: 1,
}

describe('storage: getAllRecords', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns empty array when no records exist', () => {
    expect(getAllRecords()).toEqual([])
  })

  it('returns records sorted by createdAt descending', () => {
    saveRecord({ ...sampleRecord, id: '1', createdAt: 1000 })
    saveRecord({ ...sampleRecord, id: '2', createdAt: 2000 })
    saveRecord({ ...sampleRecord, id: '3', createdAt: 1500 })

    const records = getAllRecords()
    expect(records.map((r) => r.id)).toEqual(['2', '3', '1'])
  })

  it('returns empty array when stored data is corrupt JSON', () => {
    localStorage.setItem('zhouyi:records', 'not valid json{')
    expect(getAllRecords()).toEqual([])
  })

  it('returns empty array when stored data is not an array', () => {
    localStorage.setItem('zhouyi:records', JSON.stringify({ not: 'an array' }))
    expect(getAllRecords()).toEqual([])
  })
})

describe('storage: saveRecord', () => {
  beforeEach(() => localStorage.clear())

  it('inserts a new record', () => {
    expect(saveRecord(sampleRecord)).toBe(true)
    expect(getAllRecords()).toHaveLength(1)
  })

  it('updates an existing record by id', () => {
    saveRecord(sampleRecord)
    saveRecord({ ...sampleRecord, question: 'updated question' })
    expect(getAllRecords()).toHaveLength(1)
    expect(getRecord('test-1')?.question).toBe('updated question')
  })
})

describe('storage: deleteRecord', () => {
  beforeEach(() => localStorage.clear())

  it('deletes a record by id', () => {
    saveRecord(sampleRecord)
    expect(deleteRecord('test-1')).toBe(true)
    expect(getAllRecords()).toHaveLength(0)
  })

  it('returns false for non-existent id', () => {
    expect(deleteRecord('non-existent')).toBe(false)
  })
})

describe('storage: updateRecordNote', () => {
  beforeEach(() => localStorage.clear())

  it('updates a record note', () => {
    saveRecord(sampleRecord)
    expect(updateRecordNote('test-1', 'my new note')).toBe(true)
    expect(getRecord('test-1')?.userNote).toBe('my new note')
  })

  it('returns false for non-existent id', () => {
    expect(updateRecordNote('non-existent', 'note')).toBe(false)
  })
})

describe('storage: getSettings / saveSettings', () => {
  beforeEach(() => localStorage.clear())

  it('returns default settings when none exist', () => {
    expect(getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('merges partial settings', () => {
    saveSettings({ apiKey: 'sk-test' })
    const s = getSettings()
    expect(s.apiKey).toBe('sk-test')
    expect(s.preferredLocale).toBe('zh-CN') // default preserved
    expect(s.theme).toBe('light') // default preserved
  })

  it('preserves existing settings when adding new ones', () => {
    saveSettings({ apiKey: 'sk-test' })
    saveSettings({ preferredLocale: 'zh-CN' })
    const s = getSettings()
    expect(s.apiKey).toBe('sk-test')
  })
})

describe('storage: quota exceeded handling', () => {
  beforeEach(() => localStorage.clear())

  it('returns false when quota is exceeded on save', () => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    try {
      expect(saveRecord(sampleRecord)).toBe(false)
    } finally {
      Storage.prototype.setItem = originalSetItem
    }
  })
})

describe('storage: MAX_RECORDS', () => {
  it('keeps only the most recent MAX_RECORDS records', () => {
    // Add MAX_RECORDS + 5 records
    for (let i = 0; i < MAX_RECORDS + 5; i++) {
      saveRecord({ ...sampleRecord, id: `r-${i}`, createdAt: i * 1000 })
    }
    const records = getAllRecords()
    expect(records.length).toBeLessThanOrEqual(MAX_RECORDS)
    // Newest records should be kept (highest createdAt)
    expect(records[0].id).toBe(`r-${MAX_RECORDS + 4}`)
  })
})

describe('storage: clearAllRecords', () => {
  it('removes all records but preserves settings', () => {
    saveRecord(sampleRecord)
    saveSettings({ apiKey: 'preserve-me' })
    expect(clearAllRecords()).toBe(true)
    expect(getAllRecords()).toEqual([])
    expect(getSettings().apiKey).toBe('preserve-me')
  })
})

describe('storage migration', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('migrates a v0 record (no version field) by adding version: 1', async () => {
    // 写一条"老" record（无 version）到 localStorage
    const oldRecord = {
      id: 'old-1',
      type: 'three-number',
      createdAt: Date.now(),
      region: 'Asia/Singapore',
      timezone: 'Asia/Singapore',
      mainHexagramId: 1,
      movingLine: 1,
      changedHexagramId: 2,
    }
    localStorage.setItem('zhouyi:records', JSON.stringify([oldRecord]))

    const { getAllRecords: getAll } = await import('@/lib/storage')
    const records = getAll()
    expect(records).toHaveLength(1)
    expect(records[0].version).toBe(1)
    expect(records[0].id).toBe('old-1')
  })
})
