/**
 * 对比度算法的**边界回归**（独立复验 P2 的硬要求）。
 *
 * 复验方给的反例：500×70 画布，左半白底、右半深色底，两侧都画纯黑文字。
 * 四档深色底依次是 #333333 / #030303 / #010101 / #000000：
 *
 *   | 右侧底色 | 真实最弱对比度 | 旧算法（差值法） | 本算法 |
 *   |----------|----------------|------------------|--------|
 *   | #333333  | 1.6621:1       | 1.66:1 ✓        | 1.66:1 |
 *   | #030303  | 1.0182:1       | 1.02:1 ✓        | 1.02:1 |
 *   | #010101  | 1.0061:1       | 21:1 ✗ 假通过   | 1.01:1 |
 *   | #000000  | 1:1            | 21:1 ✗ 假通过   | 1.00:1 |
 *
 * 后两档说明问题的本质：**黑字压纯黑底时，「有字」与「无字」两张图逐像素完全相同**，
 * 差值法在任何阈值下都找不到那个落点——那两张图里根本没有关于「有没有字」的信息。
 * 所以本算法改用**受控背景掩膜**（白底黑字 / 白底无字相减）定位字形，
 * 再回到原背景算对比度。
 *
 * 这个脚本**自包含**：栅格与掩膜都由同一个墨迹生成器产出，
 * 字形与坐标严格一致，不依赖任何仓库外或被忽略的临时文件。
 * （早期版本依赖 tmp/ 下别人的证据、并且靠「复制左半」拼右半掩膜，
 *  独立审核指出那既跑不起来、也证明不了掩膜正确。）
 *
 * 用法：node scripts/contrast-edge-cases.mjs
 * 产物：screenshots/contrast/contrast-edge-cases.json
 * 退出码：出现「该判失败却判通过」的假通过、或用例缺失 → 1
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import vm from 'node:vm'

const SOURCE = 'scripts/contrast-appearances.mjs'
const REVIEWER_RASTERS = 'tmp/release-acceptance-20261023/contrast-rasters.json'
const OUT = 'screenshots/contrast/contrast-edge-cases.json'

/* ------------------- 从源文件里取被测函数（按大括号配平） ------------------- */

const source = await readFile(SOURCE, 'utf8')
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`${SOURCE} 里找不到函数 ${name}`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  let inString = null
  let inLine = false
  let inBlock = false
  for (let i = bodyStart; i < source.length; i++) {
    const ch = source[i]
    const nx = source[i + 1]
    if (inLine) {
      if (ch === '\n') inLine = false
      continue
    }
    if (inBlock) {
      if (ch === '*' && nx === '/') {
        inBlock = false
        i++
      }
      continue
    }
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '/' && nx === '/') {
      inLine = true
      i++
      continue
    }
    if (ch === '/' && nx === '*') {
      inBlock = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`函数 ${name} 的大括号没有配平`)
}

// 只替换图片解码与画布回读，像素分析代码原样不动
const rasters = new Map()
class RasterImage {
  set src(value) {
    this.raster = rasters.get(value.split(',')[1])
    this.naturalWidth = this.raster.width
    this.naturalHeight = this.raster.height
  }
  async decode() {}
}
const document = {
  createElement() {
    let raster
    return {
      getContext() {
        return {
          drawImage(image) {
            raster = image.raster
          },
          getImageData() {
            return { data: raster.data }
          },
        }
      },
    }
  },
}
const analyze = vm.runInNewContext('(' + extractFunction('analyzePair') + ')', {
  Image: RasterImage,
  document,
})

/* --------------------------- WCAG 参考值 --------------------------- */

const luminance = (v) => {
  const f = v / 255
  return f <= 0.03928 ? f / 12.92 : Math.pow((f + 0.055) / 1.055, 2.4)
}
const contrastBlack = (gray) => {
  const a = luminance(gray)
  const b = luminance(0)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/* --------------------- 墨迹生成器（字形 + 坐标的唯一来源） --------------------- */

// 5×7 的 'M' 位图：够像字，又不依赖任何字体
const M5x7 = [
  [1, 0, 0, 0, 1],
  [1, 1, 0, 1, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 0, 0, 1],
]

const W = 500
const H = 70
const SCALE = 4 // 每个位图像素放大成 4×4 设备像素
const GLYPH_W = 5 * SCALE
const GAP = 10

/** 文字落点：左右两半同样的字形、同样的相对位置 */
const origins = [12, Math.floor(W / 2) + 12]

/**
 * 生成「有字图 / 无字图 / 掩膜(白底黑字) / 掩膜(白底无字)」。
 * 四张图共用同一份墨迹列表 → 字形与坐标天然一致。
 * 背景可以是一整片灰，也可以是横向渐变（用来暴露「掩膜位置错了」）。
 */
function buildCase({ gray, gradient = false }) {
  const ink = []
  // 覆盖率分三档（100% / 70% / 40%），顺便检验 α 阈值
  const levels = [1, 0.7, 0.4]
  let levelIdx = 0
  for (const originX of origins) {
    for (let g = 0; g < 4; g++) {
      const gx = originX + g * (GLYPH_W + GAP)
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (!M5x7[row][col]) continue
          const level = levels[levelIdx++ % levels.length]
          for (let dy = 0; dy < SCALE; dy++) {
            for (let dx = 0; dx < SCALE; dx++) {
              ink.push({ x: gx + col * SCALE + dx, y: 14 + row * SCALE + dy, level })
            }
          }
        }
      }
    }
  }
  const bgAt = (i) => {
    const x = i % W
    if (!gradient) return x < W / 2 ? [255, 255, 255] : [gray, gray, gray]
    // 横向渐变：左边白，到 x=300（文字最右那列）时正好到最深，
    // 之后保持不变——这样「文字压到的最深底色」就是 gray 本身，
    // 期望值仍然好算；同时背景随位置变化，掩膜错位会被算出来。
    const t = Math.min(1, x / 300)
    const v = Math.round(255 + (gray - 255) * t)
    return [v, v, v]
  }
  const make = (withText, withBg) => {
    const buf = new Uint8Array(W * H * 4)
    for (let i = 0; i < W * H; i++) {
      const c = withBg ? bgAt(i) : [255, 255, 255]
      buf[i * 4] = c[0]
      buf[i * 4 + 1] = c[1]
      buf[i * 4 + 2] = c[2]
      buf[i * 4 + 3] = 255
    }
    if (withText) {
      for (const p of ink) {
        if (p.x >= W || p.y >= H) continue
        const i = (p.y * W + p.x) * 4
        for (let ch = 0; ch < 3; ch++) {
          buf[i + ch] = Math.round(0 * p.level + buf[i + ch] * (1 - p.level))
        }
      }
    }
    return buf
  }
  return {
    fg: make(true, true), // 有字 + 原背景
    bg: make(false, true), // 无字 + 原背景
    maskText: make(true, false), // 白底 + 黑字
    maskNone: make(false, false), // 白底 + 无字
  }
}

/* ------------------------------ 执行 ------------------------------ */

const problems = []
const report = []

async function runCase(name, images, expected, extra = {}) {
  rasters.set('fg', { width: W, height: H, data: images.fg })
  rasters.set('bg', { width: W, height: H, data: images.bg })
  rasters.set('maskText', { width: W, height: H, data: images.maskText })
  rasters.set('maskNone', { width: W, height: H, data: images.maskNone })
  const fragments = [
    { x: 0, y: 0, w: W, h: H, color: 'rgb(0, 0, 0)', opacity: 1, fontSize: 24, fontWeight: 700 },
  ]
  const actual = await analyze('fg', 'bg', fragments, [], 'maskText', 'maskNone')
  const row = {
    name,
    expectedWorst: expected,
    reportedWorst: actual.weakestRatio,
    point: actual.weakestPoint,
    onDarkSide: !!actual.weakestPoint && actual.weakestPoint.x > W / 2,
    falsePass: expected < 4.5 && actual.weakestRatio >= 4.5,
    deviation:
      actual.weakestRatio === null
        ? null
        : Math.round(Math.abs(actual.weakestRatio - expected) * 10000) / 10000,
    ...extra,
  }
  report.push(row)
  if (row.reportedWorst === null) {
    problems.push(`${name} 没有测出任何文字落点`)
    return
  }
  if (row.falsePass) {
    problems.push(
      `${name} 假通过：真实最弱 ${row.expectedWorst}:1（应判失败），算法却报 ${row.reportedWorst}:1`
    )
  }
  if (!row.onDarkSide) {
    problems.push(`${name} 的最弱落点没落在深色那一侧：point=${JSON.stringify(actual.weakestPoint)}`)
  }
  if (row.deviation !== null && row.deviation > 0.08) {
    problems.push(
      `${name} 报出的最弱值与真实值偏差 ${row.deviation}（真实 ${row.expectedWorst}，报 ${row.reportedWorst}）`
    )
  }
}

// 1) 四档深色底：自生成的栅格 + 同一来源的掩膜
for (const gray of [0x33, 0x03, 0x01, 0x00]) {
  await runCase(`自生成 #${gray.toString(16).padStart(2, '0')}`, buildCase({ gray }), Math.round(contrastBlack(gray) * 10000) / 10000)
}

// 2) 空间变化背景：横向渐变，掩膜位置错就会被算出来
for (const gray of [0x33, 0x00]) {
  await runCase(
    `渐变背景 #${gray.toString(16).padStart(2, '0')}`,
    buildCase({ gray, gradient: true }),
    Math.round(contrastBlack(gray) * 10000) / 10000
  )
}

// 说明（刻意不做的事）：
// 复验方那批原始栅格（tmp/release-acceptance-20261023/contrast-rasters.json）
// **不能**在这里复跑：独立审核逐像素核对过，那批栅格左右两半的字形并不相同，
// 而「有字/无字」两图在纯黑底那一侧逐像素相同、根本没有字形信息，
// 所以既不能靠复制左半拼出掩膜、也无法从栅格本身反推出掩膜。
// 拿自造掩膜去套它只会得到无意义的数字。
// 那批栅格的正确用法是：**配上同字形同坐标的独立掩膜**再复跑，
// 独立审核的结论是这需要额外的 fixture；本脚本改为自包含生成同源栅格+掩膜，
// 覆盖同样的失败模式（纯黑/近黑/渐变）。
// DOM 级的真实反例由 scripts/contrast-dom-regressions.mjs 覆盖。

const selfContained = report.filter((r) => r.name.startsWith('自生成') || r.name.startsWith('渐变'))
if (selfContained.length < 6) {
  problems.push(`自包含用例只跑了 ${selfContained.length} 个，应为 6 个（四档深底 + 两档渐变）`)
}

await mkdir('screenshots/contrast', { recursive: true })
await writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: SOURCE,
      reviewerRasters: existsSync(REVIEWER_RASTERS) ? REVIEWER_RASTERS : null,
      note:
        '栅格与掩膜由同一个墨迹生成器产出（字形与坐标严格一致）。' +
        '复验方那批原始栅格不复跑：左右两半字形不同、纯黑底那侧又没有字形信息，' +
        '既拼不出也反推不出同坐标掩膜，配自造掩膜只会得到无意义的数字。',
      cases: report,
      problems,
      ok: problems.length === 0,
    },
    null,
    2
  )
)

console.log('=== 对比度算法边界回归 ===')
for (const row of report) {
  console.log(
    `  ${row.name.padEnd(26)} 真实最弱 ${row.expectedWorst}:1 → 算法报 ${row.reportedWorst}:1` +
      `  落点=${JSON.stringify(row.point)} 偏差=${row.deviation}` +
      (row.falsePass ? '  ✗ 假通过' : '  ✓')
  )
}
if (problems.length) {
  console.log('  不通过：\n' + problems.map((p) => '    - ' + p).join('\n'))
} else {
  console.log('  全部通过，无假通过')
}
console.log(`报告：${OUT}`)
process.exit(problems.length ? 1 : 0)
