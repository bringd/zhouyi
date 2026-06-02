/**
 * Vitest test setup file.
 *
 * Loaded automatically by vite.config.ts's setupFiles entry. Provides:
 * 1. @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
 * 2. Global mocks for browser APIs that jsdom doesn't fully implement
 * 3. Test environment polyfills
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clean up the DOM after each test
afterEach(() => {
  cleanup()
})

// Mock matchMedia (used by Framer Motion and many UI libs)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver (for scroll-triggered animations)
globalThis.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  takeRecords: vi.fn(() => []),
  root: null,
  rootMargin: '',
  thresholds: [],
})) as unknown as typeof IntersectionObserver

// Mock ResizeObserver
globalThis.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
})) as unknown as typeof ResizeObserver

// Polyfill ReadableStream / TextEncoder / TextDecoder for jsdom.
// jsdom does not implement the Streams API, but Node 18+ has it natively
// in `globalThis` (or via the `node:stream/web` module). We expose them on
// `globalThis` so code under test (and test fixtures) can construct streams.
if (typeof (globalThis as { ReadableStream?: unknown }).ReadableStream === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const webStream = require('node:stream/web') as {
    ReadableStream: typeof globalThis.ReadableStream
  }
  ;(globalThis as { ReadableStream: typeof globalThis.ReadableStream }).ReadableStream =
    webStream.ReadableStream
}
if (typeof (globalThis as { TextEncoder?: unknown }).TextEncoder === 'undefined') {
  type NodeTextEncoder = InstanceType<typeof import('node:util').TextEncoder>
  type NodeTextDecoder = InstanceType<typeof import('node:util').TextDecoder>
  const util = require('node:util') as {
    TextEncoder: { new (): NodeTextEncoder }
    TextDecoder: { new (label?: string): NodeTextDecoder }
  }
  ;(globalThis as { TextEncoder: { new (): NodeTextEncoder } }).TextEncoder =
    util.TextEncoder
  ;(globalThis as { TextDecoder: { new (label?: string): NodeTextDecoder } }).TextDecoder =
    util.TextDecoder
}
