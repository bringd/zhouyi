/**
 * 三数起卦算法 (Three-Number Divination Algorithm)
 *
 * Given three 3-digit numbers A, B, C, derive:
 *   - Lower trigram = A % 8 (treat 0 as 8)
 *   - Upper trigram = B % 8 (treat 0 as 8)
 *   - Moving line   = C % 6 (treat 0 as 6)
 *   - Main hexagram = lookup by (upper, lower)
 *   - Changed hexagram = flip the moving line in main's binary, then lookup
 *
 * This module exposes a small set of pure helpers that the rest of the app
 * (divination page, daily hexagram, AI interpretation) builds on. It has no
 * React, no DOM, no side effects beyond reading the static hexagrams.json
 * at module load.
 */

import hexagramsData from '@/data/hexagrams.json'
import type { Hexagram, HexagramId, TrigramId } from '@/types'

const HEXAGRAMS: readonly Hexagram[] = hexagramsData as unknown as Hexagram[]

/** Lookup (upper, lower) -> hexagram id */
const HEXAGRAM_BY_TRIGRAMS = new Map<string, HexagramId>()

/** Lookup binaryCode -> hexagram id */
const HEXAGRAM_BY_BINARY = new Map<string, HexagramId>()

/** Lookup id -> full hexagram */
const HEXAGRAM_BY_ID = new Map<number, Hexagram>()

for (const h of HEXAGRAMS) {
  HEXAGRAM_BY_TRIGRAMS.set(`${h.upperTrigramId},${h.lowerTrigramId}`, h.id)
  HEXAGRAM_BY_BINARY.set(h.binaryCode, h.id)
  HEXAGRAM_BY_ID.set(h.id, h)
}

/**
 * Validate a number is a 3-digit integer (100-999).
 */
export function isValidDivinationNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 100 && n <= 999
}

/**
 * Compute trigram id (1-8) from a 3-digit number: n % 8, with 0 mapped to 8.
 */
function numberToTrigramId(n: number): TrigramId {
  const r = n % 8
  return (r === 0 ? 8 : r) as TrigramId
}

/**
 * Compute moving line (1-6) from a 3-digit number: n % 6, with 0 mapped to 6.
 */
function numberToMovingLine(n: number): 1 | 2 | 3 | 4 | 5 | 6 {
  const r = n % 6
  return (r === 0 ? 6 : r) as 1 | 2 | 3 | 4 | 5 | 6
}

/**
 * Flip a single bit in a 6-character binary code.
 *
 * The binary code is **bottom-to-top**: `binary[0]` is the bottom line
 * (position 1) and `binary[5]` is the top line (position 6). So position
 * P maps to index (P - 1).
 */
export function flipLine(binary: string, position: 1 | 2 | 3 | 4 | 5 | 6): string {
  if (binary.length !== 6) {
    throw new Error(`binary must be 6 chars, got "${binary}"`)
  }
  const idx = position - 1
  const flipped = binary[idx] === '1' ? '0' : '1'
  return binary.slice(0, idx) + flipped + binary.slice(idx + 1)
}

/**
 * Resolve a 6-character binary code to its hexagram id (1-64).
 * Throws if no hexagram has that binary code.
 */
export function binaryCodeToHexagramId(binary: string): HexagramId {
  const id = HEXAGRAM_BY_BINARY.get(binary)
  if (id === undefined) {
    throw new Error(`No hexagram found for binary code "${binary}"`)
  }
  return id
}

/**
 * Look up a hexagram by id (1-64). Throws if not found.
 */
export function getHexagramById(id: HexagramId): Hexagram {
  const h = HEXAGRAM_BY_ID.get(id)
  if (!h) {
    throw new Error(`No hexagram with id ${id}`)
  }
  return h
}

/**
 * Result of a three-number divination.
 */
export interface DivinationResult {
  /** 1-8, determined by A % 8 */
  lowerTrigramId: TrigramId
  /** 1-8, determined by B % 8 */
  upperTrigramId: TrigramId
  /** 1-6, determined by C % 6 */
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  /** 1-64, looked up by (upper, lower) */
  mainHexagramId: HexagramId
  /** 1-64, the hexagram after flipping the moving line */
  changedHexagramId: HexagramId
}

/**
 * Calculate the divination result from three numbers.
 *
 * @throws Error if any number is outside 100-999 or non-integer.
 */
export function divination(a: number, b: number, c: number): DivinationResult {
  if (!isValidDivinationNumber(a)) {
    throw new Error(`Invalid divination number a=${a}: must be an integer in 100-999`)
  }
  if (!isValidDivinationNumber(b)) {
    throw new Error(`Invalid divination number b=${b}: must be an integer in 100-999`)
  }
  if (!isValidDivinationNumber(c)) {
    throw new Error(`Invalid divination number c=${c}: must be an integer in 100-999`)
  }

  const lowerTrigramId = numberToTrigramId(a)
  const upperTrigramId = numberToTrigramId(b)
  const movingLine = numberToMovingLine(c)

  const mainKey = `${upperTrigramId},${lowerTrigramId}`
  const mainHexagramId = HEXAGRAM_BY_TRIGRAMS.get(mainKey)
  if (mainHexagramId === undefined) {
    throw new Error(`No hexagram found for (upper=${upperTrigramId}, lower=${lowerTrigramId})`)
  }

  const main = HEXAGRAM_BY_ID.get(mainHexagramId)
  if (!main) {
    throw new Error(`Hexagram ${mainHexagramId} not found in index`)
  }
  const flippedBinary = flipLine(main.binaryCode, movingLine)
  const changedHexagramId = binaryCodeToHexagramId(flippedBinary)

  return {
    lowerTrigramId,
    upperTrigramId,
    movingLine,
    mainHexagramId,
    changedHexagramId,
  }
}
