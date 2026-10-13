#!/usr/bin/env node
/**
 * Backfill `modernInterpretation` for hexagrams that are missing it.
 *
 * Self-contained: reads `AI_DEMO_KEY` from root `.dev.vars` (gitignored) and
 * calls the MiniMax upstream (https://api.minimaxi.com/anthropic/v1/messages)
 * directly via fetch — the same upstream the Pages Function proxy uses.
 *
 * ── Why this file was rewritten twice ────────────────────────────────────────
 * v1 (untracked, pre-2026-08-15) depended on the deprecated `server/` package
 *    (`server/.env` + `server/node_modules/@anthropic-ai/sdk`), so it stopped
 *    working and the data stayed 60/64 empty.
 * v2 (this file's first commit) worked but produced poor content: the upstream
 *    model answers with a long Markdown *lecture outline*
 *    (「卦象分析」→「卦名：」→「卦辞解读」→「1.卦象解读」…), and the naive
 *    "strip Markdown then cut to 240 chars" post-process kept the boilerplate
 *    HEAD and threw away the TAIL — which is where the model put the
 *    business/life/interpersonal insight and the closing formula. Result: 0/60
 *    entries had the required closing line and only 10/60 read as reader-facing
 *    prose.
 * v3 (current) fixes the root cause instead of patching symptoms:
 *    1. The prompt pins the *output shape* hard — one continuous essay, no
 *       headings, no labels, no numbered sections, no quoted 卦辞 — and carries
 *       a real hand-written entry as a few-shot target.
 *    2. `validate()` checks the three content layers the spec requires
 *       (卦象要义 / 事业-人生-人际启示 / 「读X卦者…」收束) plus length
 *       (spec §3.2: 200-300 字) and the absence of scaffolding noise.
 *    3. Failing entries are retried (MAX_ATTEMPTS), and the best attempt is
 *       reported rather than silently accepted.
 *    4. Trimming happens from the END on a sentence boundary, and only after
 *       the essay shape is already correct — so the closing formula survives.
 *
 * Usage:
 *   node scripts/fill-modern-interpretations.mjs                      # fill all missing/invalid
 *   node scripts/fill-modern-interpretations.mjs --ids 5,6            # only specific ids
 *   node scripts/fill-modern-interpretations.mjs --dry-run            # preview, no write
 *   node scripts/fill-modern-interpretations.mjs --force              # regenerate even valid entries
 *
 * Checkpoints every 10 hexagrams, so an interrupted run keeps its progress.
 * Re-running is idempotent: entries that already pass `validate()` are skipped.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// The content contract lives in exactly one place so the generator and the
// Vitest suite can never drift apart. Node ≥22.6 strips the types on import
// (this file is a Node script, not part of the Vite/TS build).
import {
  validateModernInterpretation,
  MODERN_INTERPRETATION_MIN_LEN,
  MODERN_INTERPRETATION_MAX_LEN,
  CLOSING_FORMULA_AT_END,
} from '../src/lib/modernInterpretation.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const JSON_PATH = resolve(__dirname, '../src/data/hexagrams.json')
const DEV_VARS_PATH = resolve(__dirname, '../.dev.vars')
const TRIGRAMS_PATH = resolve(__dirname, '../src/data/trigrams.json')

const MODEL = 'MiniMax-Text-01'
const UPSTREAM = 'https://api.minimaxi.com/anthropic/v1/messages'
const MAX_ATTEMPTS = 3
const MIN_LEN = MODERN_INTERPRETATION_MIN_LEN
const MAX_LEN = MODERN_INTERPRETATION_MAX_LEN

// ---- CLI args --------------------------------------------------------------
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const idsIdx = args.indexOf('--ids')
const onlyIds = idsIdx >= 0 ? new Set(args[idsIdx + 1].split(',').map(Number)) : null

// ---- Load AI_DEMO_KEY from .dev.vars ---------------------------------------
function loadDemoKey() {
  const raw = readFileSync(DEV_VARS_PATH, 'utf-8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const i = trimmed.indexOf('=')
    if (i < 0) continue
    if (trimmed.slice(0, i).trim() === 'AI_DEMO_KEY') return trimmed.slice(i + 1).trim()
  }
  throw new Error('AI_DEMO_KEY not found in .dev.vars')
}

// ---- Load data -------------------------------------------------------------
const hexagrams = JSON.parse(readFileSync(JSON_PATH, 'utf-8'))
const trigrams = JSON.parse(readFileSync(TRIGRAMS_PATH, 'utf-8'))
const triById = Object.fromEntries(trigrams.map((t) => [t.id, t]))

// ── Validation ───────────────────────────────────────────────────────────────
// Delegates to the shared contract in src/lib/modernInterpretation.ts, which
// the Vitest suite asserts against the committed data. Passing the id lets the
// hand-written entries (id 1-4) use their documented looser length floor.
const validate = (text, id) => validateModernInterpretation(text, id)

// The four entries id 1-4 are the project's own hand-written reference texts
// (they define the target style). They are never overwritten by generated
// content, even though id 1 (乾, 170 字) sits just under the spec §3.2 lower
// bound — replacing authorial copy with model output would be a regression.
// Pass --force to include them anyway.
const HAND_WRITTEN = new Set([1, 2, 3, 4])

// `--check` validates the whole file and reports, without calling the API.
// Use it in review/CI-style sweeps; exit code 1 means at least one entry fails.
if (args.includes('--check')) {
  const failures = hexagrams
    .map((h) => ({ h, problems: validate(h.modernInterpretation, h.id) }))
    .filter((x) => x.problems.length > 0)
  console.log(`Checked ${hexagrams.length} entries with the spec §3.2 contract.`)
  if (failures.length === 0) {
    console.log('All entries valid ✓')
    process.exit(0)
  }
  console.log(`${failures.length} invalid:\n`)
  for (const { h, problems } of failures) {
    const len = h.modernInterpretation?.length ?? 0
    console.log(`  id=${String(h.id).padStart(2)} ${h.name.padEnd(5)} (${len}字) — ${problems.join('; ')}`)
  }
  process.exit(1)
}

const target = hexagrams.filter((h) => {
  if (onlyIds !== null && !onlyIds.has(h.id)) return false
  if (HAND_WRITTEN.has(h.id) && !force) return false
  if (force) return true
  return validate(h.modernInterpretation, h.id).length > 0
})
console.log(
  `Model: ${MODEL} | mode: ${dryRun ? 'DRY RUN' : 'WRITE'}${force ? ' | FORCE' : ''}` +
    `${onlyIds ? ` | ids: ${[...onlyIds].join(',')}` : ''}`,
)
console.log(`Found ${target.length} hexagrams needing modernInterpretation`)
if (target.length === 0) {
  console.log('Nothing to do.')
  process.exit(0)
}
console.log()

// ── Prompt ───────────────────────────────────────────────────────────────────
// The few-shot target is a real hand-written entry (id 3 水雷屯) reproduced
// verbatim, so the model sees the exact register, length and shape wanted.
const REFERENCE = `屯者，盈也、物之初生也。屯卦上坎下震，象征云雷交作、天地初开之艰难。此卦昭示：万事开头难，凡事初创之时必然经历一段混沌与困顿。在事业层面，屯卦提示勿急于求成，宜稳扎稳打、聚拢人心、借势而起。在人生起步阶段，则提醒积蓄力量、广结善缘，等待时机成熟。在困境中，最忌盲目冒进与孤立无援；最宜守持正固、寻求合作。此卦之要在于明辨'难'与'机'——大难之中往往蕴藏大机，唯有心怀远见、沉着应对者，方能转危为安。读屯卦者，宜取其坚韧不拔的毅力，去其犹豫不决的迟疑，方为得卦之真意。`

const SYSTEM_PROMPT = `你是《周易》文化研究学者，为「易象阁」网站撰写六十四卦的「现代解读」栏目。

【输出形态（最重要）】
只输出**一段连续的中文散文**，200-300 字。严禁出现：
- 小标题、章节名（如"卦象分析""卦辞解读""彖传解读"）
- 任何字段标签（如"卦名：""卦象：""卦辞：""彖传："）
- 编号或列表（如"1." "①" "（一）"）
- Markdown 记号（# * \` | > **）
- 逐字引用或串讲卦辞原文
- 英文标点、半角冒号、emoji、箭头符号
- 开场白（不要"好的""以下是""这一卦"之类）

【必须覆盖的三层，按此顺序推进】
1. 卦象与卦德要义：一两句，"X 者，Y 也"式的训诂开篇，点明上下卦与核心气质
2. 现实启示：落到事业、人生阶段、人际交往中的具体处境与应对
3. 收束：以「读X卦者，宜取其……，去其……，方为得卦之真意。」结尾（X 为卦名）

【语气】
学术、克制、不绝对化（不出现"一定会""注定""必然成功"）。

【范文（照此形态写作）】
${REFERENCE}`

function buildUserPrompt(h) {
  const upper = triById[h.upperTrigramId]?.name ?? '?'
  const lower = triById[h.lowerTrigramId]?.name ?? '?'
  const kws = Array.isArray(h.keywords) ? h.keywords.join('、') : ''
  return [
    `请为第 ${h.id} 卦「${h.name}」写一段 200-300 字的现代解读。`,
    '',
    `上下卦：上${upper}下${lower}`,
    `卦辞：${h.judgement || '（略）'}`,
    `彖传：${h.tuanzhuan ? h.tuanzhuan.slice(0, 120) : '（略）'}`,
    kws ? `关键词：${kws}` : '',
    h.theme ? `卦义提要：${h.theme}` : '',
    '',
    `收尾必须写作：读${h.shortName || h.name}卦者，宜取其……，去其……，方为得卦之真意。`,
    '只输出那一段散文，不要任何前言、标题或解释。',
  ]
    .filter(Boolean)
    .join('\n')
}

// ── Post-processing ──────────────────────────────────────────────────────────
// Deliberately conservative: the prompt already targets the right shape, so
// this only removes residual noise. It never trades away the tail.
function postProcess(raw) {
  if (!raw) return ''
  let s = raw
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    // leading scaffolding titles the model sometimes prepends
    .replace(/^\s*《[^》]{1,20}》\s*(卦)?\s*(现代解读|解读)?\s*[:：]?\s*/m, '')
    .replace(/^\s*第\s*\d+\s*卦[^，。：:]{0,16}(——|-—)?\s*(现代解读|解读)\s*[:：]?\s*/m, '')
    .replace(/^\s*(现代解读|卦象分析|卦象解析|卦象构成|总体卦象|整体意象)\s*[:：]?\s*/m, '')
    // opening pleasantries
    .replace(/^\s*(好的|以下是|如下)[^。]{0,24}[。：:]\s*/m, '')
    .replace(/^\s*[：:]\s*/m, '')
  s = s.replace(/\s+/g, ' ').trim()
  s = s.replace(/ /g, '')
  // Half-width Chinese-context colons -> full-width (label syntax leak).
  s = s.replace(/([\u4e00-\u9fff])\s*:\s*(?=[\u4e00-\u9fff])/g, '$1：')

  // The closing formula is mandatory and MUST survive trimming. Lift it out
  // first (from the LAST "读…卦者" to the end), then trim the body to fit the
  // remaining budget, then re-append. Trimming the head only — the naive
  // approach — is what previously chopped the closing off mid-sentence.
  // Only treat the tail as a closing if the complete formula is present;
  // otherwise leave it in the body so `validate()` can reject the entry.
  let closing = ''
  const closingStart = (() => {
    const re = /读\s*[^，。]{0,8}卦者/g
    let m
    let last = -1
    while ((m = re.exec(s)) !== null) last = m.index
    return last
  })()
  if (closingStart >= 0) {
    const candidate = s.slice(closingStart).trim()
    if (CLOSING_FORMULA_AT_END.test(candidate)) {
      closing = candidate
      s = s.slice(0, closingStart).trim()
    }
  }
  const budget = MAX_LEN - closing.length
  if (s.length > budget) {
    const slice = s.slice(0, budget)
    const cut = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('；'), slice.lastIndexOf('，'))
    s = cut >= 120 ? slice.slice(0, cut + 1) : slice
  }
  return s + closing
}

async function generateOne(apiKey, h) {
  const res = await fetch(UPSTREAM, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(h) }],
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const raw = (json.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
  return postProcess(raw)
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = loadDemoKey()
  let ok = 0
  let cleaned = 0
  let failed = 0

  for (let i = 0; i < target.length; i++) {
    const h = target[i]
    const tag = `[${String(i + 1).padStart(2)}/${target.length}] id=${String(h.id).padStart(2)} ${h.name.padEnd(5)}`
    let best = null
    let bestProblems = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const text = await generateOne(apiKey, h)
        const problems = validate(text, h.id)
        if (problems.length === 0) {
          best = text
          bestProblems = []
          break
        }
        if (best === null || problems.length < bestProblems.length) {
          best = text
          bestProblems = problems
        }
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 400))
      } catch (err) {
        bestProblems = [`error: ${err.message || err}`]
        if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 700))
      }
    }

    if (best !== null && bestProblems.length === 0) {
      console.log(`${tag} ✓ ${best.length} chars`)
      ok++
    } else if (best !== null) {
      console.log(`${tag} ⚠ ${best.length} chars — ${bestProblems.join('; ')}`)
      cleaned++
    } else {
      console.log(`${tag} ✗ ${bestProblems?.join('; ')}`)
      failed++
      continue
    }

    if (!dryRun) {
      const rec = hexagrams.find((x) => x.id === h.id)
      if (rec) rec.modernInterpretation = best
    }
    if (!dryRun && (ok + cleaned) % 10 === 0) {
      writeFileSync(JSON_PATH, JSON.stringify(hexagrams, null, 2) + '\n', 'utf-8')
      console.log(`  (checkpoint: ${ok + cleaned}/${target.length})`)
    }
    if (i < target.length - 1) await new Promise((r) => setTimeout(r, 300))
  }

  if (!dryRun) {
    writeFileSync(JSON_PATH, JSON.stringify(hexagrams, null, 2) + '\n', 'utf-8')
  }
  console.log()
  console.log(`validated: ${ok}  |  accepted-with-warnings: ${cleaned}  |  failed: ${failed}`)
  if (dryRun) console.log('(dry-run: nothing written)')
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
