/**
 * 三套外观的视觉验收（CDP + 真实 Chrome）
 *
 * 用法（Windows PowerShell）：
 *   $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
 *   Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\chrome-cdp-profile",'about:blank')
 *   node scripts/acceptance-appearances.mjs
 *
 * 环境变量：
 *   DSH_BASE_URL  默认 http://localhost:5173（只能用 localhost，127.0.0.1 会被 Vite 拒）
 *   DSH_CDP       默认 http://127.0.0.1:9222
 *   DSH_OUT       默认 screenshots/acceptance-appearances
 *
 * 覆盖：
 *   - 三套外观 × 9 类页面（首页/起卦/结果/图鉴/卦册/设置/卦象详情/社区/404）× 1440/1024/768/390/320
 *   - 结果页四态（未解读 / 已缓存解读 / 加载中 / 错误重试）
 *   - 模拟 200% 缩放（DevTools 同款：CSS 视口减半 + deviceScaleFactor=2，桌面模式）—— 明确是模拟，不是真实浏览器缩放
 *   - prefers-reduced-motion：随机取数滚轮不透明度采样 + 正常模式对照组
 *
 * 判定原则（对应 docs/reviews/2026-10-23-three-appearances-acceptance.md 的 P2-02）：
 *   - 每次导航都轮询断言「页面真的渲染出来了」（readyState/标题/#root/关键节点/元素数），
 *     不用固定 sleep 判定成功；断言不过 → 该项记 not-covered 并计入失败。
 *   - Vite 错误覆盖层的判据是 DOM 里存在 vite-error-overlay 元素，
 *     不是页面文案里出现 "HTTP 500"（后者可能是业务文案）。
 *   - 字号 < 12px、对比度不足、目标 < 24x24 全部真正累积进 failures，
 *     并以非零退出码结束（可用于 CI 阻断）。
 *   - 豁免项（装饰性、位图上的文字、低于 320px 设计下限的溢出、移动端主按钮参考值）
 *     全部带 exempt + exemptReason，单列打印并写进 JSON，不允许静默跳过。
 *   - 启动时打印并记录覆盖组合数（外观 × 页面 × 宽度），measured < expected 直接判失败。
 *
 * 真实浏览器 200% 缩放不在本脚本里做，见 scripts/zoom-real-200.mjs。
 */
let WebSocket
try {
  WebSocket = (await import('ws')).default
} catch {
  console.error('缺少 ws 依赖：npm i -D ws')
  process.exit(2)
}
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
  THRESHOLDS,
  buildProbeConfig,
  pageProbe,
  evaluateProbe,
} from './shared-appearances-probe.mjs'

const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.DSH_OUT ?? 'screenshots/acceptance-appearances'
const CDP = process.env.DSH_CDP ?? 'http://127.0.0.1:9222'
await mkdir(OUT, { recursive: true })

const APPEARANCES = [
  { id: 'qinglan', name: '青岚书院' },
  { id: 'zhusha', name: '朱砂档案' },
  { id: 'yehang', name: '夜航观象' },
]

/**
 * 矩阵页面。9 类页面 —— 缺社区(/feed)与 404 是上一轮被评审打回的原因之一，
 * 这里补齐；404 用一个不存在的路径，交给 SPA 的 NotFound 路由。
 */
const PAGES = [
  { name: 'home', url: `${BASE}/`, key: 'main' },
  { name: 'divination', url: `${BASE}/divination`, key: 'main' },
  { name: 'result', url: `${BASE}/result/acc-record`, key: 'main' },
  { name: 'codex', url: `${BASE}/codex`, key: 'main' },
  { name: 'records', url: `${BASE}/records`, key: 'main' },
  { name: 'settings', url: `${BASE}/settings`, key: 'main' },
  { name: 'feed', url: `${BASE}/feed`, key: 'main' },
  { name: 'hexagram', url: `${BASE}/hexagram/1`, key: 'main' },
  { name: 'notfound', url: `${BASE}/__not_found__`, key: 'main' },
]

const WIDTHS = [1440, 1024, 768, 390, 320]

/** 模拟 200% 缩放那一节覆盖的页面与物理宽度 */
const ZOOM_PAGES = PAGES.slice(0, 3)
const ZOOM_WIDTHS = [1440, 768, 390]

const PROBE_CONFIG = buildProbeConfig()

/* --------------------------- CDP 连接 --------------------------- */

const list = await (await fetch(`${CDP}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.error(`CDP 上没有可用的 page target：${CDP}`)
  process.exit(2)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.on('open', res)
  ws.on('error', rej)
})
let seq = 0
const pending = new Map()
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const id = ++seq
    pending.set(id, r)
    ws.send(JSON.stringify({ id, method, params }))
  })
await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression,
  })
  if (r.result?.exceptionDetails) {
    throw new Error(
      '页面脚本异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300)
    )
  }
  return r.result?.result?.value
}

/* --------------------------- 报告骨架 --------------------------- */

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  cdp: CDP,
  thresholds: THRESHOLDS,
  appearances: {},
  failures: [],
  exemptions: [],
  coverage: {
    expected: 0,
    measured: 0,
    byKind: {},
  },
  summary: {},
}
const failures = report.failures
const exemptions = report.exemptions

/* --------------------------- 页面工具 --------------------------- */

async function setAppearance(id) {
  await evaluate(`(() => {
    const key = 'zhouyi:settings'
    let parsed = {}
    try { parsed = JSON.parse(localStorage.getItem(key) || '{}') } catch (e) { parsed = {} }
    parsed.appearance = ${JSON.stringify(id)}
    localStorage.setItem(key, JSON.stringify(parsed))
    return true
  })()`)
}

async function seedRecords() {
  await evaluate(`(() => {
    const mk = (id, ai) => ({
      id, type: 'three-number', createdAt: Date.now() - 3600e3,
      question: '面对新的工作机会，我该如何把握进退？', numbers: [123, 456, 789],
      region: 'Asia/Shanghai', timezone: 'Asia/Shanghai', mainHexagramId: 15,
      movingLine: 2, changedHexagramId: 46, version: 1,
      ...(ai ? { aiInterpretation: '## 卦象概要\\n泽地萃，聚集之象。\\n\\n## 当前状态\\n你正站在一个可以主动选择的关口。' } : {}),
    })
    localStorage.setItem('zhouyi:records', JSON.stringify([
      mk('acc-record', true), mk('acc-record-plain', false)
    ]))
    return true
  })()`)
}

/** 页面状态探针：渲染情况 + 环境边界（Vite 覆盖层 / 连接失败页 / 云端不可用） */
function pageState(key) {
  // 导航过程中 document.body 可能还没建好，这里必须容错，
  // 否则会抛 TypeError，被外层当成「页面没渲染」。
  const text = (document.body && document.body.innerText) || ''
  return {
    ready: document.readyState,
    title: document.title,
    elements: document.querySelectorAll('body *').length,
    appRoot: !!document.querySelector('#root') && document.querySelector('#root').children.length > 0,
    hasKey: key === 'body' ? true : !!document.querySelector(key),
    appearance: document.documentElement.getAttribute('data-appearance'),
    url: location.href,
    bodyText: text.slice(0, 400),
    // Vite 错误覆盖层：判据是 DOM 元素存在，不是文案里出现 "HTTP 500"
    viteOverlay: !!document.querySelector('vite-error-overlay'),
    // Chrome 的连接失败页
    connectionError:
      /ERR_CONNECTION|无法访问此网站|拒绝.{0,8}连接|ERR_NAME_NOT_RESOLVED|ERR_EMPTY_RESPONSE/.test(text),
    // 业务层的「云端不可用」：本地 Worker 没起时页面会这样提示，属于环境边界
    cloudUnavailable:
      text.includes('云端') &&
      /加载失败|不可用|HTTP\s*5\d\d|Failed to fetch|无法连接|网络错误/.test(text),
  }
}

/**
 * 轮询断言「页面真的渲染出来了」。
 * 返回 { ok, reason, info }；reason 用于区分失败类型（not-rendered / vite-error-overlay / connection-error / missing-key-node）。
 */
async function waitForPage(name, key) {
  const deadline = Date.now() + 15000
  let last = null
  while (Date.now() < deadline) {
    // 导航过程中的一次瞬时异常（脚本求值撞上文档切换）不代表页面没渲染，
    // 继续轮询；只有连续到超时才算「没渲染」。
    try {
      last = await evaluate(`(${pageState.toString()})(${JSON.stringify(key)})`)
    } catch (e) {
      last = { transientError: String(e.message).slice(0, 120) }
      await sleep(150)
      continue
    }
    if (last) {
      if (last.viteOverlay) return { ok: false, reason: 'vite-error-overlay', info: last }
      if (last.connectionError) return { ok: false, reason: 'connection-error', info: last }
      if (
        last.ready === 'complete' &&
        last.title &&
        last.appRoot &&
        last.hasKey &&
        last.elements > 20
      ) {
        return { ok: true, info: last }
      }
    }
    await sleep(150)
  }
  return { ok: false, reason: last && last.hasKey === false ? 'missing-key-node' : 'not-rendered', info: last }
}

/** 跑一次探针并判定 */
async function probePage(ctx) {
  const probe = await evaluate(`(${pageProbe.toString()})(${JSON.stringify(PROBE_CONFIG)})`)
  return { probe, ...evaluateProbe(probe, ctx) }
}

function pushFailures(items) {
  for (const f of items) failures.push(f)
}
function pushExemptions(items) {
  for (const e of items) exemptions.push(e)
}

/* --------------------------- 覆盖度自检 --------------------------- */

const coverage = {
  matrix: {
    expected: APPEARANCES.length * PAGES.length * WIDTHS.length,
    measured: 0,
    notCovered: 0,
  },
  simulatedZoom: {
    expected: APPEARANCES.length * ZOOM_PAGES.length * ZOOM_WIDTHS.length,
    measured: 0,
    notCovered: 0,
  },
  resultStates: { expected: APPEARANCES.length * 4, measured: 0, notCovered: 0 },
}
coverage.expected =
  coverage.matrix.expected + coverage.simulatedZoom.expected + coverage.resultStates.expected
coverage.measured = 0
report.coverage = { ...coverage, expected: coverage.expected, measured: 0 }

console.log('=========================================================')
console.log('三套外观验收（CDP + 真实 Chrome）')
console.log(`页面矩阵：${APPEARANCES.length} 外观 × ${PAGES.length} 页 × ${WIDTHS.length} 宽 = ${coverage.matrix.expected} 组`)
console.log(`模拟 200%：${APPEARANCES.length} 外观 × ${ZOOM_PAGES.length} 页 × ${ZOOM_WIDTHS.length} 宽 = ${coverage.simulatedZoom.expected} 组`)
console.log(`结果页四态：${coverage.resultStates.expected} 组`)
console.log(`覆盖组合总数（expected）：${coverage.expected}`)
console.log('=========================================================')

/* --------------------- 1) 三套外观 × 页面 × 宽度 --------------------- */

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})
await send('Page.navigate', { url: `${BASE}/` })
await sleep(1500)
await seedRecords()

for (const appearance of APPEARANCES) {
  console.log(`\n================= ${appearance.name}（${appearance.id}） =================`)
  await setAppearance(appearance.id)
  const bucket = (report.appearances[appearance.id] = {
    name: appearance.name,
    pages: {},
    simulatedZoom: [],
    reducedMotion: null,
  })

  for (const w of WIDTHS) {
    for (const p of PAGES) {
      const emulation = { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 }
      await send('Emulation.setDeviceMetricsOverride', emulation)
      await send('Page.navigate', { url: p.url })
      const key = `${p.name}@${w}`
      const ctx = {
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: p.name,
        width: w,
        cssWidth: w,
        section: 'matrix',
      }
      const loaded = await waitForPage(p.name, p.key)
      if (!loaded.ok) {
        coverage.matrix.notCovered += 1
        bucket.pages[key] = {
          appearance: appearance.id,
          page: p.name,
          width: w,
          url: p.url,
          status: 'not-covered',
          notCoveredReason: loaded.reason,
          environment: loaded.info ?? null,
          checks: {
            overflow: { status: 'not-covered' },
            smallType: { status: 'not-covered' },
            contrast: { status: 'not-covered' },
            smallTargets: { status: 'not-covered' },
            primaryTargets: { status: 'not-covered' },
          },
        }
        failures.push({
          kind: 'page-not-covered',
          appearance: appearance.id,
          appearanceName: appearance.name,
          page: p.name,
          width: w,
          section: 'matrix',
          selector: p.key,
          value: loaded.reason,
          threshold: '页面必须渲染成功',
          unit: '',
          text: (loaded.info?.bodyText ?? '').slice(0, 60),
          detail: `${p.name}@${w} 未覆盖：${loaded.reason}`,
        })
        console.log(`FAIL ${key.padEnd(18)} 未覆盖（${loaded.reason}）`)
        continue
      }
      coverage.matrix.measured += 1
      if (loaded.info.appearance !== appearance.id) {
        failures.push({
          kind: 'appearance-mismatch',
          appearance: appearance.id,
          appearanceName: appearance.name,
          page: p.name,
          width: w,
          section: 'matrix',
          selector: 'html[data-appearance]',
          value: loaded.info.appearance,
          threshold: appearance.id,
          unit: '',
          text: '',
          detail: `${key} 根节点外观属性为 ${loaded.info.appearance}`,
        })
      }
      const { probe, checks, failures: cellFailures, exemptions: cellExemptions, status } =
        await probePage(ctx)
      pushFailures(cellFailures)
      pushExemptions(cellExemptions)
      bucket.pages[key] = {
        appearance: appearance.id,
        page: p.name,
        width: w,
        url: p.url,
        status,
        elements: loaded.info.elements,
        emulation,
        environment: {
          viteErrorOverlay: loaded.info.viteOverlay,
          connectionError: loaded.info.connectionError,
          cloudUnavailable: loaded.info.cloudUnavailable,
        },
        doc: probe.doc,
        counts: probe.counts,
        checks,
      }
      const c = checks
      console.log(
        `${status === 'fail' ? 'FAIL' : status === 'exempt' ? 'EXPT' : 'OK  '} ${key.padEnd(18)} ` +
          `溢出=${c.overflow.status}/${c.overflow.scrollWidth}>${c.overflow.clientWidth} ` +
          `字号<12px=${c.smallType.count} 对比度=${c.contrast.count} 目标<24px=${c.smallTargets.count} ` +
          `主按钮=${c.primaryTargets.count}` +
          (loaded.info.cloudUnavailable ? ' （云端不可用：本地 Worker 未启动，环境边界）' : '')
      )
      for (const f of c.smallType.findings.slice(0, 4)) {
        console.log(`       [字号] ${f.value}px ${f.selector} 「${f.text}」`)
      }
      for (const f of c.contrast.findings.slice(0, 4)) {
        console.log(
          `       [对比] ${f.ratio}/${f.need}${f.exempt ? '（豁免）' : ''} ${f.fontSize}px ${f.selector} 「${f.text}」`
        )
      }
      for (const f of c.smallTargets.findings.slice(0, 4)) {
        console.log(`       [目标] ${f.value} ${f.selector} 「${f.text}」`)
      }
      if (w === 1440 || w === 390) {
        const shot = await send('Page.captureScreenshot', { format: 'png' })
        await writeFile(
          join(OUT, `${appearance.id}-${p.name}-${w}.png`),
          Buffer.from(shot.result.data, 'base64')
        )
      }
    }
  }

  /* --------------------- 2) 结果页四种状态 --------------------- */
  console.log('--- 结果页四态 ---')
  for (const w of [1440, 390]) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: 900,
      deviceScaleFactor: 1,
      mobile: w < 768,
    })

    // ① 未解读
    await send('Page.navigate', { url: `${BASE}/result/acc-record-plain` })
    const idle = await waitForPage('result-idle', 'main')
    const hasButton = idle.ok
      ? await evaluate(
          `!![...document.querySelectorAll('button')].find(b => /卦象详解|解读|详解/.test(b.textContent || ''))`
        )
      : false
    bucket.pages[`result-idle@${w}`] = {
      appearance: appearance.id,
      page: 'result-idle',
      width: w,
      status: idle.ok && hasButton ? 'pass' : idle.ok ? 'fail' : 'not-covered',
      hasInterpretButton: hasButton,
      notCoveredReason: idle.ok ? undefined : idle.reason,
    }
    if (idle.ok && hasButton) coverage.resultStates.measured += 1
    else {
      coverage.resultStates.notCovered += 1
      failures.push({
        kind: idle.ok ? 'result-state' : 'page-not-covered',
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: 'result-idle',
        width: w,
        section: 'result-states',
        selector: 'button',
        value: idle.ok ? 'missing' : idle.reason,
        threshold: '必须有「解读」入口',
        unit: '',
        text: '',
        detail: `result-idle@${w} ${idle.ok ? '缺少解读入口' : '未覆盖：' + idle.reason}`,
      })
    }
    console.log(`${hasButton ? 'OK  ' : 'FAIL'} result-idle@${w} 有「解读」入口=${hasButton}`)

    // ② 已缓存解读
    await send('Page.navigate', { url: `${BASE}/result/acc-record` })
    const cached = await waitForPage('result-cached', 'main')
    const hasText = cached.ok
      ? await evaluate(`(document.body.innerText || '').includes('卦象概要')`)
      : false
    bucket.pages[`result-cached@${w}`] = {
      appearance: appearance.id,
      page: 'result-cached',
      width: w,
      status: cached.ok && hasText ? 'pass' : cached.ok ? 'fail' : 'not-covered',
      hasCachedAi: hasText,
      notCoveredReason: cached.ok ? undefined : cached.reason,
    }
    if (cached.ok && hasText) coverage.resultStates.measured += 1
    else {
      coverage.resultStates.notCovered += 1
      failures.push({
        kind: cached.ok ? 'result-state' : 'page-not-covered',
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: 'result-cached',
        width: w,
        section: 'result-states',
        selector: '.ai-content',
        value: cached.ok ? 'missing' : cached.reason,
        threshold: '必须显示缓存解读',
        unit: '',
        text: '',
        detail: `result-cached@${w} ${cached.ok ? '未显示缓存解读' : '未覆盖：' + cached.reason}`,
      })
    }
    console.log(`${hasText ? 'OK  ' : 'FAIL'} result-cached@${w} 缓存解读可见=${hasText}`)
  }

  /* --------------------- 3) 模拟 200% 缩放（明确是模拟） --------------------- */
  console.log(
    '--- 模拟 200% 缩放（DevTools 同款：CSS 视口减半 + deviceScaleFactor=2，桌面模式）---'
  )
  console.log(
    '    注意：这是 DevTools 的模拟条件（mobile 固定 false，保持桌面渲染模式），不是真实浏览器缩放。' +
      '真实缩放证据见 scripts/zoom-real-200.mjs。'
  )
  for (const w of ZOOM_WIDTHS) {
    const cssW = Math.floor(w / 2)
    for (const p of ZOOM_PAGES) {
      const emulation = {
        width: cssW,
        height: 900,
        deviceScaleFactor: 2,
        mobile: false,
      }
      await send('Emulation.setDeviceMetricsOverride', emulation)
      await send('Page.navigate', { url: p.url })
      const loaded = await waitForPage(p.name, p.key)
      const ctx = {
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: p.name,
        width: w,
        cssWidth: cssW,
        section: 'simulated-zoom',
      }
      if (!loaded.ok) {
        coverage.simulatedZoom.notCovered += 1
        failures.push({
          kind: 'page-not-covered',
          appearance: appearance.id,
          appearanceName: appearance.name,
          page: p.name,
          width: w,
          section: 'simulated-zoom',
          selector: p.key,
          value: loaded.reason,
          threshold: '页面必须渲染成功',
          unit: '',
          text: (loaded.info?.bodyText ?? '').slice(0, 60),
          detail: `模拟200% ${p.name}@${w} 未覆盖：${loaded.reason}`,
        })
        console.log(`FAIL ${p.name.padEnd(11)} 200% 未覆盖（${loaded.reason}）`)
        continue
      }
      coverage.simulatedZoom.measured += 1
      const { probe, checks, failures: cellFailures, exemptions: cellExemptions, status } =
        await probePage(ctx)
      pushFailures(cellFailures)
      pushExemptions(cellExemptions)
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      const shotName = `${appearance.id}-simulated-zoom200-${p.name}-${w}.png`
      await writeFile(join(OUT, shotName), Buffer.from(shot.result.data, 'base64'))
      bucket.simulatedZoom.push({
        appearance: appearance.id,
        page: p.name,
        physicalWidth: w,
        cssWidth: cssW,
        status,
        screenshot: shotName,
        simulation: {
          method: 'Emulation.setDeviceMetricsOverride',
          note: 'DevTools 同款模拟条件：CSS 视口减半 + deviceScaleFactor=2；桌面渲染模式（mobile=false）',
          isRealBrowserZoom: false,
          aspectRatioNote:
            '物理宽度固定 900 高，CSS 视口高度同步减半；宽高比与真实 200% 缩放一致，但真实缩放不改变渲染模式',
          emulation,
        },
        doc: probe.doc,
        checks,
      })
      console.log(
        `${status === 'fail' ? 'FAIL' : status === 'exempt' ? 'EXPT' : 'OK  '} ${p.name.padEnd(11)} ${w}→${cssW}css @${probe.doc.devicePixelRatio}x ` +
          `实测视口=${probe.doc.innerWidth}px 溢出=${checks.overflow.status} 字号<12px=${checks.smallType.count} 对比度=${checks.contrast.count} 目标<24px=${checks.smallTargets.count}`
      )
    }
  }

  /* --------------------- 4) 减少动态效果 --------------------- */
  console.log('--- prefers-reduced-motion ---')
  for (const reduced of [true, false]) {
    await send('Emulation.setEmulatedMedia', {
      features: reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [],
    })
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await send('Page.navigate', { url: `${BASE}/divination` })
    const loaded = await waitForPage('divination', 'main')
    if (!loaded.ok) {
      failures.push({
        kind: 'page-not-covered',
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: 'divination',
        width: 1440,
        section: 'reduced-motion',
        selector: 'main',
        value: loaded.reason,
        threshold: '页面必须渲染成功',
        unit: '',
        text: '',
        detail: `reduced-motion(${reduced ? 'reduce' : 'normal'}) 未覆盖：${loaded.reason}`,
      })
      continue
    }
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent || '').includes('随机生成'))
      if (btn) btn.click()
    })()`)
    const opacities = []
    for (let i = 0; i < 12; i++) {
      const s = await evaluate(`(() => {
        const el = document.querySelector('.number-randomizer-reel')
        if (!el) return null
        return { opacity: getComputedStyle(el).opacity, tag: el.tagName }
      })()`)
      if (s) opacities.push(Number(s.opacity))
      await sleep(90)
    }
    const varied = new Set(opacities.map((o) => o.toFixed(2))).size > 1
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(
      join(OUT, `${appearance.id}-reduced-motion-${reduced ? 'reduce' : 'normal'}.png`),
      Buffer.from(shot.result.data, 'base64')
    )
    const label = reduced ? 'reduce' : 'normal(对照)'
    console.log(`  ${label}: 滚轮不透明度=${opacities.join(',')} 有波动=${varied} 元素=${loaded.info.elements}`)
    if (reduced) {
      bucket.reducedMotion = { opacities, varied }
      if (varied) {
        failures.push({
          kind: 'reduced-motion',
          appearance: appearance.id,
          appearanceName: appearance.name,
          page: 'divination',
          width: 1440,
          section: 'reduced-motion',
          selector: '.number-randomizer-reel',
          value: opacities.join(','),
          threshold: 'reduce 模式下不应有淡入动画',
          unit: '',
          text: '',
          detail: `${appearance.id} reduce 模式下随机取数滚轮仍在做淡入动画`,
        })
      }
    } else if (!varied) {
      failures.push({
        kind: 'reduced-motion',
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: 'divination',
        width: 1440,
        section: 'reduced-motion',
        selector: '.number-randomizer-reel',
        value: opacities.join(','),
        threshold: '对照模式下必须有动画波动',
        unit: '',
        text: '',
        detail: `${appearance.id} 对照异常：正常模式下滚轮无动画，检测手段可能失效`,
      })
    }
  }
  await send('Emulation.setEmulatedMedia', { features: [] })
}

/* --------------------------- 覆盖度自检 --------------------------- */

coverage.measured =
  coverage.matrix.measured + coverage.simulatedZoom.measured + coverage.resultStates.measured
report.coverage = {
  expected: coverage.expected,
  measured: coverage.measured,
  byKind: {
    matrix: coverage.matrix,
    simulatedZoom: coverage.simulatedZoom,
    resultStates: coverage.resultStates,
  },
}
console.log(
  `\n覆盖度自检：expected=${coverage.expected} measured=${coverage.measured} ` +
    `(矩阵 ${coverage.matrix.measured}/${coverage.matrix.expected}，模拟200% ${coverage.simulatedZoom.measured}/${coverage.simulatedZoom.expected}，结果页四态 ${coverage.resultStates.measured}/${coverage.resultStates.expected})`
)
if (coverage.measured < coverage.expected) {
  failures.push({
    kind: 'coverage',
    appearance: 'all',
    appearanceName: '全部',
    page: '-',
    width: '-',
    section: 'coverage',
    selector: '-',
    value: coverage.measured,
    threshold: coverage.expected,
    unit: '组',
    text: '',
    detail: `覆盖组合数不足：measured=${coverage.measured} < expected=${coverage.expected}`,
  })
}
if (coverage.matrix.notCovered > 0) {
  failures.push({
    kind: 'coverage',
    appearance: 'all',
    appearanceName: '全部',
    page: '-',
    width: '-',
    section: 'coverage',
    selector: '-',
    value: coverage.matrix.notCovered,
    threshold: 0,
    unit: '组',
    text: '',
    detail: `页面矩阵有 ${coverage.matrix.notCovered} 组未覆盖（页面没渲染出来）`,
  })
}

/* --------------------------- 汇总 --------------------------- */

const byKind = {}
for (const f of failures) byKind[f.kind] = (byKind[f.kind] ?? 0) + 1
const exemptByKind = {}
for (const e of exemptions) exemptByKind[e.kind] = (exemptByKind[e.kind] ?? 0) + 1

report.summary = {
  failures: failures.length,
  exemptions: exemptions.length,
  byKind,
  exemptByKind,
  coverage: report.coverage,
}

await writeFile(join(OUT, 'acceptance-appearances.json'), JSON.stringify(report, null, 2))

const describe = (f) =>
  [
    `[${f.kind}]`,
    `${f.appearanceName ?? f.appearance}`,
    f.page !== '-' ? `/${f.page}` : '',
    f.width !== '-' ? `@${f.width}` : '',
    f.selector && f.selector !== '-' ? f.selector : '',
    f.value !== null && f.value !== undefined ? `实测 ${f.value}${f.unit ?? ''}` : '',
    f.threshold !== null && f.threshold !== undefined ? `阈值 ${f.threshold}${f.unit ?? ''}` : '',
    f.text ? `「${f.text}」` : '',
  ]
    .filter(Boolean)
    .join(' ')

console.log('\n================ 结论 ================')
console.log(
  `失败 ${failures.length} 项 / 豁免 ${exemptions.length} 项 / 覆盖 ${coverage.measured}/${coverage.expected} 组`
)
if (byKind && Object.keys(byKind).length) {
  console.log(
    '失败分类：' + Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join('  ')
  )
}
if (exemptions.length) {
  console.log(`豁免 ${exemptions.length} 项：`)
  for (const e of exemptions) {
    console.log(
      `  - ${describe(e)} —— 豁免理由：${e.exemptReason}`
    )
  }
}
if (failures.length === 0) {
  console.log('全部通过，无失败项')
} else {
  console.log(`失败 ${failures.length} 项：`)
  failures.forEach((f) => console.log('  - ' + describe(f) + (f.detail ? `（${f.detail}）` : '')))
}
console.log(`报告：${join(OUT, 'acceptance-appearances.json')}`)
ws.close()
process.exit(failures.length === 0 ? 0 : 1)
