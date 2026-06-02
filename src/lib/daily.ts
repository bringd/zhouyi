/**
 * 今日卦境生成 (Daily Hexagram Generation)
 *
 * Given a date and timezone, deterministically generate a hexagram
 * (main, moving line, changed) for that day. Same date + same timezone
 * always returns the same hexagram. Different timezones on the same
 * UTC date may return different hexagrams (because the local date
 * differs).
 *
 * Algorithm:
 *   1. Convert the date to a YYYY-MM-DD string in the given timezone.
 *   2. Hash the string (djb2) to a 32-bit seed.
 *   3. mainHexagramId = (seed % 64) + 1
 *   4. movingLine    = (Math.floor(seed / 64) % 6) + 1
 *   5. changedHexagramId = flip the moving line in main's binary, look up
 *
 * All work is delegated to pure helpers in divination.ts so this module
 * is the only "domain-specific wrapper" needed by the daily hero UI.
 */

import {
  binaryCodeToHexagramId,
  flipLine,
  getHexagramById,
} from './divination'
import type { HexagramId } from '@/types'

/** Result of a daily hexagram computation. */
export interface DailyHexagram {
  /** 1-64 — the main hexagram for the local day */
  mainHexagramId: HexagramId
  /** 1-6 — the moving line for the day */
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  /** 1-64 — the changed hexagram (after flipping the moving line) */
  changedHexagramId: HexagramId
}

/**
 * Render a Date as YYYY-MM-DD in the given IANA timezone.
 * Throws if the timezone is unknown.
 */
export function dateInTimezone(date: Date, timezone: string): string {
  // en-CA always emits ISO-like YYYY-MM-DD; combined with timeZone this gives
  // the local civil date in the requested zone. (Behavior matches the spec.)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(date)
}

/**
 * djb2 hash — a small, fast 32-bit string hash. Not cryptographic, but
 * good enough to spread a YYYY-MM-DD string across the 1-64 hexagram space.
 */
function djb2(input: string): number {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    // (hash * 33) ^ char, kept in 32-bit range.
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0
  }
  return hash
}

/**
 * Generate today's hexagram for the local date in the given timezone.
 * Same date + same timezone → always the same result.
 */
export function getDailyHexagram(date: Date, timezone: string): DailyHexagram {
  const dayKey = dateInTimezone(date, timezone)
  const seed = djb2(dayKey)
  // djb2 produces a signed 32-bit int; coerce to unsigned for safe modulo.
  const unsigned = seed >>> 0
  const mainHexagramId = ((unsigned % 64) + 1) as HexagramId
  const movingLine =
    (Math.floor(unsigned / 64) % 6 + 1) as 1 | 2 | 3 | 4 | 5 | 6

  const main = getHexagramById(mainHexagramId)
  const flippedBinary = flipLine(main.binaryCode, movingLine)
  const changedHexagramId = binaryCodeToHexagramId(flippedBinary)

  return { mainHexagramId, movingLine, changedHexagramId }
}

/**
 * Get today's hexagram using the browser's current date and timezone.
 * Falls back to UTC if the browser timezone cannot be detected.
 */
export function getTodayHexagram(): DailyHexagram {
  const now = new Date()
  let timezone: string
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timezone = 'UTC'
  }
  if (!timezone) {
    timezone = 'UTC'
  }
  return getDailyHexagram(now, timezone)
}
