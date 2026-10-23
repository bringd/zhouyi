import { describe, it, expect, beforeEach } from 'vitest'
import {
  getApiConfig,
  API_CONFIG_DEFAULTS,
  API_CONFIG_STORAGE_SLOT,
} from '@/lib/apiConfig'

beforeEach(() => {
  localStorage.clear()
  // Pin location so the proxy path is deterministic.
  Object.defineProperty(window, 'location', {
    value: new URL('http://localhost:5173/'),
    writable: true,
  })
})

describe('getApiConfig baseUrl (regression: dev path 401)', () => {
  it('returns the Pages Function proxy path when localStorage is empty', () => {
    // Regression: the old dev code returned
    // `${origin}/api-proxy/anthropic/v1/messages`, which Vite forwards
    // *directly* to the upstream (no AI_DEMO_KEY injection) and 401s.
    // The new path /api/proxy/anthropic/v1/messages goes through the
    // Pages Function on :8788 (or the production Function) which
    // supplies the demo key.
    const cfg = getApiConfig()
    expect(cfg.baseUrl).toBe('http://localhost:5173/api/proxy/anthropic/v1/messages')
    expect(cfg.baseUrl).not.toContain('/api-proxy/')
    expect(cfg.baseUrl).toContain('/api/proxy/anthropic/')
  })

  it('migrates a legacy /api-proxy URL back to the proxy path', () => {
    // A user with a stale localStorage entry from a previous build
    // must not be left with a 401 URL.
    localStorage.setItem(
      API_CONFIG_STORAGE_SLOT,
      JSON.stringify({ baseUrl: 'http://localhost:5173/api-proxy/anthropic/v1/messages' }),
    )
    const cfg = getApiConfig()
    expect(cfg.baseUrl).toContain('/api/proxy/anthropic/')
    expect(cfg.baseUrl).not.toContain('/api-proxy/')
  })

  it('migrates the bare upstream URL back to the proxy path', () => {
    localStorage.setItem(
      API_CONFIG_STORAGE_SLOT,
      JSON.stringify({ baseUrl: 'https://api.minimaxi.com/anthropic' }),
    )
    expect(getApiConfig().baseUrl).toContain('/api/proxy/anthropic/')
  })

  it('migrates a /api-proxy URL with a non-localhost host (port or IP variant)', () => {
    // The migration must be path-based, not host-based, so that
    // 127.0.0.1:5173 and other dev hosts also get rewritten.
    localStorage.setItem(
      API_CONFIG_STORAGE_SLOT,
      JSON.stringify({ baseUrl: 'http://127.0.0.1:5173/api-proxy/anthropic/v1/messages' }),
    )
    expect(getApiConfig().baseUrl).toContain('/api/proxy/anthropic/')
  })

  it('preserves a user-chosen custom URL (different host or service)', () => {
    // A user who has set up a different Anthropic-compatible endpoint
    // (e.g. for a self-hosted model) should not be silently redirected
    // through our proxy. The migration only matches the bare upstream
    // and the old dev /api-proxy path.
    const custom = 'https://my-private-llm.example.com/v1/messages'
    localStorage.setItem(API_CONFIG_STORAGE_SLOT, JSON.stringify({ baseUrl: custom }))
    expect(getApiConfig().baseUrl).toBe(custom)
  })
})

describe('API_CONFIG_DEFAULTS', () => {
  it('exposes the proxy path as the Settings placeholder (not /api-proxy)', () => {
    // Settings.tsx shows API_CONFIG_DEFAULTS.baseUrl as a hint to the
    // user. If it ever points at the dead /api-proxy path again the
    // user will paste it into the field and break their own setup.
    expect(API_CONFIG_DEFAULTS.baseUrl).toContain('/api/proxy/anthropic/')
    expect(API_CONFIG_DEFAULTS.baseUrl).not.toContain('/api-proxy/')
  })
})
