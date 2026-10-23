/**
 * 外观切换 · 端到端行为走查（需求书 §7「行为」序列）
 *
 * 依次完成：选择 B → 起卦填数 → 切到 C → 启卦 → 切到 A → 刷新 → 查看卦册，
 * 顺带证明：
 * - 切换外观不丢问题/三个数字/校验状态；
 * - 结果页保留记录 ID、本卦、变卦、动爻，不因切换重复发请求；
 * - 刷新后仍是此前选中的外观，且结果页仍读同一条记录；
 * - 卦册里能看到这条记录（只出现一次）。
 *
 * 证据规则：每次导航都用轮询断言「页面真的渲染出来」，
 * 连接失败 / 空白页 / Vite 错误遮罩一律判失败，不用固定 sleep 判成功。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import WebSocket from 'ws'

const CDP = 'http://127.0.0.1:9222'
const BASE = 'http://localhost:5173'
const OUT = path.resolve('screenshots/journey')
const QUESTION = '这次切换外观会丢数据吗'

const results = []
const apiCalls = []
let failed = false

function report(ok, name, detail = '') {
  const line = `${ok ? 'OK  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`
  console.log(line)
  results.push({ ok, name, detail })
  if (!ok) failed = true
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- CDP glue */
const list = await (await fetch(`${CDP}/json/list`)).json()
const target = list.find((t) => t.type === 'page')
if (!target) throw new Error('找不到可用的 Chrome 页面（请先启动 headless Chrome + CDP 9222）')
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => ws.once('open', r))

let msgId = 0
const pending = new Map()
ws.on('message', (raw) => {
  const m = JSON.parse(raw.toString())
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
    return
  }
  if (m.method === 'Network.requestWillBeSent') {
    const url = m.params.request?.url ?? ''
    if (url.includes('/api/')) apiCalls.push(url)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++msgId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (res.result?.exceptionDetails) {
    throw new Error(
      `页面脚本报错：${res.result.exceptionDetails.text} ${res.result.exceptionDetails.exception?.description ?? ''}`
    )
  }
  return res.result?.result?.value
}

await send('Page.enable')
await send('Runtime.enable')
await send('Network.enable')
await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})

/* ---------------------------------------------------------------- helpers */
async function goto(url) {
  await send('Page.navigate', { url })
}

/** 轮询断言页面真的渲染出来（不是固定 sleep） */
async function assertLoaded(urlPart, keySelector, label, keyText = null) {
  for (let i = 0; i < 40; i++) {
    const state = await evaluate(`(() => ({
      ready: document.readyState,
      href: location.href,
      rootChildren: document.querySelector('#root')?.children.length ?? 0,
      elements: document.querySelectorAll('body *').length,
      key: !!document.querySelector(${JSON.stringify(keySelector)}),
      text: ((document.body && document.body.innerText) || '').slice(0, 400)
    }))()`)
    if (
      state?.ready === 'complete' &&
      state.rootChildren > 0 &&
      state.elements > 30 &&
      state.key &&
      // Vite 的错误遮罩是自定义元素，页面自身的报错文案不算遮罩
      !(await evaluate(`!!document.querySelector('vite-error-overlay')`)) &&
      (!keyText || state.text.includes(keyText))
    ) {
      return state
    }
    await sleep(250)
  }
  const last = await evaluate(`((document.body && document.body.innerText) || '').slice(0, 300)`)
  report(false, label, `页面没渲染出来：${last}`)
  return null
}

/** 通过顶栏「外观」下拉切换外观（走真实 UI，不直接改 localStorage） */
async function switchAppearance(name) {
  const before = apiCalls.length
  await evaluate(`(() => {
    const btn = document.querySelector('button.appearance-switcher__trigger')
    if (!btn) return 'no-trigger'
    btn.click()
    return 'opened'
  })()`)
  await sleep(150)
  const picked = await evaluate(`(() => {
    const items = [...document.querySelectorAll('[role="menuitemradio"]')]
    const item = items.find((el) => el.textContent.includes(${JSON.stringify(name)}))
    if (!item) return 'not-found:' + items.map((i) => i.textContent.trim()).join('|')
    item.click()
    return 'clicked'
  })()`)
  if (picked !== 'clicked') {
    report(false, `切换外观 → ${name}`, String(picked))
    return false
  }
  await sleep(250)
  const attr = await evaluate(`document.documentElement.getAttribute('data-appearance')`)
  const stored = await evaluate(`(() => { try { return JSON.parse(localStorage.getItem('zhouyi:settings')||'{}').appearance ?? null } catch (e) { return 'parse-error' } })()`)
  report(
    attr !== null && stored === attr,
    `切换外观 → ${name}`,
    `根节点=${attr} 存储=${stored} 切换期间新增 API 调用=${apiCalls.length - before}`
  )
  return true
}

async function setNativeValue(selector, value, index = 0) {
  return evaluate(`(() => {
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
    if (!el) return 'not-found'
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return 'ok'
  })()`)
}

async function readState() {
  return evaluate(`(() => {
    const nums = [...document.querySelectorAll('.number-box input')].map((i) => i.value)
    const ta = document.querySelector('textarea')
    const submit = document.querySelector('button[type="submit"]')
    return {
      question: ta ? ta.value : null,
      numbers: nums,
      submitDisabled: submit ? submit.disabled : null,
      submitText: submit ? submit.textContent.trim() : null,
      href: location.href
    }
  })()`)
}

function screenshot(name) {
  return send('Page.captureScreenshot', { format: 'png' }).then((res) => {
    if (!res.result?.data) return
    const file = path.join(OUT, `${name}.png`)
    writeFileSync(file, Buffer.from(res.result.data, 'base64'))
  })
}

/* ---------------------------------------------------------------- run */
mkdirSync(OUT, { recursive: true })

// 0) 干净起点：清空本地记录与设置
await goto(`${BASE}/`)
await sleep(800)
await evaluate(`(() => { localStorage.clear(); return true })()`)
await goto(`${BASE}/`)

const home = await assertLoaded(`${BASE}/`, '.site-header', '首页加载')
report(!!home, '首页加载', home ? `元素数=${home.elements}` : '')
await screenshot('01-home-default-qinglan')

const defaultAttr = await evaluate(`document.documentElement.getAttribute('data-appearance')`)
report(defaultAttr === 'qinglan', '默认外观为 A（青岚书院）', `data-appearance=${defaultAttr}`)

// 1) 选择 B（朱砂档案）
await switchAppearance('朱砂档案')

// 2) 起卦页填数
await goto(`${BASE}/divination`)
const cast = await assertLoaded(`${BASE}/divination`, '.number-box', '起卦页加载')
report(!!cast, '起卦页加载', cast ? `元素数=${cast.elements}` : '')

await setNativeValue('textarea', QUESTION)
await setNativeValue('.number-box input', '123', 0)
await setNativeValue('.number-box input', '456', 1)
await setNativeValue('.number-box input', '789', 2)
await sleep(200)
const filled = await readState()
report(
  filled.question === QUESTION &&
    filled.numbers.join(',') === '123,456,789' &&
    filled.submitDisabled === false,
  '填写问题与三个数字后校验通过',
  `question="${filled.question}" numbers=${filled.numbers.join(',')} 提交按钮禁用=${filled.submitDisabled}`
)
await screenshot('02-cast-filled-zhusha')

// 3) 切到 C：输入必须还在
await switchAppearance('夜航观象')
const afterC = await readState()
report(
  afterC.question === QUESTION && afterC.numbers.join(',') === '123,456,789',
  '切到 C 后问题与三个数字仍在',
  `question="${afterC.question}" numbers=${afterC.numbers.join(',')} href=${afterC.href}`
)
await screenshot('03-cast-yehang-kept-input')

// 4) 切回 A：输入仍要在
await switchAppearance('青岚书院')
const afterA = await readState()
report(
  afterA.question === QUESTION && afterA.numbers.join(',') === '123,456,789',
  '切回 A 后问题与三个数字仍在',
  `question="${afterA.question}" numbers=${afterA.numbers.join(',')}`
)

// 5) 启卦 → 结果页
const apiBeforeCast = apiCalls.length
await evaluate(`(() => { const b = document.querySelector('button[type="submit"]'); b && b.click(); return true })()`)
await sleep(600)
const resultHref = await evaluate(`location.href`)
const result = await assertLoaded(
  '/result/',
  '.result-workspace, .zh-result, .yh-result, [aria-label="本卦与变卦"]',
  '结果页加载',
  '本卦'
)
report(!!result, '启卦后进入结果页', `href=${resultHref}`)
const recordId = resultHref.split('/result/')[1]?.split('?')[0] ?? ''
report(!!recordId, '结果页 URL 带真实记录 ID', `recordId=${recordId}`)
await screenshot('04-result-qinglan')

const resultText = await evaluate(`((document.body && document.body.innerText) || '')`)
report(
  resultText.includes('123') && resultText.includes('456') && resultText.includes('789'),
  '结果页显示真实的三数',
  ''
)
report(
  /本卦|变卦|动爻/.test(resultText),
  '结果页显示本卦/变卦/动爻信息',
  ''
)
report(
  resultText.includes(QUESTION),
  '结果页显示刚才填写的问题',
  `question="${QUESTION}"`
)
report(
  apiCalls.length === apiBeforeCast,
  '启卦本身不产生额外 API 调用（不自动保存/不调 AI）',
  `新增=${apiCalls.length - apiBeforeCast}`
)

// 6) 结果页切外观：记录与请求状态不能变
const apiBeforeSwitch = apiCalls.length
await switchAppearance('朱砂档案')
await switchAppearance('夜航观象')
const afterSwitch = await evaluate(`(() => ({
  href: location.href,
  text: (document.body && document.body.innerText) || ''
}))()`)
report(
  afterSwitch.href === resultHref && afterSwitch.text.includes(QUESTION),
  '结果页切换外观后 URL 与记录内容不变',
  `href=${afterSwitch.href}`
)
report(
  apiCalls.length === apiBeforeSwitch,
  '结果页切换外观不重复发请求',
  `新增=${apiCalls.length - apiBeforeSwitch}`
)
await screenshot('05-result-yehang-same-record')

// 7) 刷新：外观与记录都还在
await goto(resultHref)
const reloaded = await assertLoaded(
  '/result/',
  '.result-workspace, .zh-result, .yh-result, [aria-label="本卦与变卦"]',
  '刷新后结果页加载',
  '本卦'
)
report(!!reloaded, '刷新后结果页仍可渲染', reloaded ? '' : '')
const attrAfterReload = await evaluate(`document.documentElement.getAttribute('data-appearance')`)
report(
  attrAfterReload === 'yehang',
  '刷新后仍是此前选中的外观（夜航观象）',
  `data-appearance=${attrAfterReload}`
)
const reloadedText = await evaluate(`((document.body && document.body.innerText) || '')`)
report(
  reloadedText.includes(QUESTION) && reloadedText.includes('123'),
  '刷新后仍是同一条记录（问题与数字都在）',
  ''
)
await screenshot('06-result-after-reload')

// 8) 卦册里这条记录只出现一次
await goto(`${BASE}/records`)
const records = await assertLoaded(
  `${BASE}/records`,
  'h1',
  '卦册加载',
  '明夷'
)
report(!!records, '卦册页加载', records ? `元素数=${records.elements}` : '')
await sleep(500)
const recordEntries = await evaluate(`(() => {
  const raw = localStorage.getItem('zhouyi:records')
  if (!raw) return { count: 0, ids: [] }
  const list = JSON.parse(raw)
  return { count: list.length, ids: list.map((r) => r.id), questions: list.map((r) => r.question) }
})()`)
report(
  recordEntries.count === 1 && recordEntries.ids[0] === recordId,
  '卦册里只有一条记录，且就是刚才那条',
  `count=${recordEntries.count} ids=${recordEntries.ids.join(',')}`
)
await screenshot('07-records-one-entry')

/* ------------------------------------------------------- P1-01 回归取证 */
// 验收报告 P1-01：切换外观会卸载视图子树，导致「未满三位的输入」「无效三位」
// 「滚动中的随机取数器」丢失或卡死。修复后这些状态必须由稳定层持有并跨外观存活。
await goto(`${BASE}/divination`)
const castAgain = await assertLoaded(`${BASE}/divination`, '.number-box', '起卦页加载（回归段）')
report(!!castAgain, '起卦页加载（回归段）', castAgain ? `元素数=${castAgain.elements}` : '')

// a) 未满三位：输入必须活着，启卦必须仍然禁用
await setNativeValue('.number-box input', '12', 0)
await setNativeValue('.number-box input', '', 1)
await setNativeValue('.number-box input', '', 2)
await sleep(150)
await switchAppearance('朱砂档案')
await switchAppearance('青岚书院')
const partial = await readState()
report(
  partial.numbers[0] === '12' && partial.numbers[1] === '' && partial.submitDisabled === true,
  '未满三位的输入跨外观切换后仍在，启卦仍禁用',
  `numbers=${partial.numbers.join(',')} 提交按钮禁用=${partial.submitDisabled}`
)

// b) 无效三位（099）：必须原样保留，启卦仍然禁用
await setNativeValue('.number-box input', '099', 0)
await sleep(150)
await switchAppearance('夜航观象')
await switchAppearance('青岚书院')
const invalid = await readState()
report(
  invalid.numbers[0] === '099' && invalid.submitDisabled === true,
  '无效三位（099）跨外观切换后原样保留，启卦仍禁用',
  `numbers=${invalid.numbers.join(',')} 提交按钮禁用=${invalid.submitDisabled}`
)

// c) 滚动中的取数器：切换后仍在滚动，新外观里能「停止」
await setNativeValue('.number-box input', '', 0)
await sleep(150)
const started = await evaluate(`(() => {
  const btn = document.querySelectorAll('.number-randomizer-button')[0]
  if (!btn) return { ok: false }
  btn.click()
  return { ok: true }
})()`)
await sleep(300)
const rollingBefore = await evaluate(`document.querySelector('.number-randomizer')?.dataset.state ?? 'none'`)
report(
  started.ok && rollingBefore === 'rolling',
  '第一格随机取数器进入滚动态',
  `data-state=${rollingBefore}`
)
await switchAppearance('朱砂档案')
const rollingAfter = await evaluate(`(() => {
  const box = document.querySelector('.number-randomizer')
  const btn = document.querySelector('.number-randomizer-button')
  return {
    state: box?.dataset.state ?? 'none',
    buttonText: btn?.textContent?.trim() ?? '',
    inputDisabled: document.querySelector('.number-box input')?.disabled ?? null
  }
})()`)
report(
  rollingAfter.state === 'rolling' && rollingAfter.buttonText.includes('停'),
  '切换外观后取数器仍在滚动，新外观里出现「停止」按钮',
  `data-state=${rollingAfter.state} 按钮="${rollingAfter.buttonText}"`
)
await evaluate(`(() => { document.querySelectorAll('.number-randomizer-button')[0]?.click(); return true })()`)
await sleep(300)
const stopped = await evaluate(`(() => ({
  state: document.querySelector('.number-randomizer')?.dataset.state ?? 'none',
  value: document.querySelector('.number-box input')?.value ?? ''
}))()`)
report(
  stopped.state !== 'rolling' && /^\d{3}$/.test(stopped.value),
  '停止后灵数落定为一个三位数',
  `data-state=${stopped.state} value=${stopped.value}`
)
await screenshot('08-cast-rolling-across-appearance')

/* ---------------------------------------------------------------- summary */
const summary = {
  ranAt: new Date().toISOString(),
  question: QUESTION,
  recordId,
  apiCalls: apiCalls.map((u) => u.replace(BASE, '')),
  results,
  failed,
}
writeFileSync(
  path.join(OUT, 'appearance-journey.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
)

console.log('\n================ 结论 ================')
console.log(failed ? '有失败项' : '全部通过，无失败项')
ws.close()
process.exit(failed ? 1 : 0)
