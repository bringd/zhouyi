import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * The frontend's hexagrams.json is the source of truth for hexagram data.
 * The server reads it directly (no separate DB load needed).
 *
 * Path resolution tries a few candidates because the compiled `dist/` layout
 * differs from `src/` in dev. In a production deployment you'd typically
 * symlink or copy the file alongside the build output.
 */
const HEXAGRAM_CANDIDATES = [
  // dev: server/src/lib/hexagramData.ts -> repo root
  join(__dirname, '../../../src/data/hexagrams.json'),
  // built: server/dist/lib/hexagramData.js -> repo root
  join(__dirname, '../../src/data/hexagrams.json'),
  // env override (e.g. shared volume in production)
  process.env.HEXAGRAMS_JSON_PATH ?? '',
].filter(Boolean)

interface YaoLine {
  position: number
  originalText: string
  explanation?: string
  modernMeaning?: string
}

interface Hexagram {
  id: number
  name: string
  judgement: string
  yaoLines: YaoLine[]
  modernInterpretation?: string
}

let cache: Hexagram[] | null = null

function loadFromDisk(): Hexagram[] {
  for (const candidate of HEXAGRAM_CANDIDATES) {
    if (candidate && existsSync(candidate)) {
      const raw = readFileSync(candidate, 'utf-8')
      return JSON.parse(raw) as Hexagram[]
    }
  }
  throw new Error(
    `[hexagramData] Could not find hexagrams.json. Tried:\n${HEXAGRAM_CANDIDATES.join('\n')}\n` +
      `Set HEXAGRAMS_JSON_PATH or copy/symlink src/data/hexagrams.json into the server directory.`
  )
}

export function getHexagrams(): Hexagram[] {
  if (cache) return cache
  cache = loadFromDisk()
  return cache
}

export function getHexagramById(id: number): Hexagram | null {
  return getHexagrams().find((h) => h.id === id) ?? null
}

/** Test-only: reset the in-memory cache. */
export function _resetHexagramCacheForTests(): void {
  cache = null
}
