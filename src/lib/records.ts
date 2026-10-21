/**
 * Divination records API client.
 *
 * Talks to the Cloudflare Worker's `/api/records` routes
 * (`worker/src/routes/records.ts`). The Worker mounts
 * `sessionMiddleware` on `/api/*`, so the very first call mints a
 * guest session (HttpOnly cookie) — no login required.
 *
 * URL resolution mirrors `src/lib/feed.ts`:
 *   1. `VITE_FEED_API_BASE` env var (staging override)
 *   2. Dev: same origin — `vite.config.ts` proxies `/api/records` → :8787
 *   3. Prod: the Worker origin, because Pages has no `/api/records`
 *      Function; a same-origin request would fall through to the SPA
 *      shell (`public/_redirects`) and hand us HTML.
 *
 * Wire-format note: the Worker returns Drizzle `timestamp`-mode columns
 * as JS `Date`s, and `Response.json()` surfaces them as ISO-8601
 * strings. Every timestamp is normalised to epoch-ms on the way in so
 * callers always see `createdAt: number`.
 *
 * Known limitation (deferred, tracked with the account-system work): in
 * production Pages and the Worker are different sites, so a
 * `SameSite=Lax` session cookie may not be attached to cross-site
 * fetches. `src/lib/feed.ts` has exactly the same shape — this is a
 * Worker-wide issue, not a records-specific one.
 */

export type RecordSource = 'local' | 'cloud'

export type RecordType = 'three-number' | 'daily'

export interface CloudRecord {
  id: string
  type: RecordType
  question: string | null
  /** Decoded from the Worker's `numbers_json` column. */
  numbers: [number, number, number] | null
  region: string | null
  timezone: string | null
  mainHexagramId: number
  movingLine: number
  changedHexagramId: number
  aiInterpretation: string | null
  userNote: string | null
  /** epoch ms */
  createdAt: number
  /** epoch ms */
  updatedAt: number
}

export interface CloudRecordInput {
  type: RecordType
  question?: string
  numbers?: [number, number, number]
  region?: string
  timezone?: string
  mainHexagramId: number
  movingLine: number
  changedHexagramId: number
  aiInterpretation?: string
  userNote?: string
}

export interface SavedRecordRef {
  id: string
  /** epoch ms (normalised from the Worker's ISO string) */
  createdAt: number
}

/** Raw row shape as it comes over the wire (timestamps may be strings). */
interface RawRecord {
  id: string
  type?: string
  question?: string | null
  numbersJson?: string | null
  numbers_json?: string | null
  region?: string | null
  timezone?: string | null
  mainHexagramId?: number
  main_hexagram_id?: number
  movingLine?: number
  moving_line?: number
  changedHexagramId?: number
  changed_hexagram_id?: number
  aiInterpretation?: string | null
  ai_interpretation?: string | null
  userNote?: string | null
  user_note?: string | null
  createdAt?: string | number | null
  created_at?: string | number | null
  updatedAt?: string | number | null
  updated_at?: string | number | null
}

const PROD_BASE = 'https://zhouyi-worker.bringd.workers.dev'

function getBaseUrl(): string {
  const env = (import.meta.env?.VITE_FEED_API_BASE ?? '') as string
  if (env) return env
  // In dev the Vite proxy forwards `/api/records` to :8787, so a
  // same-origin relative path is correct. In prod the Worker lives on
  // another origin — see the module comment.
  if (import.meta.env?.DEV) return ''
  return PROD_BASE
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(getBaseUrl() + path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`.trim())
  }
  return res
}

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T
}

// ---- Normalisation helpers --------------------------------------------------

/**
 * Any epoch-ms timestamp the app can produce is far above 1e12
 * (2001-09-09). Legacy local rows written with `Math.floor(Date.now()/1000)`
 * are ~1000x smaller and would otherwise render as 1970.
 */
const SECONDS_THRESHOLD = 1e12

function normaliseEpochNumber(value: number): number {
  if (value > 0 && value < SECONDS_THRESHOLD) return value * 1000
  return value
}

function toEpochMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return normaliseEpochNumber(value)
  }
  if (typeof value === 'string' && value !== '') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) return parsed
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return normaliseEpochNumber(asNumber)
  }
  return 0
}

function parseNumbers(raw: unknown): [number, number, number] | null {
  let decoded: unknown = raw
  if (typeof raw === 'string') {
    try {
      decoded = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (
    Array.isArray(decoded) &&
    decoded.length === 3 &&
    decoded.every((n) => typeof n === 'number' && Number.isFinite(n))
  ) {
    return decoded as [number, number, number]
  }
  return null
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normaliseType(value: unknown): RecordType {
  return value === 'daily' ? 'daily' : 'three-number'
}

/** Wire row → `CloudRecord`. Never throws on a malformed row. */
export function normaliseRecord(raw: RawRecord): CloudRecord {
  const createdAt = toEpochMs(raw.createdAt ?? raw.created_at)
  return {
    id: String(raw.id ?? ''),
    type: normaliseType(raw.type),
    question: asNullableString(raw.question),
    numbers: parseNumbers(raw.numbersJson ?? raw.numbers_json),
    region: asNullableString(raw.region),
    timezone: asNullableString(raw.timezone),
    mainHexagramId: asNumber(raw.mainHexagramId ?? raw.main_hexagram_id),
    movingLine: asNumber(raw.movingLine ?? raw.moving_line),
    changedHexagramId: asNumber(
      raw.changedHexagramId ?? raw.changed_hexagram_id,
    ),
    aiInterpretation: asNullableString(
      raw.aiInterpretation ?? raw.ai_interpretation,
    ),
    userNote: asNullableString(raw.userNote ?? raw.user_note),
    createdAt,
    updatedAt: toEpochMs(raw.updatedAt ?? raw.updated_at) || createdAt,
  }
}

// ---- Public API -------------------------------------------------------------

/**
 * List the current session's records, newest first.
 *
 * Throws on network failure or a non-2xx response; callers are expected
 * to render a degraded (local-only) view rather than block the page.
 */
export async function listCloudRecords(params?: {
  limit?: number
  offset?: number
}): Promise<CloudRecord[]> {
  const limit = params?.limit ?? 50
  const offset = params?.offset ?? 0
  const res = await request(
    `/api/records?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`,
  )
  const body = await readJson<{ records?: RawRecord[] }>(res)
  const rows = Array.isArray(body.records) ? body.records : []
  return rows.map(normaliseRecord)
}

/** Save one record to the cloud. */
export async function saveCloudRecord(
  input: CloudRecordInput,
): Promise<SavedRecordRef> {
  const res = await request('/api/records', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  const body = await readJson<{ id?: string; createdAt?: string | number }>(res)
  return {
    id: String(body.id ?? ''),
    createdAt: toEpochMs(body.createdAt),
  }
}

/** Update the user note on one cloud record. */
export async function updateCloudRecordNote(
  id: string,
  note: string,
): Promise<CloudRecord> {
  const res = await request(`/api/records/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ userNote: note }),
  })
  return normaliseRecord(await readJson<RawRecord>(res))
}

/** Delete one cloud record. Resolves on 204. */
export async function deleteCloudRecord(id: string): Promise<void> {
  await request(`/api/records/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
