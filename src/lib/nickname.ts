/**
 * User nickname (used in community feed posts and replies).
 *
 * Optional: defaults to "访客" if not set. Stored in localStorage so
 * the user only has to set it once. There's no auth — anyone can
 * pick any name, and the community feed has no moderation yet.
 *
 * Slot name is versioned so we can change the storage shape later
 * (e.g. add a server-side display name endpoint) without colliding
 * with old data.
 */

const STORAGE_KEY = 'zhouyi:nickname:v1'
const DEFAULT_NICKNAME = '访客'
const MAX_NICKNAME = 20

function hasStorage(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    const probe = '__zhouyi_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return true
  } catch {
    return false
  }
}

function read(): string | null {
  if (!hasStorage()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed.slice(0, MAX_NICKNAME) : null
  } catch {
    return null
  }
}

function write(value: string | null): boolean {
  if (!hasStorage()) return false
  try {
    if (value === null || value.trim().length === 0) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, value.trim().slice(0, MAX_NICKNAME))
    }
    return true
  } catch {
    return false
  }
}

/** Read the user's nickname, or the default. Always returns a non-empty string. */
export function getNickname(): string {
  return read() ?? DEFAULT_NICKNAME
}

/** True iff the user has explicitly set a nickname (not just the default). */
export function isNicknameSet(): boolean {
  return read() !== null
}

/** Persist a new nickname. Returns true on success, false on storage error.
 *  Trims whitespace and caps at MAX_NICKNAME characters. */
export function setNickname(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return write(trimmed)
}

/** Clear the stored nickname (revert to default "访客"). */
export function clearNickname(): boolean {
  return write(null)
}

export const NICKNAME_DEFAULTS = {
  default: DEFAULT_NICKNAME,
  maxLength: MAX_NICKNAME,
} as const

export const NICKNAME_STORAGE_SLOT = STORAGE_KEY
