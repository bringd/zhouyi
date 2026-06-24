/**
 * Community feed API client.
 *
 * Talks to the Cloudflare Worker backend (see `worker/README.md`).
 * The worker is configured with `FRONTEND_ORIGIN` set to the Pages
 * origin and the session cookie is `HttpOnly`, so we always send
 * `credentials: 'include'` and never read the cookie ourselves.
 *
 * URL resolution order:
 *   1. `VITE_FEED_API_BASE` env var (if set, e.g. staging vs prod)
 *   2. Same origin (Pages + Worker behind the same domain) — `''`
 *   3. Dev proxy: `http://localhost:5173/api-feed` (Vite forwards to
 *      `wrangler dev`'s `http://localhost:8787`)
 *
 * To add staging support: `wrangler.toml` should have a separate
 * `[env.staging]` block, and the Pages staging env should set
 * `VITE_FEED_API_BASE` to that worker URL.
 */

const PROD_BASE = 'https://zhouyi-worker.bringd.workers.dev' // Cloudflare Worker
const DEV_PROXY_PATH = '/api-feed'
const DEFAULT_MODEL_PROMPT = 'minimax-m3' // unused, kept for typing

function getBaseUrl(): string {
  const env = (import.meta.env?.VITE_FEED_API_BASE ?? '') as string
  if (env) return env
  if (typeof window === 'undefined') return PROD_BASE
  if (import.meta.env?.DEV) {
    return window.location.origin + DEV_PROXY_PATH
  }
  return PROD_BASE
}

// Keep the constant reachable so the import isn't tree-shaken.
void DEFAULT_MODEL_PROMPT

// ---- Types (mirror server's responses) ----
import type { HexagramId } from '@/types'

export interface SharedPost {
  id: string
  mainHexagramId: HexagramId
  changedHexagramId: HexagramId
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  question: string | null
  aiSummary: string | null
  note: string | null
  replyCount: number
  createdAt: number  // ms epoch (Drizzle integer mode 'timestamp')
  authorId: string
  authorNickname: string | null
}

export interface SharedReply {
  id: string
  content: string
  createdAt: number
  authorId: string
  authorNickname: string | null
}

export interface FeedListResponse {
  posts: SharedPost[]
  limit: number
  offset: number
}

export interface FeedDetailResponse {
  post: SharedPost
  replies: SharedReply[]
}

// ---- Public API ----

export async function listFeed(params?: { limit?: number; offset?: number }): Promise<FeedListResponse> {
  const limit = params?.limit ?? 20
  const offset = params?.offset ?? 0
  const url = `${getBaseUrl()}/api/feed?limit=${limit}&offset=${offset}`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`Failed to load feed: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<FeedListResponse>
}

export async function getPost(id: string): Promise<FeedDetailResponse> {
  const res = await fetch(`${getBaseUrl()}/api/feed/${encodeURIComponent(id)}`, {
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to load post: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<FeedDetailResponse>
}

export interface PublishInput {
  mainHexagramId: number
  changedHexagramId: number
  movingLine: number
  question?: string
  /** First ~280 chars of the AI reading — shown as a "what is this?" preview. */
  aiSummary?: string
  /** Author's optional intro / context for the post. */
  note?: string
}

export async function publishPost(input: PublishInput): Promise<{ id: string; createdAt: string }> {
  const res = await fetch(`${getBaseUrl()}/api/feed`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(
      `Failed to publish: ${res.status} ${(err as { message?: string }).message ?? res.statusText}`,
    )
  }
  return res.json() as Promise<{ id: string; createdAt: string }>
}

export async function addReply(postId: string, content: string): Promise<{ id: string; createdAt: string }> {
  const res = await fetch(`${getBaseUrl()}/api/feed/${encodeURIComponent(postId)}/replies`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    throw new Error(`Failed to reply: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<{ id: string; createdAt: string }>
}

/** Quick helper for the React UI. */
export const isFeedConfigured = (): boolean => true // Worker is always configured (no BYOK key needed)
