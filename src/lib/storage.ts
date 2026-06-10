/**
 * LocalStorage 封装 (LocalStorage Wrapper)
 *
 * A defensive wrapper around `localStorage` for storing user records and
 * settings. The MVP has no backend, so all persistence happens client-side
 * via this module. Every call is wrapped in try/catch to survive:
 *   - Privacy mode (storage throws on access)
 *   - Quota exceeded (setItem throws)
 *   - Corrupt JSON in storage
 *   - Missing/disabled storage (SSR, tests, etc.)
 *
 * All exported functions are synchronous (localStorage is sync) and return
 * safe defaults rather than throwing.
 */

import type { UserRecord, UserSettings } from '@/types'

const RECORDS_KEY = 'zhouyi:records'
const SETTINGS_KEY = 'zhouyi:settings'

/** Maximum number of records to keep. When exceeded, the oldest are deleted. */
export const MAX_RECORDS = 200

/** Default settings used when no settings exist or storage is inaccessible. */
export const DEFAULT_SETTINGS: UserSettings = {
  preferredLocale: 'zh-CN',
  theme: 'light',
}

/** Return true if localStorage is reachable, false otherwise. */
function hasStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    // Probe: setItem/getItem/removeItem may throw in privacy mode.
    const probeKey = '__zhouyi_probe__'
    localStorage.setItem(probeKey, '1')
    localStorage.removeItem(probeKey)
    return true
  } catch {
    return false
  }
}

/** Read and JSON-parse a string from localStorage. Returns null on any failure. */
function readJson(key: string): unknown {
  if (!hasStorage()) return null
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** JSON-stringify and write to localStorage. Returns true on success. */
function writeJson(key: string, value: unknown): boolean {
  if (!hasStorage()) return false
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    // Quota exceeded or other storage error.
    return false
  }
}

/**
 * Get all user records, sorted by createdAt descending (newest first).
 * Returns [] if storage is empty, inaccessible, or data is corrupt.
 */
export function getAllRecords(): UserRecord[] {
  const parsed = readJson(RECORDS_KEY)
  if (!Array.isArray(parsed)) return []
  // Filter out any non-record entries (defensive against corruption).
  const records: UserRecord[] = []
  for (const item of parsed) {
    if (item && typeof item === 'object' && 'id' in item && 'createdAt' in item) {
      records.push(migrateRecord(item))
    }
  }
  // Sort newest first.
  records.sort((a, b) => b.createdAt - a.createdAt)
  return records
}

/** 把 v0 老 record（无 version 字段）补 version: 1。新数据已自带 version 时原样返回。 */
function migrateRecord(raw: unknown): UserRecord {
  if (raw && typeof raw === 'object' && 'id' in raw && 'createdAt' in raw) {
    const r = raw as UserRecord
    return r.version === 1 ? r : { ...r, version: 1 }
  }
  return raw as UserRecord // caller already filtered non-objects, but be safe
}

/**
 * Get a single record by id.
 * Returns null if not found.
 */
export function getRecord(id: string): UserRecord | null {
  const records = getAllRecords()
  return records.find((r) => r.id === id) ?? null
}

/**
 * Save a record (insert or update by id).
 * If records count exceeds MAX_RECORDS, the oldest records are deleted to
 * bring the count back down (delete MAX_RECORDS/10 = 20 oldest at a time).
 * Returns true on success, false on failure.
 */
export function saveRecord(record: UserRecord): boolean {
  const records = getAllRecords()
  const existingIdx = records.findIndex((r) => r.id === record.id)
  if (existingIdx >= 0) {
    records[existingIdx] = record
  } else {
    records.push(record)
  }
  // Trim oldest if over the limit. We always keep at most MAX_RECORDS.
  if (records.length > MAX_RECORDS) {
    // Re-sort ascending to find the oldest, drop the oldest excess.
    records.sort((a, b) => a.createdAt - b.createdAt)
    const excess = records.length - MAX_RECORDS
    records.splice(0, excess)
  }
  return writeJson(RECORDS_KEY, records)
}

/**
 * Delete a record by id.
 * Returns true if found and deleted, false otherwise.
 */
export function deleteRecord(id: string): boolean {
  const records = getAllRecords()
  const idx = records.findIndex((r) => r.id === id)
  if (idx < 0) return false
  records.splice(idx, 1)
  return writeJson(RECORDS_KEY, records)
}

/**
 * Update an existing record's userNote.
 * Returns true if updated, false if not found.
 */
export function updateRecordNote(id: string, note: string): boolean {
  const records = getAllRecords()
  const idx = records.findIndex((r) => r.id === id)
  if (idx < 0) return false
  records[idx] = { ...records[idx], userNote: note }
  return writeJson(RECORDS_KEY, records)
}

/**
 * Get user settings.
 * Returns default settings merged with any stored settings, so newly added
 * settings fields automatically pick up their defaults.
 */
export function getSettings(): UserSettings {
  const parsed = readJson(SETTINGS_KEY)
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_SETTINGS }
  }
  return { ...DEFAULT_SETTINGS, ...(parsed as Partial<UserSettings>) }
}

/**
 * Save user settings (merged with existing).
 * Returns true on success, false on failure.
 */
export function saveSettings(settings: Partial<UserSettings>): boolean {
  const current = getSettings()
  const merged = { ...current, ...settings }
  return writeJson(SETTINGS_KEY, merged)
}

/**
 * Clear all records (settings preserved).
 * Returns true on success, false on failure.
 */
export function clearAllRecords(): boolean {
  return writeJson(RECORDS_KEY, [])
}
