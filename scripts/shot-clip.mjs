/** 临时探针：截取指定元素区域的放大图（用于人工核对对比度问题） */
import WebSocket from 'ws'
import { writeFileSync } from 'node:fs'

const CDP = 'http://127.0.0.1:9222'
const BASE = 'http://localhost:5173'
const url = process.argv[2] ?? `${BASE}/result/contrast-record`
const selector = process.argv[3] ?? '.yh-result__heading'
const appearance = process.argv[4] ?? 'yehang'
const out = process.argv[5] ?? `${process.env.TEMP}/dsh-shots/clip.png`
const scale = Number(process.argv[6] ?? 2)

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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: `${BASE}/` })
await sleep(2000)
await evaluate(`(() => { const k='zhouyi:settings'; let p={}; try{p=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}; p.appearance=${JSON.stringify(appearance)}; localStorage.setItem(k, JSON.stringify(p)); return true })()`)
await send('Page.navigate', { url })
await sleep(2500)

const rect = await evaluate(`(() => {
  const el = document.querySelector(${JSON.stringify(selector)})
  if (!el) {
    return { missing: true, bodyText: (document.body.innerText || '').slice(0, 300), html: document.querySelector('#root')?.innerHTML.slice(0, 300) }
  }
  const r = el.getBoundingClientRect()
  const h1 = el.querySelector('h1') || el
  const hr = h1.getBoundingClientRect()
  const cs = getComputedStyle(h1)
  return { x: r.x, y: r.y, w: r.width, h: r.height, h1: { x: hr.x, y: hr.y, w: hr.width, h: hr.height, color: cs.color, size: cs.fontSize, family: cs.fontFamily } }
})()`)
console.log(JSON.stringify(rect, null, 2))

if (rect) {
  const clip = { x: Math.max(0, rect.x - 10), y: Math.max(0, rect.y - 10), width: Math.min(1440, rect.w + 20), height: Math.min(900, rect.h + 20), scale }
  const shot = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  console.log('saved', out)
}
ws.close()
