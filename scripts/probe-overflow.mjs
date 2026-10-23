/** 临时探针：找出 320px 下横向溢出的元素 */
import WebSocket from 'ws'

const CDP = process.env.DSH_CDP ?? 'http://127.0.0.1:9222'
const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const WIDTH = Number(process.argv[2] ?? 320)
const APPEARANCE = process.argv[3] ?? 'qinglan'
const PAGES = (process.argv[4] ?? 'home,divination,codex,records,settings,hexagram/1').split(',')

const list = await (await fetch(`${CDP}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))
let id = 0
const pending = new Map()
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id) }
})
const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: 900, deviceScaleFactor: 1, mobile: true })
await send('Page.navigate', { url: `${BASE}/` })
await sleep(2000)
await evaluate(`(() => { const k='zhouyi:settings'; let p={}; try{p=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}; p.appearance=${JSON.stringify(APPEARANCE)}; localStorage.setItem(k, JSON.stringify(p)); return true })()`)

for (const p of PAGES) {
  await send('Page.navigate', { url: `${BASE}/${p}` })
  await sleep(2200)
  const res = await evaluate(`(() => {
    const de = document.documentElement
    const vw = de.clientWidth
    const bad = []
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return
      if (r.right > vw + 1 || r.left < -1) {
        const cs = getComputedStyle(el)
        if (cs.position === 'fixed') return
        bad.push({
          tag: el.tagName, cls: String(el.className).slice(0, 60),
          left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width),
          text: (el.textContent || '').trim().replace(/\\s+/g,' ').slice(0, 24),
        })
      }
    })
    // 只保留最外层的越界元素
    return { vw, scrollW: de.scrollWidth, overflow: de.scrollWidth > de.clientWidth, count: bad.length, bad: bad.slice(0, 12) }
  })()`)
  console.log(`\n=== ${APPEARANCE} /${p} @${WIDTH}  vw=${res.vw} scrollW=${res.scrollW} 溢出=${res.overflow} 越界元素=${res.count}`)
  for (const b of res.bad) console.log(`   ${b.tag}.${b.cls} left=${b.left} right=${b.right} w=${b.w} 「${b.text}」`)
}
ws.close()
