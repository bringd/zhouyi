/**
 * 对比度算法的 **DOM 级回归**（第三轮独立审核逼出来的硬门禁）。
 *
 * 背景：`scripts/contrast-appearances.mjs` 的 canvas 自检只能证明
 * 「四档深色底的数值对」，证明不了真实 DOM 里没有假通过。
 * 独立审核（Codex，2026-11-02）用真实 DOM 构造出多条假通过路径，
 * 例如：`opacity:.65` 的黑字灰底，真实字芯对比度 2.92:1，脚本却报 4.67:1 判通过。
 *
 * 这个脚本把那些反例**固化成门禁**：从真实源文件里按函数名取出
 * `measureElement` / `analyzePair` 等真实实现（不重新实现被审算法），
 * 在临时页面上跑真实 DOM，按**期望结论**断言。
 *
 * 用法：node scripts/contrast-dom-regressions.mjs
 * 退出码：0 = 全部符合期望；1 = 有用例与期望不符（回归了）
 *
 * 环境：需要 Chrome CDP 在 9222、dev server 在 http://localhost:5173。
 */
import fs from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import WebSocket from 'file:///D:/eight/node_modules/ws/index.js'
import ts from 'typescript'
import { THRESHOLDS } from './shared-appearances-probe.mjs'

const SOURCE = 'scripts/contrast-appearances.mjs'
const CDP = process.env.DSH_CDP ?? 'http://127.0.0.1:9222'
const OUT = 'screenshots/contrast/contrast-dom-regressions.json'

/* --------------------------- CDP 辅助 --------------------------- */

async function connect(url) {
  const ws = new WebSocket(url)
  await new Promise((resolve, reject) => {
    ws.once('open', resolve)
    ws.once('error', reject)
  })
  let id = 0
  const pending = new Map()
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString())
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  return {
    ws,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const n = ++id
        const timer = setTimeout(() => {
          pending.delete(n)
          reject(new Error('CDP 超时：' + method))
        }, 60000)
        pending.set(n, (m) => {
          clearTimeout(timer)
          if (m.error) reject(new Error(JSON.stringify(m.error)))
          else resolve(m)
        })
        ws.send(JSON.stringify({ id: n, method, params }))
      })
    },
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function browserPage() {
  const version = await (await fetch(`${CDP}/json/version`)).json()
  const browser = await connect(version.webSocketDebuggerUrl)
  const { result } = await browser.send('Target.createTarget', { url: 'about:blank' })
  const pages = await (await fetch(`${CDP}/json/list`)).json()
  const page = pages.find((p) => p.id === result.targetId)
  if (!page) throw new Error('拿不到新建的 page target')
  const c = await connect(page.webSocketDebuggerUrl)
  const evaluate = async (expression) => {
    const r = await c.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (r.result?.exceptionDetails) {
      throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400))
    }
    return r.result?.result?.value
  }
  await c.send('Page.enable')
  await c.send('Runtime.enable')
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: 1000,
    height: 700,
    deviceScaleFactor: 1,
    mobile: false,
  })
  return {
    ...c,
    evaluate,
    async close() {
      try {
        await browser.send('Target.closeTarget', { targetId: result.targetId })
      } catch (e) {
        /* 忽略 */
      }
      c.ws.close()
      browser.ws.close()
    },
  }
}

/* --------------------- 从源文件里取真实实现 --------------------- */

const source = (await fs.readFile(SOURCE, 'utf8')).replace(/\r\n/g, '\n')
const ast = ts.createSourceFile('probe.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
function fn(name) {
  const decl = ast.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === name)
  if (!decl) throw new Error(`${SOURCE} 里找不到函数 ${name}`)
  return decl.getText(ast)
}

/* --------------------------- 用例 --------------------------- */

// 每个用例：name / css / content / opts / expect
// expect.status: 'measured' | 'not-covered'
// expect.maxRatio / expect.minRatio：实测对比度区间
// expect.ok：是否应当判通过
// expect.valueAfter：输入框测完后的值（必须是原值）
const FIXTURES = [
  {
    name: 'opacity-group',
    // 组透明度：元素连同自己的背景作为一组叠加到外层底色上。
    // 真实字芯 = 0.65*黑 + 0.35*白 = 88，背景 = 0.65*#777 + 0.35*白 = 166，
    // 真实对比度 2.92:1（远低于 4.5）。早期实现把组 opacity 又乘一次，
    // 算出 4.67:1 判通过。
    css: '#t{opacity:.65;color:black;background:#777;font-size:16px}',
    content: 'MMMM',
    expect: { status: 'measured', maxRatio: 3.2, ok: false },
  },
  {
    name: 'text-fill',
    // -webkit-text-fill-color 才是真正参与绘制的填充色：白字压白底 = 1:1。
    css: '#t{color:black;-webkit-text-fill-color:#fff;background:white}',
    content: 'MMMM',
    expect: { status: 'measured', maxRatio: 1.2, ok: false },
  },
  {
    name: 'pseudo-only',
    // 元素自己没有文字，只有 ::before 生成的内容：
    // 那不是元素自己的文本片段，不该被算成这个元素的文字落点。
    css: '#t{color:black;background:white}#t:before{content:"MMMM";color:white}',
    content: '',
    expect: { status: 'no-text' },
  },
  {
    name: 'pseudo-generated',
    // 正常黑字 + 一个白色 ::after：黑字本身是合格的（21:1）。
    css: '#t{color:#000;background:white}#t:after{content:"MMMM";color:#fff;display:inline-block;margin-left:10px}',
    content: 'MMMM',
    expect: { status: 'measured', minRatio: 15, ok: true },
  },
  {
    name: 'inline-important-background',
    // 内联 important 的黑底：掩膜的白底必须压过它，
    // 否则那段字在掩膜里消失，落点丢失 → 元素被别处的文字带过（假通过）。
    css: '#t{color:black;background:white}',
    content: 'MMMM<span style="background-color:black!important">MMMM</span>',
    expect: { status: 'measured', maxRatio: 1.2, ok: false },
  },
  {
    name: 'overlay-partial',
    // 右半被一层 10% 白 ::after 盖住：原画面上右半的字与底同样色（1:1），
    // 掩膜必须仍然认出那段字，否则会拿左半的高对比度判通过。
    css: '#t{background:linear-gradient(90deg,white 150px,black 150px);color:black}#t:after{content:"";position:absolute;top:0;right:0;bottom:0;left:150px;background:rgba(255,255,255,.1);pointer-events:none}',
    content: 'MMMMMMMMMMMMMMMMMMMM',
    expect: { status: 'measured', maxRatio: 4.5, ok: false },
  },
  {
    name: 'filter-descendant',
    // 后代带 filter:contrast(0)：字与底变成同一个灰。
    // 掩膜认不出那段字 → 取证不完整，不能算通过。
    css: '#t{color:black;background:white}#bad{background:white;filter:contrast(0)}',
    content: 'MMMM<span id="bad">MMMM</span>',
    // 被 filter 抹平的那段字在掩膜里认不出来 → 取证不完整，
    // 不能拿同一元素里另一段字的 16.56:1 当通过依据。
    expect: { status: 'measured', ok: false, minUncovered: 1 },
  },
  {
    name: 'svg-overlap-front-text',
    // 透明空 SVG 的框**不能**把框里的可见文字一起排除掉。
    css: '#t{isolation:isolate;color:black;background:linear-gradient(90deg,white 100px,black 100px)}svg{position:absolute;left:100px;top:0;width:500px;height:60px;z-index:0;pointer-events:none}',
    content: '<span style="position:relative;z-index:1">MMMMMMMMMMMMMMMMMMMM</span><svg></svg>',
    expect: { status: 'measured', maxRatio: 4.5, ok: false },
  },
  {
    name: 'gradient',
    // 普通双色渐变：右侧黑字压黑底 = 1:1，必须判失败。
    css: '#t{background:linear-gradient(90deg,white 50%,black 50%);color:black}',
    content: 'MMMMMMMMMMMMMMMMMMMMMMMM',
    expect: { status: 'measured', maxRatio: 1.2, ok: false },
  },
  {
    name: 'scaled',
    // transform:scale(.5) 之后实际呈现 16px（computed 仍是 32px），
    // 必须按正文 4.5:1 判，而不是按 32px 大字 3:1 放过去。
    css: '#t{transform:scale(.5);transform-origin:top left;color:#888;background:white;font-size:32px}',
    content: 'MMMM',
    expect: { status: 'measured', maxRatio: 4.5, ok: false, maxFontSize: 17 },
  },
  {
    name: 'opacity-target',
    // 目标自身 opacity:.2：判定值要按屏幕上真正画出来的颜色算。
    css: '#t{color:#000;background:#fff;opacity:.2}',
    content: 'MMMM',
    expect: { status: 'measured', maxRatio: 2.2, ok: false },
  },
  {
    name: 'input-existing-value',
    // 原本就有值的输入框：测完必须原样还原，不能被清空。
    css: '#t{color:black;background:white}',
    content: '',
    opts: { field: 'input', attrs: 'value="KEEP ME"' },
    expect: { status: 'measured', minRatio: 4.5, ok: true, valueAfter: 'KEEP ME' },
  },
  {
    name: 'scroll',
    // 页面滚动过：clip 必须换算到文档坐标，否则整块截空。
    css: '#t{margin-top:900px;color:black;background:white}',
    content: 'MMMM',
    opts: { scroll: 800 },
    expect: { status: 'measured', minRatio: 4.5, ok: true },
  },
]

/* --------------------------- 执行 --------------------------- */

const page = await browserPage()
const evidence = []
const problems = []
const results = []

const sendProxy = async (method, params) => {
  const r = await page.send(method, params)
  return r
}

try {
  const context = vm.createContext({
    evaluate: page.evaluate,
    send: sendProxy,
    sleep,
    console,
    Date,
    Math,
    JSON,
    Uint8Array,
    Uint16Array,
    Float32Array,
    Number,
    String,
    Object,
    Array,
    Error,
    Boolean,
    isFinite,
    parseInt,
    parseFloat,
    THRESHOLDS,
  })
  vm.runInContext(
    [
      'prepareTarget',
      'freezeScene',
      'freezeAnimations',
      'readState',
      'applyMask',
      'makeTransparent',
      'releaseTarget',
      'analyzePair',
      'measureElement',
    ]
      .map(fn)
      .join('\n'),
    context
  )

  for (const fixture of FIXTURES) {
    const opts = fixture.opts ?? {}
    const tag = opts.field || 'div'
    const html = `<!doctype html><style>body{margin:0;background:white}#parent{padding:30px}#t{position:relative;width:600px;height:65px;font:32px/60px Arial;white-space:nowrap;box-sizing:border-box}input,textarea{padding:0;border:0}${fixture.css}</style><div id="parent"><${tag} id="t" ${opts.attrs || ''}>${fixture.content}</${tag}></div>`
    await page.evaluate(`document.open();document.write(${JSON.stringify(html)});document.close();true`)
    if (opts.scroll) await page.evaluate(`scrollTo(0,${opts.scroll});true`)
    await sleep(120)

    let r = null
    let error = null
    try {
      r = await vm.runInContext(`measureElement('#t',0,'dom-${fixture.name}')`, context)
    } catch (e) {
      error = String(e.message ?? e)
    }
    const valueAfter = await page.evaluate(`document.querySelector('#t').value ?? null`)
    const row = {
      name: fixture.name,
      expect: fixture.expect,
      got: r
        ? {
            status: r.status,
            ratio: r.weakestRatio ?? null,
            ok: r.ok ?? null,
            need: r.need ?? null,
            uncoveredFragments: r.uncoveredFragments ?? null,
            failingFragments: r.failingFragments ?? null,
            unstable: r.unsettled === true || r.drift === true,
            fontSizes: (r.fragmentRows ?? []).map((f) => f.fontSize),
            fragmentRows: (r.fragmentRows ?? []).map((f) => ({
              text: f.text,
              ratio: f.ratio,
              need: f.need,
              ok: f.ok,
              covered: f.covered,
              inkCount: f.inkCount,
              coreCount: f.coreCount,
              fontSize: f.fontSize,
              fg: f.fg,
              bg: f.bg,
              point: f.point,
            })),
            text: r.text ?? null,
          }
        : null,
      valueAfter,
      error,
    }
    results.push(row)
    evidence.push({ ...row, html })

    if (error) {
      problems.push(`${fixture.name}: 测量抛错 ${error.slice(0, 160)}`)
      continue
    }
    const e = fixture.expect
    if (r.status !== e.status) {
      problems.push(
        `${fixture.name}: 状态应为 ${e.status}，实际 ${r.status}` +
          (r.status === 'measured' ? `（ratio=${r.weakestRatio}）` : '')
      )
      continue
    }
    if (e.status === 'measured') {
      if (e.ok !== undefined && r.ok !== e.ok) {
        problems.push(
          `${fixture.name}: 判定应为 ${e.ok ? '通过' : '失败'}，实际 ${r.ok ? '通过' : '失败'}（ratio=${r.weakestRatio}）`
        )
      }
      if (e.maxRatio !== undefined && !(r.weakestRatio !== null && r.weakestRatio <= e.maxRatio)) {
        problems.push(`${fixture.name}: 实测 ${r.weakestRatio}:1 应 <= ${e.maxRatio}:1`)
      }
      if (e.minRatio !== undefined && !(r.weakestRatio !== null && r.weakestRatio >= e.minRatio)) {
        problems.push(`${fixture.name}: 实测 ${r.weakestRatio}:1 应 >= ${e.minRatio}:1`)
      }
      if (e.maxFontSize !== undefined) {
        const sizes = (r.fragmentRows ?? []).map((f) => f.fontSize)
        if (sizes.some((s) => s > e.maxFontSize)) {
          problems.push(`${fixture.name}: 片段实际字号 ${JSON.stringify(sizes)} 应 <= ${e.maxFontSize}px`)
        }
      }
      if (e.minUncovered !== undefined && (r.uncoveredFragments ?? 0) < e.minUncovered) {
        problems.push(
          `${fixture.name}: 应至少 ${e.minUncovered} 段文字取证不完整，实际 ${r.uncoveredFragments ?? 0} 段`
        )
      }
    }
    if (e.valueAfter !== undefined && valueAfter !== e.valueAfter) {
      problems.push(`${fixture.name}: 测完后输入框值应为 ${JSON.stringify(e.valueAfter)}，实际 ${JSON.stringify(valueAfter)}`)
    }
  }
} finally {
  await page.close()
}

mkdirSync(path.dirname(OUT), { recursive: true })
await fs.writeFile(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      source: SOURCE,
      note: 'DOM 级回归：真实源文件的 measureElement/analyzePair 跑真实 DOM，按期望结论断言',
      results,
      problems,
      ok: problems.length === 0,
    },
    null,
    2
  )
)

console.log('=== 对比度算法 DOM 级回归 ===')
for (const row of results) {
  const g = row.got
  console.log(
    `  ${row.name.padEnd(28)} ${g ? `${g.status} ratio=${g.ratio} ok=${g.ok} need=${g.need}` : 'ERR ' + row.error}`
  )
}
if (problems.length) {
  console.log('  不通过：\n' + problems.map((p) => '    - ' + p).join('\n'))
} else {
  console.log(`  全部 ${results.length} 个用例符合期望`)
}
console.log(`报告：${OUT}`)
process.exit(problems.length ? 1 : 0)
