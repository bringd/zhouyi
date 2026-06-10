/**
 * 卦象关系计算 (Hexagram Relationship Calculations)
 *
 * Three traditional academic relationships between hexagrams:
 *   - 错卦 (opposite): flip ALL 6 lines (yin ↔ yang)
 *   - 综卦 (inverse): reverse the 6 lines (top ↔ bottom)
 *   - 互卦 (nuclear): use the middle 4 lines — lower=lines 2,3,4, upper=lines 3,4,5
 *
 * All functions are pure: they read the static hexagrams index and return
 * hexagram ids (1-64). The caller can resolve an id to a full Hexagram via
 * `getHexagramById` from divination.ts.
 */

import { binaryCodeToHexagramId, getHexagramById } from './divination'
import type { Hexagram, HexagramId } from '@/types'

/** Flip all 6 bits in a binary code (1 ↔ 0). */
function flipAll(binary: string): string {
  if (binary.length !== 6) {
    throw new Error(`binary must be 6 chars, got "${binary}"`)
  }
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += binary[i] === '1' ? '0' : '1'
  }
  return out
}

/** Reverse a 6-char binary code (the 综卦 operation). */
function reverseAll(binary: string): string {
  if (binary.length !== 6) {
    throw new Error(`binary must be 6 chars, got "${binary}"`)
  }
  return binary.split('').reverse().join('')
}

/**
 * Build the binary code of the nuclear (互卦) hexagram from the original.
 * The original binary is bottom-to-top: `binary[0]` is line 1, `binary[5]` is line 6.
 *
 * The nuclear hexagram is formed by:
 *   - lower nuclear trigram = lines 2,3,4 (binary[1..3])
 *   - upper nuclear trigram = lines 3,4,5 (binary[2..4])
 *
 * The new full binary = (lines 2,3,4) ++ (lines 3,4,5), still bottom-to-top.
 */
function buildNuclearBinary(binary: string): string {
  if (binary.length !== 6) {
    throw new Error(`binary must be 6 chars, got "${binary}"`)
  }
  const lower = binary.slice(1, 4) // lines 2,3,4
  const upper = binary.slice(2, 5) // lines 3,4,5
  return lower + upper
}

/**
 * Compute the opposite (错卦) of a hexagram.
 * The opposite is the hexagram with all 6 lines flipped (yin ↔ yang).
 */
export function getOpposite(id: HexagramId): HexagramId {
  const h = getHexagramById(id)
  return binaryCodeToHexagramId(flipAll(h.binaryCode))
}

/**
 * Compute the inverse (综卦) of a hexagram.
 * The inverse is the hexagram turned upside down.
 */
export function getInverse(id: HexagramId): HexagramId {
  const h = getHexagramById(id)
  return binaryCodeToHexagramId(reverseAll(h.binaryCode))
}

/**
 * Compute the nuclear (互卦) of a hexagram.
 * The nuclear is built from the middle 4 lines of the original.
 */
export function getNuclear(id: HexagramId): HexagramId {
  const h = getHexagramById(id)
  return binaryCodeToHexagramId(buildNuclearBinary(h.binaryCode))
}

/**
 * A hexagram decorated with its three academic relationship hexagrams.
 */
export interface HexagramWithRelations extends Hexagram {
  opposite: Hexagram
  inverse: Hexagram
  nuclear: Hexagram
}

/**
 * Get a hexagram and all its 3 academic relationships
 * (opposite, inverse, nuclear), each resolved to a full Hexagram.
 */
export function getHexagramWithRelations(id: HexagramId): HexagramWithRelations {
  const main = getHexagramById(id)
  return {
    ...main,
    opposite: getHexagramById(getOpposite(id)),
    inverse: getHexagramById(getInverse(id)),
    nuclear: getHexagramById(getNuclear(id)),
  }
}
