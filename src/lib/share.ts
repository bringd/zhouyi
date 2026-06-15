/**
 * Share-link encoding for divination results.
 *
 * Sharing is implemented with a URL-fragment payload rather than a
 * server-side record. Rationale: the deployed site is static
 * (Cloudflare Pages) with no backend, and a fragment-based link
 *   - works without a database
 *   - never expires (the data IS the URL)
 *   - is private (fragments are not sent to any server)
 *
 * The payload is the minimum needed to render the share card:
 * main hexagram, changed hexagram, moving line, question, a short
 * AI summary, the user's 感言, and the divination timestamp.
 *
 * The version field (`v`) lets us evolve the schema without breaking
 * older shared URLs.
 */

import type { HexagramId } from '@/types'

/** Schema version. Bump when fields are added/removed/renamed. */
export const SHARE_PAYLOAD_VERSION = 1

/** Maximum question length carried in the share link. */
export const SHARE_QUESTION_MAX = 500

/** Maximum 感言 (userNote) length carried in the share link. */
export const SHARE_NOTE_MAX = 1000

/** Maximum AI summary length carried in the share link. */
export const SHARE_AI_SUMMARY_MAX = 1000

export interface SharePayload {
  /** Schema version */
  v: 1
  /** Main hexagram id (1-64) */
  m: HexagramId
  /** Changed hexagram id (1-64) */
  c: HexagramId
  /** Moving line (1-6) */
  l: 1 | 2 | 3 | 4 | 5 | 6
  /** Original question (optional, trimmed) */
  q?: string
  /** Short AI summary — usually a sentence or two, never the full read */
  a: string
  /** User's 感言 (optional) */
  n?: string
  /** Created-at timestamp (ms) */
  t: number
}

/** Inputs to {@link buildSharePayload}. The function trims / caps string
 *  lengths and picks the first N characters of the AI text for the
 *  summary so the URL stays reasonable. */
export interface BuildSharePayloadInput {
  mainHexagramId: HexagramId
  changedHexagramId: HexagramId
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  question?: string
  /** Full AI interpretation, or whatever subset we want to expose. The
   *  function uses the first 280 characters as the "简易版" summary. */
  aiText?: string
  userNote?: string
  createdAt: number
}

/**
 * Build a {@link SharePayload} from a divination record. Trims strings,
 * caps lengths, and slices the AI text to a short summary so the
 * base64-encoded URL stays under ~1.5KB.
 */
export function buildSharePayload(input: BuildSharePayloadInput): SharePayload {
  const q = input.question?.trim() || undefined
  const n = input.userNote?.trim() || undefined
  const aiFull = input.aiText?.trim() ?? ''

  const payload: SharePayload = {
    v: 1,
    m: input.mainHexagramId,
    c: input.changedHexagramId,
    l: input.movingLine,
    a: truncate(aiFull, SHARE_AI_SUMMARY_MAX),
    t: input.createdAt,
  }
  if (q && q.length > 0) payload.q = truncate(q, SHARE_QUESTION_MAX)
  if (n && n.length > 0) payload.n = truncate(n, SHARE_NOTE_MAX)
  return payload
}

/** URL-safe base64 (no `+`, `/`, or `=` padding chars that some IM
 *  clients mangle). Uses the standard `btoa`/`atob` underneath. */
function b64UrlEncode(s: string): string {
  // First btoa gives standard base64; replace + → -, / → _, strip =.
  const b64 = btoa(unescape(encodeURIComponent(s)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64UrlDecode(s: string): string {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

/**
 * Encode a {@link SharePayload} to a URL fragment value (just the
 * `d=...` part, no leading `#`).
 */
export function encodeSharePayload(payload: SharePayload): string {
  return b64UrlEncode(JSON.stringify(payload))
}

/**
 * Decode a URL fragment value back to a {@link SharePayload}.
 * Returns null on any failure (corrupted, truncated, future-versioned).
 */
export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const json = b64UrlDecode(encoded)
    const parsed = JSON.parse(json) as unknown
    if (!isSharePayload(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Build a full shareable URL for a divination result. The data lives
 * in the URL fragment so it never reaches the server.
 *
 * If `baseUrl` is omitted, uses `window.location.origin + window.location.pathname`
 * (so the share link always points to the deployment that issued it).
 */
export function buildShareUrl(payload: SharePayload, baseUrl?: string): string {
  const encoded = encodeSharePayload(payload)
  const origin = (baseUrl ?? (typeof window !== 'undefined'
    ? window.location.origin + window.location.pathname
    : '')).replace(/\/+$/, '')
  return `${origin}/share#d=${encoded}`
}

/** Read the `d=...` fragment from a URL (defaults to `window.location`). */
export function readShareFragment(url?: string): SharePayload | null {
  const target = url ?? (typeof window !== 'undefined' ? window.location.href : '')
  const hashIdx = target.indexOf('#')
  if (hashIdx < 0) return null
  const fragment = target.slice(hashIdx + 1)
  const params = new URLSearchParams(fragment)
  const d = params.get('d')
  if (!d) return null
  return decodeSharePayload(d)
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max)
}

function isSharePayload(v: unknown): v is SharePayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  if (o.v !== 1) return false
  if (!isInt1to64(o.m) || !isInt1to64(o.c)) return false
  if (typeof o.l !== 'number' || o.l < 1 || o.l > 6) return false
  if (typeof o.a !== 'string') return false
  if (typeof o.t !== 'number') return false
  if (o.q !== undefined && typeof o.q !== 'string') return false
  if (o.n !== undefined && typeof o.n !== 'string') return false
  return true
}

function isInt1to64(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 64
}
