/**
 * Hexagram card → PNG via SVG → Canvas.
 *
 * Renders a self-contained SVG (no external assets, no html2canvas)
 * and rasterises it through an off-screen canvas. The output is a
 * "share card" PNG: hexagram visual + name + (optional) AI summary
 * + (optional) 感言 + (optional) timestamp + 易象阁 watermark.
 *
 * Why pure SVG (not html2canvas):
 *   - zero new dependencies
 *   - text in SVG <text> renders crisply at the target size
 *   - Chinese characters use a conservative font stack that always
 *     falls back to the OS default, so the saved PNG is portable
 *   - deterministic size: 720×1080 (3:4.5 portrait, fits a phone screen)
 *
 * Trigger flow:
 *   - User clicks "♡ 收藏" on HexagramDetail or ResultDisplay
 *   - Caller assembles a {@link CardData} and calls `downloadCardPng(data)`
 *   - The card PNG is saved via the browser's native download dialog
 */

import type { Hexagram, HexagramId } from '@/types'
import { getHexagramById } from './divination'

export interface CardData {
  main: Hexagram
  /** Changed hexagram. Omit for the bare-hex card on the detail page. */
  changed?: Hexagram
  /** Moving line (1-6). Omit for the bare-hex card. */
  movingLine?: 1 | 2 | 3 | 4 | 5 | 6
  /** ISO-like "2026-06-15 14:30" string. Omit if unknown. */
  timestamp?: string
  /** Short AI summary (简易版), up to ~280 chars. */
  aiSummary?: string
  /** User's 感言. */
  userNote?: string
  /** Optional: which field to emphasise (default "main"). */
  emphasis?: 'main' | 'changed'
}

const W = 720
const H = 1080
const PADDING = 32

// Colors (mirror tailwind.config.ts → tokens.css)
const C = {
  rice: '#FAF6EC',
  riceDark: '#EDE2D0',
  ink: '#1A1A1A',
  inkLight: '#4A371C',
  red: '#9B2C2C',
  gold: '#C89E3A',
  bronze: '#8B6914',
  clay: '#6B4A2A',
  riceWhite: '#FFFFFF',
} as const

// Font stack: system defaults that are always present. Avoids embedding
// CJK fonts in the SVG (would bloat PNGs by megabytes).
const FONT_DISPLAY = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif'
const FONT_BODY = '"LXGW WenKai", "KaiTi", "STKaiti", "Microsoft YaHei", "PingFang SC", sans-serif'

/**
 * Compose the SVG markup for a card. Exported for unit tests; the
 * production download path calls {@link downloadCardPng} directly.
 */
export function renderCardSvg(data: CardData): string {
  const hero = data.emphasis === 'changed' && data.changed ? data.changed : data.main
  const yHexName = 110
  const yBinaryLines = 130
  const yBinaryEnd = 540
  const lineHeight = (yBinaryEnd - yBinaryLines) / 6

  // Lines: y=0 is the top of the hexagram (line 6), y=5 is the bottom (line 1)
  const lines: string[] = []
  for (let i = 0; i < 6; i++) {
    const isYang = hero.binaryCode[5 - i] === '1'
    const y = yBinaryLines + i * lineHeight + lineHeight / 2
    if (isYang) {
      lines.push(
        `<line x1="${W / 2 - 80}" y1="${y}" x2="${W / 2 + 80}" y2="${y}" stroke="${C.rice}" stroke-width="14" stroke-linecap="round"/>`
      )
    } else {
      const gap = 12
      lines.push(
        `<line x1="${W / 2 - 80}" y1="${y}" x2="${W / 2 - gap}" y2="${y}" stroke="${C.rice}" stroke-width="14" stroke-linecap="round"/>`
      )
      lines.push(
        `<line x1="${W / 2 + gap}" y1="${y}" x2="${W / 2 + 80}" y2="${y}" stroke="${C.rice}" stroke-width="14" stroke-linecap="round"/>`
      )
    }
  }

  const yAfterHex = yBinaryEnd + 30
  const sectionY = data.movingLine !== undefined && data.changed ? yAfterHex + 30 : yAfterHex

  // Moving-line / changed section (only on result cards)
  let movingSection = ''
  if (data.movingLine !== undefined && data.changed) {
    movingSection = `
      <g transform="translate(0, ${yAfterHex})">
        <text x="${W / 2}" y="0" text-anchor="middle" font-family="${FONT_DISPLAY}"
              font-size="20" fill="${C.bronze}" letter-spacing="6">动 · 第 ${data.movingLine} 爻  →  ${data.changed.name}</text>
      </g>
    `
  }

  // AI summary
  let aiSection = ''
  let yCursor = sectionY + (movingSection ? 50 : 20)
  if (data.aiSummary && data.aiSummary.trim()) {
    const aiLines = wrapText(data.aiSummary, 32, 8)
    aiSection = `
      <g transform="translate(${PADDING}, ${yCursor})">
        <text x="0" y="0" font-family="${FONT_DISPLAY}" font-size="16"
              fill="${C.bronze}" letter-spacing="3">AI 解 读</text>
        ${aiLines
          .map(
            (line, i) =>
              `<text x="0" y="${28 + i * 26}" font-family="${FONT_BODY}" font-size="18" fill="${C.ink}">${escapeXml(line)}</text>`
          )
          .join('\n        ')}
      </g>
    `
    yCursor += 28 + aiLines.length * 26 + 18
  }

  // 感言
  let noteSection = ''
  if (data.userNote && data.userNote.trim()) {
    const noteLines = wrapText(data.userNote, 32, 6)
    noteSection = `
      <g transform="translate(${PADDING}, ${yCursor})">
        <text x="0" y="0" font-family="${FONT_DISPLAY}" font-size="16"
              fill="${C.red}" letter-spacing="3">感 言</text>
        ${noteLines
          .map(
            (line, i) =>
              `<text x="0" y="${28 + i * 26}" font-family="${FONT_BODY}" font-size="18" fill="${C.ink}">${escapeXml(line)}</text>`
          )
          .join('\n        ')}
      </g>
    `
    yCursor += 28 + noteLines.length * 26 + 18
  }

  // Timestamp
  let timeSection = ''
  if (data.timestamp) {
    timeSection = `
      <text x="${W / 2}" y="${H - 56}" text-anchor="middle" font-family="${FONT_DISPLAY}"
            font-size="14" fill="${C.inkLight}" letter-spacing="3">${escapeXml(data.timestamp)}</text>
    `
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.rice}"/>
  <defs>
    <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${C.red}"/>
      <stop offset="100%" stop-color="${C.clay}"/>
    </linearGradient>
  </defs>
  <!-- Hero: hexagram visual + name -->
  <rect x="${PADDING}" y="${PADDING}" width="${W - 2 * PADDING}" height="${yBinaryEnd - yBinaryLines + 80}"
        fill="url(#heroGrad)" rx="8"/>
  <g>
    ${lines.join('\n    ')}
  </g>
  <text x="${W / 2}" y="${yHexName}" text-anchor="middle" font-family="${FONT_DISPLAY}"
        font-size="36" fill="${C.rice}" letter-spacing="14" font-weight="500">${escapeXml(hero.name)}</text>
  <text x="${W / 2}" y="${yHexName + 28}" text-anchor="middle" font-family="${FONT_DISPLAY}"
        font-size="14" fill="${C.rice}" opacity="0.7" letter-spacing="3">第 ${hero.number} 卦</text>
  ${movingSection}
  ${aiSection}
  ${noteSection}
  ${timeSection}
  <!-- Footer watermark -->
  <text x="${W - PADDING}" y="${H - 24}" text-anchor="end" font-family="${FONT_DISPLAY}"
        font-size="11" fill="${C.bronze}" letter-spacing="2" opacity="0.5">易象阁 · zhouyi</text>
</svg>`
}

/**
 * Render the SVG and trigger a PNG download in the browser. The
 * caller passes a `CardData` (assembled from the active page state).
 *
 * The function is browser-only (uses Image + canvas). On the server
 * or in tests it throws — callers should gate the call with a
 * `typeof window !== 'undefined'` check if there's any doubt.
 */
export async function downloadCardPng(data: CardData, filename?: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('downloadCardPng is browser-only')
  }
  const svgMarkup = renderCardSvg(data)
  const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas context unavailable')
    ctx.drawImage(img, 0, 0, W, H)

    const pngBlob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
        'image/png'
      )
    })
    const pngUrl = URL.createObjectURL(pngBlob)
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = filename ?? defaultFilename(data)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(pngUrl), 5000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function defaultFilename(data: CardData): string {
  const safe = data.main.name.replace(/[\\/:*?"<>|\s]+/g, '')
  const tag = data.movingLine !== undefined ? '起卦' : '卦象'
  return `易象阁-${tag}-${safe}.png`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load SVG into Image'))
    img.src = src
  })
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Naive CJK-aware line wrap. Counts "宽" characters as 2 units. */
function wrapText(text: string, maxUnitsPerLine: number, maxLines: number): string[] {
  const out: string[] = []
  let line = ''
  let units = 0
  for (const ch of text) {
    const u = ch.charCodeAt(0) > 0x2e80 ? 2 : 1
    if (units + u > maxUnitsPerLine) {
      out.push(line)
      line = ch
      units = u
      if (out.length >= maxLines) break
    } else {
      line += ch
      units += u
    }
  }
  if (line && out.length < maxLines) out.push(line)
  if (out.length === maxLines) {
    // Last line: append "…" if we truncated
    const last = out[maxLines - 1]
    if (text.length > last.length) {
      out[maxLines - 1] = last.slice(0, Math.max(0, last.length - 1)) + '…'
    }
  }
  return out
}

/** Convenience: assemble a {@link CardData} from raw ids. Returns null
 *  if `mainId` doesn't resolve (out of range / corrupt data). */
export function cardDataFromIds(args: {
  mainId: HexagramId
  changedId?: HexagramId
  movingLine?: 1 | 2 | 3 | 4 | 5 | 6
  aiSummary?: string
  userNote?: string
  timestamp?: string
}): CardData | null {
  try {
    const main = getHexagramById(args.mainId)
    if (!main) return null
    const changed = args.changedId !== undefined ? getHexagramById(args.changedId) : undefined
    return {
      main,
      changed: changed ?? undefined,
      movingLine: args.movingLine,
      aiSummary: args.aiSummary,
      userNote: args.userNote,
      timestamp: args.timestamp,
    }
  } catch {
    // getHexagramById throws on out-of-range id. Card generation should
    // never crash the page — treat any lookup failure as a missing card.
    return null
  }
}
