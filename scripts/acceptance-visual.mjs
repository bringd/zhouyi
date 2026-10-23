/**
 * 视觉验收脚本：跨页面 / 200% 缩放 / pinch 缩放 / 减少动态效果
 *
 * 用法（Windows PowerShell）：
 *   # 1) 起 Vite
 *   npm run dev
 *   # 2) 起带调试端口的 Chrome
 *   $chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
 *   Start-Process $chrome -ArgumentList @('--headless=new','--disable-gpu','--remote-debugging-port=9222',"--user-data-dir=$env:TEMP\chrome-cdp-profile",'about:blank')
 *   # 3) 跑验收
 *   node scripts/acceptance-visual.mjs
 *
 * 环境变量：
 *   DSH_BASE_URL  默认 http://localhost:5173
 *   DSH_CDP       默认 http://127.0.0.1:9222
 *   DSH_OUT       默认 screenshots/acceptance
 *
 * 关键设计（针对「验收证据无效」的复核意见）：
 *   - 每次导航后先断言页面真的加载成功（readyState / 标题 / 关键节点 / 元素数 /
 *     无「拒绝连接」字样），断言不通过就记失败并跳过该项测量，
 *     绝不会把连接失败输出成「无溢出」。
 *   - 200% 缩放用浏览器缩放的等价实现：CSS 视口减半 + deviceScaleFactor=2；
 *     另跑一轮 pinch 缩放（setPageScaleFactor）看视觉放大。
 *   - 减少动态效果除了查 CSS 动画，还采样随机取数滚轮的不透明度序列，
 *     并跑一次「正常模式」对照组，确保这条断言有能力失败。
 */
let WebSocket
try {
  WebSocket = (await import('ws')).default
} catch {
  console.error('缺少 ws 依赖：npm i -D ws')
  process.exit(2)
}
import { writeFile, mkdir } from 'node:fs/promises'

const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.DSH_OUT ?? 'screenshots/acceptance'
await mkdir(OUT, { recursive: true })

const list = await (await fetch((process.env.DSH_CDP ?? 'http://127.0.0.1:9222') + '/json/list')).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej) })
let seq = 0
const pending = new Map()
ws.on('message', (raw) => { const m = JSON.parse(raw.toString()); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })) })
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await send('Network.setCacheDisabled', { cacheDisabled: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const evaluate = async (expression, awaitPromise = false) => {
  const r = await send('Runtime.evaluate', { returnByValue: true, awaitPromise, expression })
  if (r.result?.exceptionDetails) throw new Error('页面脚本异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  return r.result?.result?.value
}

const PAGES = [
  { name: 'home', url: `${BASE}/`, key: '.home-hero' },
  { name: 'divination', url: `${BASE}/divination`, key: '.divination-form' },
  { name: 'result', url: `${BASE}/result/shot-1`, key: '.result-layout' },
  { name: 'codex', url: `${BASE}/codex`, key: 'main' },
  { name: 'records', url: `${BASE}/records`, key: 'body' },
  { name: 'feed', url: `${BASE}/feed`, key: 'body' },
  { name: 'settings', url: `${BASE}/settings`, key: 'body' },
  { name: 'hexagram', url: `${BASE}/hexagram/1`, key: 'body' },
]

// 预置一条卦册记录，供 /result/:id 渲染
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${BASE}/` })
await sleep(2000)
await evaluate(`(() => {
  const rec = { id: 'shot-1', type: 'three-number', createdAt: Date.now() - 3600e3,
    question: '面对新的工作机会，我该如何把握进退？', numbers: [123, 456, 789],
    region: 'Asia/Shanghai', timezone: 'Asia/Shanghai', mainHexagramId: 15,
    movingLine: 2, changedHexagramId: 46, version: 1 }
  localStorage.setItem('zhouyi:records', JSON.stringify([rec]))
})()`)

const report = { generatedAt: new Date().toISOString(), pages: {}, zoom: [], reducedMotion: null }
const failures = []

/** 断言页面真的加载成功 */
async function assertLoaded(name, url, key) {
  const h = await evaluate(`(() => ({
    ready: document.readyState,
    title: document.title,
    elements: document.querySelectorAll('body *').length,
    hasKey: ${JSON.stringify(key)} === 'body' ? true : !!document.querySelector(${JSON.stringify(key)}),
    bodyText: document.body.innerText.slice(0, 400),
    url: location.href
  }))()`)
  const errPage = /ERR_CONNECTION|无法访问此网站|拒绝.{0,4}连接/.test(h.bodyText)
  if (errPage) throw new Error(`[${name}] 加载失败：连接被拒绝（${url}）`)
  if (h.ready !== 'complete') throw new Error(`[${name}] 文档未加载完成：${h.ready}`)
  if (!h.title) throw new Error(`[${name}] 标题为空：${url}`)
  if (!h.hasKey) throw new Error(`[${name}] 关键节点 ${key} 不存在，判定为未渲染：${url}`)
  if (h.elements < 30) throw new Error(`[${name}] 元素过少（${h.elements}），判定为未渲染：${url}`)
  return h
}

const PROBE = `(() => {
  const px = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lum = ({r,g,b}) => { const f = (v) => { v/=255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4) }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b) }
  const ratio = (a,b) => { const l1=lum(a), l2=lum(b); const hi=Math.max(l1,l2), lo=Math.min(l1,l2); return (hi+0.05)/(lo+0.05) }
  const bgOf = (el) => { let n = el; while (n && n !== document.documentElement) { const c = px(getComputedStyle(n).backgroundColor); if (c && c.a > 0.95) return c; n = n.parentElement } return px(getComputedStyle(document.body).backgroundColor) || {r:255,g:255,b:255,a:1} }
  const hidden = (el) => { let n = el; while (n && n !== document.body) { if (n.getAttribute && n.getAttribute('aria-hidden') === 'true') return true; n = n.parentElement } return false }
  const contrast = [], smallType = [], smallTargets = []
  document.querySelectorAll('body *').forEach((el) => {
    const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') return
    const size = parseFloat(cs.fontSize)
    if (hasText && size < 12 && !hidden(el)) smallType.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\\s+/)[0], size, text: el.textContent.trim().slice(0, 14) })
    if (hasText && !hidden(el)) {
      const fg = px(cs.color)
      if (fg && fg.a >= 0.3) {
        const bg = bgOf(el); const weight = parseInt(cs.fontWeight) || 400
        const large = size >= 24 || (size >= 18.66 && weight >= 700)
        const need = large ? 3 : 4.5
        const cr = ratio(fg, bg)
        if (cr < need) contrast.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\\s+/)[0], size, cr: Math.round(cr*100)/100, need, text: el.textContent.trim().replace(/\\s+/g,' ').slice(0,16) })
      }
    }
    if (el.matches('a, button, [role="button"], input, select, textarea, summary') && !hidden(el)) {
      if (r.width < 24 || r.height < 24) smallTargets.push({ sel: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\\s+/)[0], w: Math.round(r.width), h: Math.round(r.height), text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 14) })
    }
  })
  const de = document.documentElement
  return { overflowX: de.scrollWidth > de.clientWidth, scrollW: de.scrollWidth, clientW: de.clientWidth, contrast, smallType, smallTargets }
})()`

/* ---------------- 1) 各页面 × 各宽度 ---------------- */
for (const w of [1440, 768, 390, 320]) {
  for (const p of PAGES) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 })
    await send('Page.navigate', { url: p.url })
    await sleep(2600)
    let loaded
    try {
      loaded = await assertLoaded(p.name, p.url, p.key)
    } catch (e) {
      failures.push(String(e.message))
      console.log(`FAIL ${p.name}@${w} — ${e.message}`)
      continue
    }
    const v = await evaluate(PROBE)
    const key = `${p.name}@${w}`
    report.pages[key] = { loaded: { elements: loaded.elements, title: loaded.title }, ...v }
    console.log(`${v.overflowX ? 'FAIL' : 'OK  '} ${key.padEnd(18)} 溢出=${v.overflowX} 对比度不足=${v.contrast.length} <12px=${v.smallType.length} 目标过小=${v.smallTargets.length}`)
    v.contrast.forEach((x) => console.log(`       [对比] ${x.cr}/${x.need} ${x.size}px ${x.sel} "${x.text}"`))
    v.smallType.forEach((x) => console.log(`       [字号] ${x.size}px ${x.sel} "${x.text}"`))
    v.smallTargets.forEach((x) => console.log(`       [目标] ${x.w}x${x.h} ${x.sel} "${x.text}"`))
    if (v.overflowX) failures.push(`${key} 出现横向溢出`)
  }
}

/* ---------------- 2) 浏览器 200% 缩放 ---------------- */
console.log('\n=== 浏览器 200% 缩放（CSS 视口减半 + 渲染倍率 2，DevTools 同款实现） ===')
for (const w of [1440, 768, 390]) {
  const cssW = Math.floor(w / 2)
  for (const p of PAGES.slice(0, 5)) {
    await send('Emulation.setDeviceMetricsOverride', { width: cssW, height: 900, deviceScaleFactor: 2, mobile: cssW < 768 })
    await send('Page.navigate', { url: p.url })
    await sleep(2600)
    let loaded
    try { loaded = await assertLoaded(p.name, p.url, p.key) } catch (e) { failures.push(String(e.message)); console.log(`FAIL ${p.name} 缩放 — ${e.message}`); continue }
    const v = await evaluate(`(() => { const de = document.documentElement; return { overflowX: de.scrollWidth > de.clientWidth, scrollW: de.scrollWidth, clientW: de.clientWidth, dpr: devicePixelRatio, innerW: innerWidth } })()`)
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await writeFile(`${OUT}/zoom200-${p.name}-${w}.png`, Buffer.from(shot.result.data, 'base64'))
    const belowFloor = cssW < 320
    const ok = !v.overflowX || belowFloor
    if (!ok) failures.push(`${p.name}@200%(${w}) 出现横向溢出`)
    if (belowFloor) console.log(`     （${cssW}css < 320px 设计下限，按设计下限验收，不判定失败）`)
    report.zoom.push({ page: p.name, viewport: w, cssWidth: cssW, dpr: v.dpr, overflowX: v.overflowX, elements: loaded.elements })
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${p.name.padEnd(11)} ${w}→${cssW}css @${v.dpr}x  溢出=${v.overflowX}  元素=${loaded.elements}`)
  }
}

/* ---------------- 3) pinch 放大（视觉放大，不重排） ---------------- */
console.log('\n=== pinch 放大 2x（Emulation.setPageScaleFactor） ===')
for (const p of PAGES.slice(0, 3)) {
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await send('Page.navigate', { url: p.url })
  await sleep(2400)
  try { await assertLoaded(p.name, p.url, p.key) } catch (e) { failures.push(String(e.message)); continue }
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 })
  await sleep(600)
  const v = await evaluate(`(() => { const de = document.documentElement; return { overflowX: de.scrollWidth > de.clientWidth, scale: visualViewport ? visualViewport.scale : null } })()`)
  await send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 })
  console.log(`${v.overflowX ? 'FAIL' : 'OK  '} ${p.name.padEnd(11)} pinch2x 溢出=${v.overflowX}`)
  if (v.overflowX) failures.push(`${p.name} pinch2x 横向溢出`)
}

/* ---------------- 4) 减少动态效果 ---------------- */
console.log('\n=== prefers-reduced-motion: reduce ===')
async function sampleReel(limit = 14) {
  // 触发随机取数，采样滚轮的不透明度序列
  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') || b.textContent || '').includes('随机生成'))
    if (btn) btn.click()
  })()`)
  const samples = []
  for (let i = 0; i < limit; i++) {
    const s = await evaluate(`(() => {
      const el = document.querySelector('.number-randomizer-reel')
      if (!el) return null
      const cs = getComputedStyle(el)
      return { opacity: cs.opacity, transition: cs.transitionDuration, animation: cs.animationDuration, tag: el.tagName }
    })()`)
    if (s) samples.push(s)
    await sleep(90)
  }
  return samples
}

for (const reduced of [true, false]) {
  await send('Emulation.setEmulatedMedia', { features: reduced ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [] })
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: `${BASE}/divination` })
  await sleep(2600)
  try { await assertLoaded('divination', `${BASE}/divination`, '.divination-form') } catch (e) { failures.push(String(e.message)); continue }
  const samples = await sampleReel()
  const opacities = samples.map((s) => Number(s.opacity))
  const varied = new Set(opacities.map((o) => o.toFixed(2))).size > 1
  const motion = await evaluate(`(() => {
    const moving = []
    document.querySelectorAll('body *').forEach(el => {
      const cs = getComputedStyle(el)
      const t = parseFloat(cs.transitionDuration) || 0
      const a = parseFloat(cs.animationDuration) || 0
      if (t > 0.05 || a > 0.05) moving.push({ sel: el.tagName + '.' + String(el.className).slice(0, 30), t: cs.transitionDuration, a: cs.animationDuration })
    })
    const inner = document.querySelector('.site-main__inner')
    return { moving, innerOpacity: inner ? getComputedStyle(inner).opacity : null, innerTransform: inner ? getComputedStyle(inner).transform : null }
  })()`)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${OUT}/reduced-motion-${reduced ? 'reduce' : 'normal'}.png`, Buffer.from(shot.result.data, 'base64'))
  const label = reduced ? 'reduce' : 'normal(对照)'
  console.log(`  ${label}: 滚轮不透明度序列=${opacities.join(',')}  有波动=${varied}  元素tag=${samples[0]?.tag}  带CSS动画的元素=${motion.moving.length}`)
  if (reduced) {
    report.reducedMotion = { opacities, varied, moving: motion.moving, innerOpacity: motion.innerOpacity, innerTransform: motion.innerTransform }
    if (varied) failures.push('reduce 模式下随机取数滚轮仍在做淡入动画')
    if (motion.moving.length) failures.push(`reduce 模式下仍有 ${motion.moving.length} 个元素带 CSS 动画/过渡`)
  } else {
    if (!varied) failures.push('对照异常：正常模式下滚轮没有任何动画，检测手段可能失效')
  }
}
await send('Emulation.setEmulatedMedia', { features: [] })

await writeFile(`${OUT}/acceptance-report.json`, JSON.stringify(report, null, 2))
console.log('\n================ 结论 ================')
if (failures.length === 0) console.log('全部通过，无失败项')
else { console.log(`失败 ${failures.length} 项：`); failures.forEach((f) => console.log('  - ' + f)) }
ws.close()
process.exit(failures.length === 0 ? 0 : 1)
