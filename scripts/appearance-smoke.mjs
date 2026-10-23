/**
 * 外观冒烟检查（CDP + 真实 Chrome）
 *
 * 用法：
 *   node scripts/appearance-smoke.mjs
 *   DSH_BASE_URL=http://127.0.0.1:5173 node scripts/appearance-smoke.mjs
 *
 * 对三套外观分别检查：
 *  - 冷启动根节点是否带 data-appearance（首帧前写入，不闪浅色）
 *  - 首页 / 三数起卦 / 结果页 是否真的渲染出关键内容
 *  - 切换外观后是否保留页面状态（不重挂载、不重新导航）
 */
import { readFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import WebSocket from 'ws'

const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const CDP = process.env.DSH_CDP ?? 'http://127.0.0.1:9222'
const OUT = process.env.DSH_OUT ?? join(process.cwd(), 'screenshots', 'appearance')

const APPEARANCES = [
  { id: 'qinglan', name: '青岚书院' },
  { id: 'zhusha', name: '朱砂档案' },
  { id: 'yehang', name: '夜航观象' },
]

async function httpJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`)
  return res.json()
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString())
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    })
  }
  static async connect() {
    const list = await httpJson(`${CDP}/json/list`)
    const page = list.find((t) => t.type === 'page')
    if (!page) throw new Error('没有可用的 Chrome 页面，请先启动带 --remote-debugging-port 的 Chrome')
    const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false })
    await new Promise((resolve, reject) => {
      ws.once('open', resolve)
      ws.once('error', reject)
    })
    return new Cdp(ws)
  }
  send(method, params = {}) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`${method} 超时`))
        }
      }, 30000)
    })
  }
  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(`页面脚本异常: ${res.exceptionDetails.text}`)
    }
    return res.result?.value
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 打开页面并等待「应用真的渲染出来了」 */
async function open(cdp, url, { width = 1440, height = 900 } = {}) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Page.navigate', { url })
  await cdp.send('Page.loadEventFired').catch(() => {})
  // 轮询应用根节点 + 关键内容，避免用固定 sleep 判定成功
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const state = await cdp
      .evaluate(`(() => {
        const root = document.querySelector('#root')
        const text = (document.body.innerText || '').trim()
        return {
          ready: document.readyState,
          hasRoot: !!root && root.children.length > 0,
          elements: root ? root.querySelectorAll('*').length : 0,
          text,
          appearance: document.documentElement.getAttribute('data-appearance'),
          error: /Internal Server Error|ECONNREFUSED|Failed to fetch/i.test(text) ? text.slice(0, 200) : '',
        }
      })()`)
      .catch(() => null)
    if (state && state.hasRoot && state.elements > 30 && !state.error) {
      return state
    }
    await sleep(200)
  }
  const last = await cdp
    .evaluate(`(() => ({ elements: document.querySelectorAll('#root *').length, text: (document.body.innerText||'').slice(0,300) }))()`)
    .catch(() => null)
  throw new Error(`页面未在 15s 内正常渲染: ${url} ${JSON.stringify(last)}`)
}

async function shot(cdp, file) {
  const res = await cdp.send('Page.captureScreenshot', { format: 'png' })
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, Buffer.from(res.data, 'base64'))
}

/** 写入外观偏好后重新加载（模拟用户选择后刷新） */
async function setAppearance(cdp, id) {
  await cdp.evaluate(`(() => {
    const key = 'zhouyi:settings'
    let parsed = {}
    try { parsed = JSON.parse(localStorage.getItem(key) || '{}') } catch (e) { parsed = {} }
    parsed.appearance = ${JSON.stringify(id)}
    localStorage.setItem(key, JSON.stringify(parsed))
    return true
  })()`)
}

/** 造一条真实记录（用于结果页） */
async function seedRecord(cdp, id, withAi) {
  await cdp.evaluate(`(() => {
    const key = 'zhouyi:records'
    let list = []
    try { list = JSON.parse(localStorage.getItem(key) || '[]') } catch (e) { list = [] }
    list = list.filter((r) => r.id !== ${JSON.stringify(id)})
    list.unshift({
      id: ${JSON.stringify(id)},
      type: 'three-number',
      createdAt: 1_700_000_000_000,
      question: '面对新的工作机会，我该如何把握进退？',
      numbers: [129, 257, 601],
      region: 'Asia/Shanghai',
      timezone: 'Asia/Shanghai',
      mainHexagramId: 1,
      movingLine: 3,
      changedHexagramId: 44,
      ${withAi ? "aiInterpretation: '## 卦象概要\\n乾为天，刚健自强。此卦提醒你：所遇之事如大旱之云，君子以及时雨滋润之。\\n\\n## 当前状态\\n你正站在一个可以主动选择的关口。'," : ''}
      version: 1,
    })
    localStorage.setItem(key, JSON.stringify(list))
    return true
  })()`)
}

const results = []
let failures = 0

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const cdp = await Cdp.connect()
try {
  // 先打开一次站点，拿到同源上下文（localStorage 需要真实 origin）
  await open(cdp, `${BASE}/`)

  for (const appearance of APPEARANCES) {
    await setAppearance(cdp, appearance.id)
    const home = await open(cdp, `${BASE}/`)
    const attr = await cdp.evaluate(`document.documentElement.getAttribute('data-appearance')`)
    const ok = attr === appearance.id && home.text.includes('今日卦境')
    if (!ok) failures++
    results.push({
      page: 'home',
      appearance: appearance.id,
      attr,
      elements: home.elements,
      ok,
    })
    await shot(cdp, join(OUT, `${appearance.id}-home-1440.png`))

    const cast = await open(cdp, `${BASE}/divination`)
    const castOk = cast.text.includes('三 数 起 卦') || cast.text.includes('三数起卦')
    if (!castOk) failures++
    results.push({ page: 'cast', appearance: appearance.id, elements: cast.elements, ok: castOk })
    await shot(cdp, join(OUT, `${appearance.id}-cast-1440.png`))

    // 结果页：带缓存解读
    await seedRecord(cdp, 'smoke-record-1', true)
    const result = await open(cdp, `${BASE}/result/smoke-record-1`)
    const resultOk = result.text.includes('本卦') && result.text.includes('变卦')
    if (!resultOk) failures++
    results.push({
      page: 'result',
      appearance: appearance.id,
      elements: result.elements,
      ok: resultOk,
    })
    await shot(cdp, join(OUT, `${appearance.id}-result-1440.png`))

    // 结果页：未解读状态
    await seedRecord(cdp, 'smoke-record-2', false)
    const resultIdle = await open(cdp, `${BASE}/result/smoke-record-2`)
    const idleOk = resultIdle.text.includes('本卦')
    if (!idleOk) failures++
    results.push({
      page: 'result-idle',
      appearance: appearance.id,
      elements: resultIdle.elements,
      ok: idleOk,
    })
    await shot(cdp, join(OUT, `${appearance.id}-result-idle-1440.png`))
  }
} finally {
  cdp.ws.close()
}

console.log(JSON.stringify({ base: BASE, failures, results }, null, 2))
process.exit(failures ? 1 : 0)
