import { describe, it, expect } from 'vitest'
import {
  buildSharePayload,
  encodeSharePayload,
  decodeSharePayload,
  buildShareUrl,
  readShareFragment,
  SHARE_AI_SUMMARY_MAX,
  SHARE_NOTE_MAX,
  SHARE_QUESTION_MAX,
} from '@/lib/share'
import type { SharePayload } from '@/lib/share'

const sample: SharePayload = {
  v: 1,
  m: 1,
  c: 9,
  l: 3,
  q: 'Should I make this decision?',
  a: '乾卦纯阳之象，象征刚健中正。',
  n: '把握当下。',
  t: 1_700_000_000_000,
}

describe('share', () => {
  describe('buildSharePayload', () => {
    it('passes through required fields', () => {
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 9,
        movingLine: 3,
        aiText: 'AI 解读',
        createdAt: 1000,
      })
      expect(p.v).toBe(1)
      expect(p.m).toBe(1)
      expect(p.c).toBe(9)
      expect(p.l).toBe(3)
      expect(p.a).toBe('AI 解读')
      expect(p.t).toBe(1000)
    })

    it('omits empty question and note', () => {
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 9,
        movingLine: 1,
        aiText: 'x',
        question: '   ',
        userNote: '',
        createdAt: 1,
      })
      expect(p.q).toBeUndefined()
      expect(p.n).toBeUndefined()
    })

    it('truncates overlong AI summary to SHARE_AI_SUMMARY_MAX', () => {
      const longAi = '乾'.repeat(SHARE_AI_SUMMARY_MAX + 50)
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 2,
        movingLine: 1,
        aiText: longAi,
        createdAt: 1,
      })
      expect(p.a.length).toBe(SHARE_AI_SUMMARY_MAX)
    })

    it('truncates overlong note to SHARE_NOTE_MAX', () => {
      const longNote = '字'.repeat(SHARE_NOTE_MAX + 100)
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 2,
        movingLine: 1,
        aiText: 'x',
        userNote: longNote,
        createdAt: 1,
      })
      expect(p.n?.length).toBe(SHARE_NOTE_MAX)
    })

    it('truncates overlong question to SHARE_QUESTION_MAX', () => {
      const longQ = '?'.repeat(SHARE_QUESTION_MAX + 50)
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 2,
        movingLine: 1,
        aiText: 'x',
        question: longQ,
        createdAt: 1,
      })
      expect(p.q?.length).toBe(SHARE_QUESTION_MAX)
    })

    it('handles undefined aiText by storing empty string', () => {
      const p = buildSharePayload({
        mainHexagramId: 1,
        changedHexagramId: 2,
        movingLine: 1,
        createdAt: 1,
      })
      expect(p.a).toBe('')
    })
  })

  describe('encodeSharePayload / decodeSharePayload', () => {
    it('round-trips a full payload', () => {
      const encoded = encodeSharePayload(sample)
      const decoded = decodeSharePayload(encoded)
      expect(decoded).toEqual(sample)
    })

    it('round-trips a minimal payload (no q, no n)', () => {
      const minimal: SharePayload = { v: 1, m: 1, c: 2, l: 1, a: 'x', t: 1 }
      const decoded = decodeSharePayload(encodeSharePayload(minimal))
      expect(decoded).toEqual(minimal)
    })

    it('produces URL-safe output (no +, /, =)', () => {
      const encoded = encodeSharePayload(sample)
      expect(encoded).not.toMatch(/[+/=]/)
    })

    it('preserves non-ASCII (Chinese) content', () => {
      const encoded = encodeSharePayload(sample)
      const decoded = decodeSharePayload(encoded)
      expect(decoded?.a).toBe('乾卦纯阳之象，象征刚健中正。')
      expect(decoded?.n).toBe('把握当下。')
    })

    it('returns null for garbage input', () => {
      expect(decodeSharePayload('not-base64!!!')).toBeNull()
      expect(decodeSharePayload('')).toBeNull()
    })

    it('returns null for valid base64 but wrong JSON', () => {
      // base64 of '{"foo":"bar"}' — wrong shape
      const wrong = Buffer.from('{"foo":"bar"}', 'utf-8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      expect(decodeSharePayload(wrong)).toBeNull()
    })

    it('returns null for unsupported version', () => {
      const future = { v: 2, m: 1, c: 2, l: 1, a: 'x', t: 1 }
      const wrong = Buffer.from(JSON.stringify(future), 'utf-8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      expect(decodeSharePayload(wrong)).toBeNull()
    })

    it('rejects out-of-range hexagram id', () => {
      const bad = { v: 1, m: 999, c: 2, l: 1, a: 'x', t: 1 }
      const wrong = Buffer.from(JSON.stringify(bad), 'utf-8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      expect(decodeSharePayload(wrong)).toBeNull()
    })

    it('rejects out-of-range moving line', () => {
      const bad = { v: 1, m: 1, c: 2, l: 7, a: 'x', t: 1 }
      const wrong = Buffer.from(JSON.stringify(bad), 'utf-8').toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      expect(decodeSharePayload(wrong)).toBeNull()
    })
  })

  describe('buildShareUrl', () => {
    it('embeds the payload in a #d=... fragment', () => {
      const url = buildShareUrl(sample, 'https://orix-studio.pages.dev')
      expect(url.startsWith('https://orix-studio.pages.dev/share#d=')).toBe(true)
      const d = url.slice(url.indexOf('#d=') + 3)
      const decoded = decodeSharePayload(d)
      expect(decoded).toEqual(sample)
    })

    it('strips trailing slashes from baseUrl', () => {
      const url = buildShareUrl(sample, 'https://example.com/')
      expect(url).toBe('https://example.com/share#d=' + encodeSharePayload(sample))
    })
  })

  describe('readShareFragment', () => {
    it('reads d= from a fragment', () => {
      const url = 'https://orix-studio.pages.dev/share#d=' + encodeSharePayload(sample)
      expect(readShareFragment(url)).toEqual(sample)
    })

    it('returns null when no fragment', () => {
      expect(readShareFragment('https://example.com/share')).toBeNull()
    })

    it('returns null when fragment has no d=', () => {
      expect(readShareFragment('https://example.com/share#other=1')).toBeNull()
    })

    it('returns null for malformed d=', () => {
      expect(readShareFragment('https://example.com/share#d=garbage')).toBeNull()
    })
  })
})
