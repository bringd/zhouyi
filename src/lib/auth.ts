export type AuthState =
  | { status: 'loading' }
  | { status: 'guest'; userId: string }
  | { status: 'registered'; userId: string; phone: string }

let cache: AuthState | null = null

export function getAuthState(): AuthState {
  return cache ?? { status: 'loading' }
}

export async function refreshAuth(): Promise<AuthState> {
  const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
  const body = await res.json() as { userId: string; mode: 'guest' | 'registered'; remaining: number | null }

  const phone = localStorage.getItem('zhouyi:auth:phone') ?? body.userId
  cache = body.mode === 'registered'
    ? { status: 'registered', userId: body.userId, phone }
    : { status: 'guest', userId: body.userId }
  return cache
}

export function markRegistered(phone: string): void {
  const userId = cache?.status === 'guest' || cache?.status === 'registered' ? cache.userId : ''
  localStorage.setItem('zhouyi:auth:phone', phone)
  cache = { status: 'registered', userId, phone }
}

export function resetAuthCache(): void {
  cache = null
}