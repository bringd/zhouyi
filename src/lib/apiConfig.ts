/**
 * BYOK configuration for the AI interpretation feature.
 *
 * Three settings live together as a single `ApiConfig` object so the
 * UI can edit and clear them as a unit:
 *
 *   - baseUrl:  the upstream endpoint (Anthropic-compatible)
 *   - apiKey:   the user's secret (HttpOnly-style: only stored client-side)
 *   - model:    model identifier, e.g. "minimax-m3" or "claude-haiku-4-5"
 *
 * The baseUrl is what makes "external model" support work: a user
 * pointing to a 3rd-party Anthropic-compatible endpoint just pastes
 * that endpoint's URL here. When baseUrl is empty, the request falls
 * back to Anthropic's official `/v1/messages`.
 *
 * The whole config lives in a single localStorage slot so we can
 * evolve the schema (e.g. wrap in a JWE, add a refresh-token field)
 * without colliding with old data.
 */

const STORAGE_KEY = 'zhouyi:api-config:v1'

/** Production endpoint (used when the page is served from a real
 *  domain that MiniMax's CORS already whitelists, e.g.
 *  https://orix-studio.pages.dev). */
const UPSTREAM_BASE_URL = 'https://api.minimaxi.com/anthropic'

/** Dev-mode proxy path. Vite forwards this to UPSTREAM_BASE_URL's
 *  origin so the browser sees a same-origin request and skips the
 *  CORS preflight. */
const DEV_PROXY_PATH = '/api-proxy/anthropic'

/** Production proxy path. The Cloudflare Pages Function at
 *  `functions/api/proxy/[...path].ts` forwards to UPSTREAM_BASE_URL.
 *  Same-origin → no browser CORS check. */
const PROD_PROXY_PATH = '/api/proxy/anthropic'

/** Resolved at call time so we can pick the right URL based on
 *  whether the page is being served by `vite dev` (DEV=true) or by
 *  the production build (DEV=false). In SSR or test environments
 *  where `window` isn't available, fall back to the upstream URL. */
function getDefaultBaseUrl(): string {
  if (typeof window === 'undefined') return UPSTREAM_BASE_URL + '/v1/messages'
  if (import.meta.env?.DEV) {
    return window.location.origin + DEV_PROXY_PATH + '/v1/messages'
  }
  // Production: hit our own Pages Function so the browser sees a
  // same-origin request. The Function handles the upstream hop.
  return window.location.origin + PROD_PROXY_PATH + '/v1/messages'
}

const DEFAULT_MODEL = 'minimax-m3'

export interface ApiConfig {
  baseUrl: string
  apiKey: string
  model: string
  /** ms — surfaced in UI for "added X days ago" */
  updatedAt: number
}

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

function read(): Partial<ApiConfig> | null {
  if (!hasStorage()) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<ApiConfig>
  } catch {
    // Corrupt JSON — treat as missing.
    return null
  }
}

function write(value: ApiConfig | null): boolean {
  if (!hasStorage()) return false
  try {
    if (value === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    }
    return true
  } catch {
    return false
  }
}

/**
 * Read the full config. Missing fields fall back to defaults so
 * callers can always destructure `{ baseUrl, apiKey, model }` without
 * null checks. `apiKey` may still be empty if the user hasn't set
 * one yet — callers should check that separately.
 *
 * Migration: if the stored baseUrl is the legacy upstream URL
 * (saved before the /api/proxy/ reverse proxy existed), rewrite
 * it to the current proxy path so the call goes through the
 * Pages Function and avoids the browser CORS rejection that
 * surfaces as `TypeError: Failed to fetch`.
 */
export function getApiConfig(): ApiConfig {
  const stored = read()
  let baseUrl = (stored?.baseUrl ?? '').trim()
  if (!baseUrl || baseUrl === UPSTREAM_BASE_URL || baseUrl === UPSTREAM_BASE_URL + '/v1/messages') {
    baseUrl = getDefaultBaseUrl()
  }
  return {
    baseUrl,
    apiKey: (stored?.apiKey ?? '').trim(),
    model: (stored?.model ?? '').trim() || DEFAULT_MODEL,
    updatedAt: stored?.updatedAt ?? 0,
  }
}

/**
 * Read just the API key (preserves the old apiKey.ts API so callers
 * don't all need to migrate at once).
 */
export function getApiKey(): string | null {
  const k = getApiConfig().apiKey
  return k.length > 0 ? k : null
}

/** Update one or more config fields; missing fields are preserved. */
export function setApiConfig(patch: Partial<Omit<ApiConfig, 'updatedAt'>>): boolean {
  const current = getApiConfig()
  const next: ApiConfig = {
    baseUrl: (patch.baseUrl ?? current.baseUrl).trim(),
    apiKey: (patch.apiKey ?? current.apiKey).trim(),
    model: (patch.model ?? current.model).trim(),
    updatedAt: Date.now(),
  }
  // Don't persist a completely-empty config — that would create a row
  // with all defaults when the user hasn't actually configured anything.
  if (!next.apiKey && !read()?.apiKey) {
    return false
  }
  return write(next)
}

/** Persist just the API key. Convenience for callers that don't
 *  need to touch baseUrl/model. */
export function setApiKey(key: string): boolean {
  return setApiConfig({ apiKey: key })
}

/** Remove the entire config (key + baseUrl + model). */
export function clearApiConfig(): boolean {
  return write(null)
}

/** @deprecated — kept for backwards compat. Use clearApiConfig. */
export function clearApiKey(): boolean {
  return clearApiConfig()
}

/** True iff a non-empty key is currently stored. */
export function isApiKeyConfigured(): boolean {
  return getApiKey() !== null
}

/**
 * UI-safe description of the key: e.g. "sk-ant-•••••a1b2c3".
 * The prefix tells the user which key it is (Anthropic keys are
 * long and easy to confuse), the suffix lets them verify it's the
 * right one.
 */
export function describeApiKey(key: string | null): string {
  if (!key) return ''
  if (key.length <= 12) return '•'.repeat(key.length)
  const prefix = key.slice(0, 7) // "sk-ant-"
  const suffix = key.slice(-6)
  return `${prefix}•••••${suffix}`
}

/** Re-export the defaults so Settings can show them as placeholders
 *  and tests can assert against them. */
export const API_CONFIG_DEFAULTS = {
  // The proxy path is what the user actually sees in the browser
  // during local dev. Production deploys hit the Pages Function at
  // /api/proxy/anthropic/* which forwards to the upstream. We
  // expose the proxy path here so Settings shows a useful placeholder.
  baseUrl: typeof window !== 'undefined'
    ? window.location.origin + (import.meta.env?.DEV ? DEV_PROXY_PATH : PROD_PROXY_PATH) + '/v1/messages'
    : UPSTREAM_BASE_URL + '/v1/messages',
  model: DEFAULT_MODEL,
} as const

/** Storage slot name (exposed for tests / debug). */
export const API_CONFIG_STORAGE_SLOT = STORAGE_KEY
