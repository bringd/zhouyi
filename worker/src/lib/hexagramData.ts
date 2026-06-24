/**
 * Static hexagram data + lookup helpers for the Workers backend.
 *
 * The data is the same JSON used by the frontend (`src/data/hexagrams.json`).
 * On Workers there's no filesystem, so we import the JSON statically
 * and let wrangler bundle it. 280 KB is well under the 10 MB Worker
 * bundle limit.
 */
import hexagramsData from '../../../src/data/hexagrams.json'

interface YaoLine {
  position: number
  originalText: string
  explanation?: string
  modernMeaning?: string
}

export interface Hexagram {
  id: number
  name: string
  judgement: string
  yaoLines: YaoLine[]
}

const HEXAGRAMS: readonly Hexagram[] = hexagramsData as unknown as Hexagram[]

export function getHexagrams(): Hexagram[] {
  return HEXAGRAMS as Hexagram[]
}

export function getHexagramById(id: number): Hexagram | null {
  return HEXAGRAMS.find((h) => h.id === id) ?? null
}
