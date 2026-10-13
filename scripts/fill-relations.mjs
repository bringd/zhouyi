#!/usr/bin/env node
/**
 * Backfill `relations.{opposite, inverse, nuclear}` for every hexagram in
 * `src/data/hexagrams.json`. Mirrors the pure helpers in
 * `src/lib/relations.ts` (flipAll / reverseAll / buildNuclearBinary +
 * binaryCodeToHexagramId) so the persisted JSON matches runtime compute.
 *
 * Why this exists
 * ---------------
 * An audit (2026-10-12) found that 192 / 192 relation fields across all 64
 * hexagrams were populated with `0`. The runtime never read those fields
 * (it computes relations on the fly from `binaryCode`), so the UI worked
 * but the data file shipped a `dead + wrong` schema. This script writes
 * the correct values, so future readers get legal ids and a future
 * relations.json export is sound.
 *
 * Idempotent: rerunning produces the same file. The script exits 1 on
 * any structural problem (64 entries, 6-char binary, etc.) so it can be
 * wired into CI later.
 *
 * Usage:
 *   node scripts/fill-relations.mjs               # dry-run (prints summary, does not write)
 *   node scripts/fill-relations.mjs --write       # write hexagrams.json in place
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HEX_PATH = resolve(__dirname, '../src/data/hexagrams.json')

const WRITE = process.argv.includes('--write')

// ---- Pure relation helpers (mirror src/lib/relations.ts) ---------------------
function flipAll(binary) {
  if (binary.length !== 6) throw new Error(`binary must be 6 chars, got "${binary}"`)
  let out = ''
  for (let i = 0; i < 6; i++) out += binary[i] === '1' ? '0' : '1'
  return out
}
function reverseAll(binary) {
  if (binary.length !== 6) throw new Error(`binary must be 6 chars, got "${binary}"`)
  return binary.split('').reverse().join('')
}
function buildNuclearBinary(binary) {
  if (binary.length !== 6) throw new Error(`binary must be 6 chars, got "${binary}"`)
  return binary.slice(1, 4) + binary.slice(2, 5)
}

// ---- Main --------------------------------------------------------------------
function main() {
  const raw = readFileSync(HEX_PATH, 'utf8')
  const hexagrams = JSON.parse(raw)

  if (!Array.isArray(hexagrams) || hexagrams.length !== 64) {
    throw new Error(`hexagrams.json must have 64 entries, got ${hexagrams?.length}`)
  }

  // binaryCode → id
  const byBinary = new Map()
  for (const h of hexagrams) {
    if (typeof h.binaryCode !== 'string' || h.binaryCode.length !== 6) {
      throw new Error(`hexagram id=${h.id} has bad binaryCode "${h.binaryCode}"`)
    }
    if (!/^[01]{6}$/.test(h.binaryCode)) {
      throw new Error(`hexagram id=${h.id} binaryCode "${h.binaryCode}" contains non 0/1`)
    }
    if (byBinary.has(h.binaryCode)) {
      throw new Error(`duplicate binaryCode "${h.binaryCode}" between id=${byBinary.get(h.binaryCode)} and id=${h.id}`)
    }
    byBinary.set(h.binaryCode, h.id)
  }

  const before = { opposite: 0, inverse: 0, nuclear: 0 }
  const after = { opposite: 0, inverse: 0, nuclear: 0 }
  let updated = 0
  let unchanged = 0

  for (const h of hexagrams) {
    if (!h.relations || typeof h.relations !== 'object') {
      throw new Error(`hexagram id=${h.id} missing relations object`)
    }
    if (h.relations.opposite === 0) before.opposite++
    if (h.relations.inverse === 0) before.inverse++
    if (h.relations.nuclear === 0) before.nuclear++

    const oppId = byBinary.get(flipAll(h.binaryCode))
    const invId = byBinary.get(reverseAll(h.binaryCode))
    const nucId = byBinary.get(buildNuclearBinary(h.binaryCode))
    if (oppId === undefined || invId === undefined || nucId === undefined) {
      throw new Error(`hexagram id=${h.id} binary ${h.binaryCode} → no partner (opposite/inverse/nuclear lookup failed)`)
    }

    const oldOpp = h.relations.opposite
    const oldInv = h.relations.inverse
    const oldNuc = h.relations.nuclear
    h.relations.opposite = oppId
    h.relations.inverse = invId
    h.relations.nuclear = nucId

    if (oldOpp !== 0 || oldInv !== 0 || oldNuc !== 0) {
      if (oldOpp === oppId && oldInv === invId && oldNuc === nucId) {
        unchanged++
      } else {
        // pre-existing non-zero values that disagree with computed → overwrite
        updated++
      }
    } else {
      updated++
    }
    after.opposite++
    after.inverse++
    after.nuclear++
  }

  // Sanity check the symmetric invariants
  const seen = new Set()
  for (const h of hexagrams) {
    if (seen.has(h.id)) throw new Error(`duplicate id ${h.id}`)
    seen.add(h.id)
    const opp = hexagrams.find((x) => x.id === h.relations.opposite)
    const inv = hexagrams.find((x) => x.id === h.relations.inverse)
    const nuc = hexagrams.find((x) => x.id === h.relations.nuclear)
    if (!opp || !inv || !nuc) {
      throw new Error(`hexagram id=${h.id} → opposite/inverse/nuclear points to non-existent id`)
    }
    // opposite is involutive (opp(opp(x)) === x)
    if (opp.relations.opposite !== h.id) {
      throw new Error(`opposite not symmetric: id=${h.id} opposite=${opp.id} but opp.opposite=${opp.relations.opposite}`)
    }
    // inverse is involutive
    if (inv.relations.inverse !== h.id) {
      throw new Error(`inverse not symmetric: id=${h.id} inverse=${inv.id} but inv.inverse=${inv.relations.inverse}`)
    }
    // nuclear is NOT involutive — iterating converges in 2-3 hops to a fixed
    // point (or a 2-cycle). We only check that nuc.relations.nuclear points
    // to a valid hexagram in 1-64; deeper nuclear-of-nuclear invariants are
    // out of scope here.
    if (!Number.isInteger(nuc.relations.nuclear) || nuc.relations.nuclear < 1 || nuc.relations.nuclear > 64) {
      throw new Error(`nuclear->nuclear out of range: id=${h.id} nuclear=${nuc.id} nuc.nuclear=${nuc.relations.nuclear}`)
    }
  }

  // Print summary
  console.log('--- relations backfill ---')
  console.log(`hexagrams.json: ${HEX_PATH}`)
  console.log(`mode:           ${WRITE ? 'WRITE' : 'dry-run'}`)
  console.log(`entries:        ${hexagrams.length}`)
  console.log(`before (zero):  opposite=${before.opposite} inverse=${before.inverse} nuclear=${before.nuclear}`)
  console.log(`updated:        ${updated}`)
  console.log(`unchanged:      ${unchanged}`)
  console.log(`after (valid):  opposite=${after.opposite} inverse=${after.inverse} nuclear=${after.nuclear}`)
  // Spot-check 乾 (id 1, 111111) — opposite should be 111111→000000 = 坤 (id 2)
  const qian = hexagrams.find((h) => h.id === 1)
  const kun = hexagrams.find((h) => h.id === 2)
  console.log(`spot check #1 乾: opposite=${qian.relations.opposite} (expect 2 坤) inverse=${qian.relations.inverse} (expect 1 self) nuclear=${qian.relations.nuclear} (expect 1 self)`)
  console.log(`spot check #2 坤: opposite=${kun.relations.opposite} (expect 1 乾) inverse=${kun.relations.inverse} (expect 2 self) nuclear=${kun.relations.nuclear} (expect 2 self)`)

  if (WRITE) {
    // Preserve 2-space indent. JSON.stringify normalizes key order; the
    // existing JSON has consistent field order per entry, so output will
    // match the input shape.
    const out = JSON.stringify(hexagrams, null, 2) + '\n'
    writeFileSync(HEX_PATH, out, 'utf8')
    console.log(`wrote:          ${HEX_PATH}`)
  } else {
    console.log('(dry-run; pass --write to commit the new relations to disk)')
  }
}

main()