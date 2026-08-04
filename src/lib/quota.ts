const STORAGE_KEY = 'zhouyi:quota:divination'

export type QuotaState =
  | { mode: 'guest'; remaining: 1 | 0 }
  | { mode: 'registered'; remaining: null }

function read(): QuotaState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { mode: 'guest', remaining: 1 }
    const parsed = JSON.parse(raw)
    if (parsed.mode === 'registered') return { mode: 'registered', remaining: null }
    return { mode: 'guest', remaining: parsed.remaining === 0 ? 0 : 1 }
  } catch {
    return { mode: 'guest', remaining: 1 }
  }
}

function write(state: QuotaState): void {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...state, updatedAt: Date.now() }),
  )
}

export function readQuota(): QuotaState {
  return read()
}

/** Decrement remaining by 1 (clamped at 0). */
export function consumeQuota(): void {
  const current = read()
  if (current.mode === 'registered') return
  const remaining = Math.max(0, current.remaining - 1) as 0 | 1
  write({ mode: 'guest', remaining })
}

/** Switch to registered mode (called after successful SMS verify). */
export function resetQuota(): void {
  write({ mode: 'registered', remaining: null })
}
