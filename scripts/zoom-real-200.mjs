/**
 * 真实浏览器 200% 缩放验收（独立 Chrome 实例，不碰共享的 :9222）
 *
 * 为什么单独一个脚本：
 *   acceptance-appearances.mjs 里的「200%」其实是 DevTools 的模拟条件
 *   （Emulation.setDeviceMetricsOverride：CSS 视口减半 + deviceScaleFactor=2），
 *   真实桌面缩放不会把桌面浏览器改成 mobile 渲染模式，所以两者必须分开表述、分开取证。
 *
 * 策略（按优先级，逐个尝试并自证）：
 *   1. **真实浏览器缩放快捷键（Windows 原生输入注入）**：起一个**有界面**的独立 Chrome，
 *      用 Win32 `keybd_event` 把 Ctrl+'+' / Ctrl+'0' 真的敲进浏览器窗口。
 *      这是用户按快捷键的那条路径——浏览器自己改了缩放级别，
 *      CSS 视口收窄、设备像素比同步翻倍，而**物理窗口尺寸不变**。
 *   2. CDP Input.dispatchKeyEvent 发 Ctrl+Equal / Ctrl+NumpadAdd：
 *      同样想触发浏览器级快捷键，但 headless 下浏览器进程通常不处理注入的按键，
 *      所以脚本会先试，并如实记录成败。
 *   3. Chrome 自身的每站点缩放级别：启动前在 profile 的 Default/Preferences 里写
 *      partition.per_host_zoom_levels（= Ctrl+Plus 走的是同一条浏览器缩放路径）。
 *   4. 退化方案 --force-device-scale-factor=2：这只是设备像素比模拟，
 *      CSS 视口不会变窄，**不算真实缩放**；脚本会明确标注并记为失败。
 *
 * 自证判据（任何一条不成立就不算真实缩放）：
 *   - window.innerWidth 相应变窄到 <= 0.75×（真实缩放会缩小 CSS 视口，模拟不会）；
 *   - window.outerWidth 几乎不变（证明是「页面缩放」，不是把窗口改小）；
 *   - devicePixelRatio 从基准跃升到目标（≈2×）。
 *   绝不把模拟结果当成真实缩放。
 *
 * 覆盖：6 档 CSS 视口宽度（1440/768/390，以及 1440/768/390 物理窗口在 200% 下的
 *      720/384/195）× 关键页面（home / divination / result）× 3 套外观，
 *      复用 shared-appearances-probe.mjs 的同一套判定口径
 *      （横向溢出 / <12px 字号 / 目标尺寸 / 对比度不足）。
 *
 * 环境变量：
 *   DSH_BASE_URL  默认 http://localhost:5173
 *   DSH_OUT       默认 screenshots/zoom-real-200
 *   DSH_ZOOM_CDP  默认 9333（独立端口，避免和共享的 9222 抢同一个 tab）
 *   DSH_CHROME    可选：Chrome 可执行文件路径
 */
let WebSocket
try {
  WebSocket = (await import('ws')).default
} catch {
  console.error('缺少 ws 依赖：npm i -D ws')
  process.exit(2)
}
import { spawn, execFile } from 'node:child_process'
import { writeFile, mkdir, rm, writeFile as writeTextFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { THRESHOLDS, buildProbeConfig, pageProbe, evaluateProbe } from './shared-appearances-probe.mjs'

const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const OUT = process.env.DSH_OUT ?? 'screenshots/zoom-real-200'
const PORT = Number(process.env.DSH_ZOOM_CDP ?? 9333)
const PROFILE_DIR = join(tmpdir(), 'chrome-zoom-profile')
await mkdir(OUT, { recursive: true })

const APPEARANCES = [
  { id: 'qinglan', name: '青岚书院' },
  { id: 'zhusha', name: '朱砂档案' },
  { id: 'yehang', name: '夜航观象' },
]

/** 关键页面 */
const ZOOM_PAGES = [
  { name: 'home', url: `${BASE}/`, key: 'main' },
  { name: 'divination', url: `${BASE}/divination`, key: 'main' },
  { name: 'result', url: `${BASE}/result/zoom-record`, key: 'main' },
]

/**
 * CSS 视口宽度档位。
 * css-* 三档：把 CSS 视口真的做成 1440/768/390（物理窗口 = cssWidth × 2）。
 * half-* 三档：物理窗口 1440/768/390，在 200% 下 CSS 视口自然是 720/384/195，
 *            和 acceptance-appearances.mjs 的模拟矩阵一一对应，便于对照。
 */
const WIDTH_PRESETS = [
  { label: 'css-1440', cssWidth: 1440, note: 'CSS 视口 1440px（物理窗口 2880px @200%）' },
  { label: 'css-768', cssWidth: 768, note: 'CSS 视口 768px（物理窗口 1536px @200%）' },
  { label: 'css-390', cssWidth: 390, note: 'CSS 视口 390px（物理窗口 780px @200%）' },
  {
    label: 'half-1440-window',
    cssWidth: 720,
    note: '物理窗口 1440px @200% → CSS 视口约 720px（与模拟矩阵同档）',
  },
  {
    label: 'half-768-window',
    cssWidth: 384,
    note: '物理窗口 768px @200% → CSS 视口约 384px（与模拟矩阵同档）',
  },
  {
    label: 'half-390-window',
    cssWidth: 195,
    note:
      '物理窗口 390px @200% → 标称 CSS 视口 195px。' +
      'Windows 上浏览器有最小窗口宽度（约 500 物理 px），实际只能到约 243px CSS；' +
      '脚本会核对实测宽度并把这一档标为「平台限制档」，不按 195px 记账。',
  },
]

/**
 * 实际 CSS 视口与标称值的允许偏差。
 * 滚动条 + 窗口边框会带来 15px 左右的固定差，属正常；
 * 超出这个幅度说明这一档**没有真的被量到**（例如被浏览器最小窗口宽度挡住），
 * 不能再按标称档位记账。
 */
const WIDTH_TOLERANCE = 20

const WINDOW_HEIGHT = 900
/** 200% 对应的 zoom level：ZoomFactorToZoomLevel(2) = ln2/ln1.2 */
const ZOOM_LEVEL_200 = Math.log(2) / Math.log(1.2)

/* --------------------------- 小工具 --------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findChrome() {
  const candidates = [
    process.env.DSH_CHROME,
    process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
    process.env['ProgramFiles(x86)'] &&
      join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
    process.env.LOCALAPPDATA &&
      join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  ].filter(Boolean)
  for (const c of candidates) {
    if (c) return c
  }
  throw new Error('找不到 Chrome，可执行文件路径请用 DSH_CHROME 指定')
}

async function waitForCdp(port, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (r.ok) return await r.json()
    } catch (e) {
      lastErr = e
    }
    await sleep(250)
  }
  throw new Error(`Chrome CDP 未就绪（127.0.0.1:${port}）：${lastErr?.message ?? '超时'}`)
}

/** 连接某个 target 的 CDP */
async function connect(wsUrl) {
  const sock = new WebSocket(wsUrl)
  await new Promise((res, rej) => {
    sock.on('open', res)
    sock.on('error', rej)
  })
  let seq = 0
  const pending = new Map()
  sock.on('message', (raw) => {
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
      sock.send(JSON.stringify({ id, method, params }))
    })
  return { sock, send }
}

/* --------------------------- Chrome 实例管理 --------------------------- */

const chromePath = findChrome()

/** 写 profile 的 Preferences：设置 Chrome 自身的每站点缩放级别 */
async function writeZoomProfile(level) {
  await rm(PROFILE_DIR, { recursive: true, force: true })
  await mkdir(join(PROFILE_DIR, 'Default'), { recursive: true })
  const prefs = {
    partition: {
      default_zoom_level: level,
      per_host_zoom_levels: {
        localhost: level,
        'localhost:5173': level,
      },
    },
  }
  await writeTextFile(
    join(PROFILE_DIR, 'Default', 'Preferences'),
    JSON.stringify(prefs, null, 2),
    'utf8'
  )
}

let chromeProc = null

async function killChrome() {
  if (!chromeProc) return
  const proc = chromeProc
  chromeProc = null
  try {
    proc.kill()
  } catch {
    /* 忽略 */
  }
  await sleep(800)
}

/**
 * 启动一个独立 Chrome 实例。
 * @param {object} opts { windowWidth, windowHeight, forceDeviceScaleFactor, headful }
 */
async function launchChrome(opts = {}) {
  const args = [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-features=Translate,MediaRouter',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE_DIR}`,
    `--window-size=${opts.windowWidth ?? 1440},${opts.windowHeight ?? WINDOW_HEIGHT}`,
    '--window-position=0,0',
    'about:blank',
  ]
  if (opts.headful) {
    // 有界面模式：浏览器进程会真正处理 Ctrl+'+' 这类浏览器级快捷键
    args.unshift('--no-default-browser-check')
  } else {
    args.unshift('--headless=new', '--disable-gpu')
  }
  if (opts.forceDeviceScaleFactor) {
    args.unshift(`--force-device-scale-factor=${opts.forceDeviceScaleFactor}`)
  }
  chromeProc = spawn(chromePath, args, { stdio: 'ignore' })
  chromeProc.on('error', () => {})
  await waitForCdp(PORT)
  const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const target = targets.find((t) => t.type === 'page')
  if (!target) throw new Error('Chrome 起来了但没有 page target')
  const pageConn = await connect(target.webSocketDebuggerUrl)
  await pageConn.send('Page.enable')
  await pageConn.send('Runtime.enable')
  await pageConn.send('Page.bringToFront')
  const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
  const browserConn = await connect(version.webSocketDebuggerUrl)
  return { pageConn, browserConn, target }
}

/* --------------------------- 页面内工具 --------------------------- */

function zoomState() {
  return {
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
    visualViewportWidth: window.visualViewport ? window.visualViewport.width : null,
    url: location.href,
  }
}

function pageState(key) {
  // 导航过程中 document.body 可能还没建好，这里必须容错
  const text = (document.body && document.body.innerText) || ''
  return {
    ready: document.readyState,
    title: document.title,
    elements: document.querySelectorAll('body *').length,
    appRoot: !!document.querySelector('#root') && document.querySelector('#root').children.length > 0,
    hasKey: key === 'body' ? true : !!document.querySelector(key),
    appearance: document.documentElement.getAttribute('data-appearance'),
    viteOverlay: !!document.querySelector('vite-error-overlay'),
    connectionError:
      /ERR_CONNECTION|无法访问此网站|拒绝.{0,8}连接|ERR_NAME_NOT_RESOLVED/.test(text),
    bodyText: text.slice(0, 200),
  }
}

/* --------------------------- 主流程 --------------------------- */

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  chrome: { path: chromePath, port: PORT, profile: PROFILE_DIR },
  thresholds: THRESHOLDS,
  zoom: {
    isRealBrowserZoom: false,
    method: null,
    keySequence: [],
    baseline: null,
    zoomed: null,
    effectiveZoomPercent: null,
    verified: false,
    verificationReason: null,
    attempts: [],
    notes: [],
  },
  matrix: [],
  failures: [],
  exemptions: [],
  /** 没量到标称档位的组（浏览器最小窗口宽度等平台限制） */
  platformLimits: [],
  coverage: { expected: 0, measured: 0, notCovered: 0, atRequestedWidth: 0, platformLimited: 0 },
  summary: {},
}

const failures = report.failures
const exemptions = report.exemptions

const evaluateOn = async (conn, expression) => {
  const r = await conn.send('Runtime.evaluate', {
    returnByValue: true,
    awaitPromise: true,
    expression,
  })
  if (r.result?.exceptionDetails) {
    throw new Error('页面脚本异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  }
  return r.result?.result?.value
}

const navAndWait = async (conn, url, key) => {
  await conn.send('Page.navigate', { url })
  const deadline = Date.now() + 15000
  let last = null
  while (Date.now() < deadline) {
    // 导航过程中的瞬时求值异常不代表页面没渲染，继续轮询
    try {
      last = await evaluateOn(conn, `(${pageState.toString()})(${JSON.stringify(key)})`)
    } catch (e) {
      last = { transientError: String(e.message).slice(0, 120) }
      await sleep(150)
      continue
    }
    if (last) {
      if (last.viteOverlay) return { ok: false, reason: 'vite-error-overlay', info: last }
      if (last.connectionError) return { ok: false, reason: 'connection-error', info: last }
      if (last.ready === 'complete' && last.title && last.appRoot && last.hasKey && last.elements > 20) {
        return { ok: true, info: last }
      }
    }
    await sleep(150)
  }
  return { ok: false, reason: 'not-rendered', info: last }
}

/** 设置 localStorage 里的外观 */
const setAppearance = async (conn, id) => {
  await evaluateOn(
    conn,
    `(() => {
      const key = 'zhouyi:settings'
      let parsed = {}
      try { parsed = JSON.parse(localStorage.getItem(key) || '{}') } catch (e) { parsed = {} }
      parsed.appearance = ${JSON.stringify(id)}
      localStorage.setItem(key, JSON.stringify(parsed))
      return true
    })()`
  )
}

/** 预置一条起卦记录（结果页要用） */
const seedRecord = async (conn) => {
  await evaluateOn(
    conn,
    `(() => {
      localStorage.setItem('zhouyi:records', JSON.stringify([{
        id: 'zoom-record', type: 'three-number', createdAt: Date.now() - 3600e3,
        question: '面对新的工作机会，我该如何把握进退？', numbers: [123, 456, 789],
        region: 'Asia/Shanghai', timezone: 'Asia/Shanghai', mainHexagramId: 15,
        movingLine: 2, changedHexagramId: 46, version: 1,
        aiInterpretation: '## 卦象概要\\n泽地萃，聚集之象。\\n\\n## 当前状态\\n你正站在一个可以主动选择的关口。'
      }]))
      return true
    })()`
  )
}

/** 发送 Ctrl+某键 */
const dispatchCtrlKey = async (conn, key, code, windowsVirtualKeyCode, text) => {
  await conn.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    modifiers: 2,
    key,
    code,
    windowsVirtualKeyCode,
    text,
    unmodifiedText: text,
  })
  await conn.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    modifiers: 2,
    key,
    code,
    windowsVirtualKeyCode,
  })
  await sleep(120)
}

/**
 * Windows 原生键盘注入：把 Ctrl+'+' / Ctrl+'0' 真的敲进 Chrome 窗口。
 *
 * 这是「真实浏览器缩放」——走的是操作系统 → 浏览器进程 → 浏览器缩放级别
 * 这条完整链路，和用户手按快捷键完全一样：
 *   - 物理窗口尺寸不变（outerWidth 不变）；
 *   - 页面缩放级别改变 → CSS 视口收窄、devicePixelRatio 同步翻倍。
 *
 * CDP 的 Input.dispatchKeyEvent 只把按键送到渲染进程，浏览器进程拿不到
 * 浏览器级快捷键，所以真缩放必须走系统输入注入。
 *
 * @param {'plus'|'zero'} action
 * @returns {Promise<{ok: boolean, windowTitle?: string, error?: string}>}
 */
function injectBrowserZoomKey(action) {
  const vk = action === 'plus' ? 0xBB : 0x30 // VK_OEM_PLUS / VK_0
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class ZoomKeys {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
}
'@
$win = Get-Process chrome -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne 0 } |
  Select-Object -First 1
if (-not $win) { Write-Output 'NO_WINDOW'; exit 2 }
Write-Output ("WINDOW:" + $win.MainWindowTitle)
[ZoomKeys]::ShowWindow($win.MainWindowHandle, 9) | Out-Null
[ZoomKeys]::SetForegroundWindow($win.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 500
$VK_CONTROL = 0x11
[ZoomKeys]::keybd_event($VK_CONTROL, 0, 0, [UIntPtr]::Zero)
[ZoomKeys]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
[ZoomKeys]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)
[ZoomKeys]::keybd_event($VK_CONTROL, 0, 2, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
Write-Output 'INJECTED'
`
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: 40000, windowsHide: true },
      (err, stdout) => {
        const out = String(stdout ?? '')
        if (out.includes('INJECTED')) {
          resolve({ ok: true, windowTitle: (out.match(/WINDOW:(.*)/) ?? [])[1]?.trim() })
        } else if (out.includes('NO_WINDOW')) {
          resolve({ ok: false, error: '没有找到可见的 Chrome 窗口（有界面实例没起来？）' })
        } else {
          resolve({ ok: false, error: (err && String(err.message)) || out.trim().slice(0, 200) })
        }
      }
    )
  })
}

/** 调整浏览器窗口尺寸（真实缩放下 CSS 视口宽度由窗口宽度决定） */
async function setWindowWidth(conn, browserConn, targetId, physicalWidth) {
  try {
    const { result } = await browserConn.send('Browser.getWindowForTarget', { targetId })
    const windowId = result?.windowId
    if (windowId === undefined) throw new Error('no windowId')
    await browserConn.send('Browser.setWindowBounds', {
      windowId,
      bounds: { width: physicalWidth, height: WINDOW_HEIGHT, windowState: 'normal' },
    })
    await sleep(400)
    return { ok: true, via: 'Browser.setWindowBounds' }
  } catch (e) {
    return { ok: false, via: 'Browser.setWindowBounds', error: String(e.message ?? e) }
  }
}

/* --------------------------- 1) 建立缩放机制 --------------------------- */

console.log('=========================================================')
console.log('真实浏览器 200% 缩放验收（独立 Chrome 实例，端口 ' + PORT + '）')
console.log('=========================================================')

// 先起一个干净的实例，作为 100% 基准
await writeZoomProfile(0)
let inst = await launchChrome({ windowWidth: 1440 })
await inst.pageConn.send('Emulation.setFocusEmulationEnabled', { enabled: true })
await inst.pageConn.send('Page.navigate', { url: `${BASE}/` })
await sleep(1500)
await seedRecord(inst.pageConn)
await sleep(300)
const baseline = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
report.zoom.baseline = baseline
console.log(
  `基准（100%）：dpr=${baseline.devicePixelRatio} innerWidth=${baseline.innerWidth} outerWidth=${baseline.outerWidth} visualViewport.scale=${baseline.visualViewportScale}`
)

/* --- 策略 1：Windows 原生输入注入（真实浏览器缩放） --- */
const nativeAttempt = {
  method: 'Windows 原生键盘注入 Ctrl+0 / Ctrl+加号 → Chrome 自身的浏览器缩放级别',
  steps: [],
  verified: false,
  reason: null,
}
let chosen = null
{
  await killChrome()
  await writeZoomProfile(0)
  inst = await launchChrome({ windowWidth: 1440, headful: true })
  await inst.pageConn.send('Page.navigate', { url: `${BASE}/` })
  await sleep(2200)
  await seedRecord(inst.pageConn)
  await inst.pageConn.send('Page.bringToFront')
  await sleep(500)

  const reset = await injectBrowserZoomKey('zero')
  nativeAttempt.steps.push(
    reset.ok
      ? 'Ctrl+0 复位到 100%（窗口：' + (reset.windowTitle ?? '未知') + '）'
      : 'Ctrl+0 复位失败：' + (reset.error ?? '')
  )
  await sleep(600)
  const at100 = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
  nativeAttempt.steps.push(
    `复位后 dpr=${at100.devicePixelRatio} innerWidth=${at100.innerWidth} outerWidth=${at100.outerWidth}`
  )
  report.zoom.baseline = at100

  let state = at100
  for (let i = 0; i < 8; i++) {
    const injected = await injectBrowserZoomKey('plus')
    if (!injected.ok) {
      nativeAttempt.steps.push('Ctrl+加号 注入失败：' + (injected.error ?? ''))
      break
    }
    await sleep(450)
    state = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
    const f = state.devicePixelRatio / at100.devicePixelRatio
    nativeAttempt.steps.push(
      `第 ${i + 1} 次 Ctrl+加号：dpr=${state.devicePixelRatio}（倍率 ${f.toFixed(3)}）innerWidth=${state.innerWidth} outerWidth=${state.outerWidth}`
    )
    if (f >= 1.9) break
  }
  const factor = state.devicePixelRatio / at100.devicePixelRatio
  const widthRatio = state.innerWidth / at100.innerWidth
  nativeAttempt.after = state
  if (factor >= 1.5 && widthRatio <= 0.75 && state.outerWidth === at100.outerWidth) {
    nativeAttempt.verified = true
    nativeAttempt.zoomPercent = Math.round(factor * 100)
    chosen = { kind: 'native-keyboard', instance: inst }
  } else {
    nativeAttempt.reason =
      '系统输入注入后 dpr 倍率 ' +
      factor.toFixed(3) +
      '、innerWidth 比率 ' +
      widthRatio.toFixed(3) +
      '（需 dpr >= 1.5 且 innerWidth <= 0.75）'
  }
}
report.zoom.attempts.push(nativeAttempt)
console.log(
  `策略1 系统原生键盘注入（真实浏览器缩放）：${nativeAttempt.verified ? '成功' : '失败'} —— ${nativeAttempt.reason ?? nativeAttempt.steps.join(' / ')}`
)
if (chosen) {
  report.zoom.method = nativeAttempt.method
  report.zoom.keySequence = nativeAttempt.steps
}

/* --- 策略 2：CDP 注入键盘事件（headless 下的浏览器级快捷键） --- */
const keyboardAttempt = {
  method: 'Input.dispatchKeyEvent（Ctrl+Equal / Ctrl+NumpadAdd 浏览器缩放快捷键）',
  steps: [],
  verified: false,
  reason: null,
}
if (!chosen) {
  await killChrome()
  inst = await launchChrome({ windowWidth: 1440 })
  await inst.pageConn.send('Page.navigate', { url: `${BASE}/` })
  await sleep(1500)
  await inst.pageConn.send('Page.bringToFront')
  await inst.pageConn.send('Emulation.setFocusEmulationEnabled', { enabled: true })
  await dispatchCtrlKey(inst.pageConn, '0', 'Digit0', 48, '0')
  keyboardAttempt.steps.push('Ctrl+0（复位到 100%）')
  await sleep(400)
  const afterReset = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
  keyboardAttempt.steps.push(
    `复位后 dpr=${afterReset.devicePixelRatio} innerWidth=${afterReset.innerWidth}`
  )
  for (let i = 0; i < 6; i++) {
    await dispatchCtrlKey(inst.pageConn, 'Equal', 'Equal', 187, '+')
    keyboardAttempt.steps.push('Ctrl+=（放大一档）')
    const s = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
    if (s.devicePixelRatio > baseline.devicePixelRatio * 1.5) {
      keyboardAttempt.verified = true
      keyboardAttempt.after = s
      break
    }
  }
  if (!keyboardAttempt.verified) {
    const s = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
    keyboardAttempt.after = s
    keyboardAttempt.reason =
      '按键已注入页面，但 devicePixelRatio 与 innerWidth 均无变化：headless 下浏览器进程不处理 CDP 注入的快捷键，真实缩放无法用键盘触发'
  }
  report.zoom.attempts.push(keyboardAttempt)
  console.log(
    `策略2 CDP 注入按键：${keyboardAttempt.verified ? '成功' : '失败'} —— ${keyboardAttempt.reason ?? ''}`
  )
  if (keyboardAttempt.verified) {
    chosen = { kind: 'keyboard', instance: inst }
    report.zoom.method = keyboardAttempt.method
    report.zoom.keySequence = keyboardAttempt.steps
  }
}

/* --- 策略 3：Chrome 自身的每站点缩放级别 --- */
const prefAttempt = {
  method: 'profile Preferences → partition.per_host_zoom_levels（与 Ctrl+Plus 同一条浏览器缩放路径）',
  level: ZOOM_LEVEL_200,
  steps: [],
  verified: false,
  reason: null,
}
if (!chosen) {
  await killChrome()
  // 校准：先按 200% 的 zoom level 起一次，量到实际倍率后再反推校准
  let level = ZOOM_LEVEL_200
  for (let attempt = 0; attempt < 3; attempt++) {
    await writeZoomProfile(level)
    inst = await launchChrome({ windowWidth: 1440 })
    await inst.pageConn.send('Page.navigate', { url: `${BASE}/` })
    await sleep(1500)
    const s = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
    const factor = s.devicePixelRatio / baseline.devicePixelRatio
    prefAttempt.steps.push(
      `zoom level ${level.toFixed(4)} → dpr=${s.devicePixelRatio}（倍率 ${factor.toFixed(3)}）innerWidth=${s.innerWidth}`
    )
    if (factor >= 1.5 && factor <= 2.5) {
      prefAttempt.verified = true
      prefAttempt.after = s
      prefAttempt.level = level
      chosen = { kind: 'per-host-zoom', instance: inst }
      break
    }
    if (factor > 1.02) {
      // 倍率对但不是 2：按实测倍率反推需要的 level
      const next = level * (Math.log(2) / Math.log(factor))
      prefAttempt.steps.push(`按实测倍率 ${factor.toFixed(3)} 反推下一个 level = ${next.toFixed(4)}`)
      await killChrome()
      level = next
      continue
    }
    prefAttempt.steps.push('dpr 未变化：该 profile 写法在当前 Chrome 上没生效')
    await killChrome()
    break
  }
  report.zoom.attempts.push(prefAttempt)
  console.log(
    `策略2 每站点缩放级别：${prefAttempt.verified ? '成功' : '失败'} —— ${prefAttempt.reason ?? prefAttempt.steps.join(' / ')}`
  )
  if (prefAttempt.verified) {
    report.zoom.method = prefAttempt.method
    report.zoom.keySequence = [`profile partition.per_host_zoom_levels.localhost = ${prefAttempt.level}`]
    chosen = { kind: 'per-host-zoom', instance: inst }
  }
}

/* --- 策略 4：退化方案（设备像素比模拟，不算真实缩放） --- */
const dsfAttempt = {
  method: '--force-device-scale-factor=2（设备像素比模拟，不是浏览器缩放）',
  verified: false,
  reason: null,
}
if (!chosen) {
  await killChrome()
  await writeZoomProfile(0)
  inst = await launchChrome({ windowWidth: 1440, forceDeviceScaleFactor: 2 })
  await inst.pageConn.send('Page.navigate', { url: `${BASE}/` })
  await sleep(1500)
  const s = await evaluateOn(inst.pageConn, `(${zoomState.toString()})()`)
  dsfAttempt.after = s
  dsfAttempt.reason =
    '退化方案：只把设备像素比变成 2，CSS 视口宽度不变（innerWidth 未收窄），因此不是浏览器缩放'
  report.zoom.attempts.push(dsfAttempt)
  console.log(`策略3 设备像素比模拟：已启用，但明确标注为「非真实缩放」`)
  chosen = { kind: 'device-scale-factor', instance: inst }
}

let conn = chosen.instance.pageConn
let browserConn = chosen.instance.browserConn
let targetId = chosen.instance.target.id

/* --------------------------- 2) 自证：缩放真的生效了吗 --------------------------- */

const zoomed = await evaluateOn(conn, `(${zoomState.toString()})()`)
report.zoom.zoomed = zoomed
// 基准取「同一个实例、缩放之前」的那一组状态：
// 策略 1 用系统输入注入时会在有界面实例上重新量一份 100% 基准，
// 它比 headless 基准更贴近矩阵实际使用的那个实例。
const zoomBaseline = report.zoom.baseline ?? baseline
const dprFactor = zoomed.devicePixelRatio / zoomBaseline.devicePixelRatio
const widthRatio = zoomed.innerWidth / zoomBaseline.innerWidth
const outerDelta = Math.abs(zoomed.outerWidth - zoomBaseline.outerWidth)
report.zoom.effectiveZoomPercent = Math.round(dprFactor * 100)
report.zoom.baseline = zoomBaseline
report.zoom.isRealBrowserZoom = chosen.kind !== 'device-scale-factor'
report.zoom.verified =
  chosen.kind !== 'device-scale-factor' &&
  dprFactor >= 1.5 &&
  widthRatio <= 0.75 &&
  zoomed.innerWidth < zoomBaseline.innerWidth &&
  outerDelta <= 2
if (!report.zoom.verified) {
  report.zoom.verificationReason =
    chosen.kind === 'device-scale-factor'
      ? '设备像素比模拟：dpr 变了但 CSS 视口没有变窄，不能算真实浏览器缩放'
      : `自证失败：dpr 倍率 ${dprFactor.toFixed(3)}（需 >= 1.5），innerWidth 比率 ${widthRatio.toFixed(3)}（需 <= 0.75），outerWidth 变化 ${outerDelta}px（需 <= 2，证明是页面缩放而不是把窗口改小）`
  failures.push({
    kind: 'real-zoom-not-verified',
    appearance: 'all',
    appearanceName: '全部',
    page: '-',
    width: '-',
    section: 'real-zoom',
    selector: '-',
    value: `dpr ${zoomBaseline.devicePixelRatio}→${zoomed.devicePixelRatio}, innerWidth ${zoomBaseline.innerWidth}→${zoomed.innerWidth}, outerWidth ${zoomBaseline.outerWidth}→${zoomed.outerWidth}`,
    threshold: 'dpr 跃升 >=1.5× 且 CSS 视口收窄 <=0.75× 且物理窗口不变',
    unit: '',
    text: '',
    detail: `真实 200% 缩放未验证：${report.zoom.verificationReason}`,
  })
  console.log(
    `自证结果：失败 —— dpr ${zoomBaseline.devicePixelRatio}→${zoomed.devicePixelRatio}，innerWidth ${zoomBaseline.innerWidth}→${zoomed.innerWidth}`
  )
} else {
  console.log(
    `自证结果：通过 —— dpr ${zoomBaseline.devicePixelRatio}→${zoomed.devicePixelRatio}（${report.zoom.effectiveZoomPercent}%），innerWidth ${zoomBaseline.innerWidth}→${zoomed.innerWidth}px（视口收窄到 ${(widthRatio * 100).toFixed(1)}%）`
  )
}
console.log(
  `记录：outerWidth ${zoomBaseline.outerWidth}→${zoomed.outerWidth}，visualViewport.scale ${zoomBaseline.visualViewportScale}→${zoomed.visualViewportScale}`
)

/* --------------------------- 3) 矩阵测量 --------------------------- */

await seedRecord(conn)

const PROBE_CONFIG = buildProbeConfig()
const coverage = {
  expected: WIDTH_PRESETS.length * ZOOM_PAGES.length * APPEARANCES.length,
  measured: 0,
  notCovered: 0,
  /** 实际 CSS 视口与标称档位相符的组数 */
  atRequestedWidth: 0,
  /** 受平台限制（浏览器最小窗口宽度）没量到标称档位的组数 */
  platformLimited: 0,
}
report.coverage = coverage

let currentPhysical = null
for (const preset of WIDTH_PRESETS) {
  const physicalWidth = preset.cssWidth * 2
  if (currentPhysical !== physicalWidth) {
    const resized = await setWindowWidth(conn, browserConn, targetId, physicalWidth)
    if (!resized.ok) {
      console.log(`  窗口尺寸调整失败（${resized.error}），改用重启 Chrome 的方式`)
      await killChrome()
      if (chosen.kind === 'per-host-zoom') {
        await writeZoomProfile(prefAttempt.level ?? ZOOM_LEVEL_200)
      }
      // native-keyboard / keyboard 的缩放级别由 Chrome 自己存在 profile 里，
      // 重启后会自动恢复，这里不要重写 profile 把缩放抹掉。
      const restarted = await launchChrome({
        windowWidth: physicalWidth,
        headful: chosen.kind === 'native-keyboard',
      })
      conn = restarted.pageConn
      browserConn = restarted.browserConn
      targetId = restarted.target.id
      await conn.send('Page.navigate', { url: `${BASE}/` })
      await sleep(1200)
      await seedRecord(conn)
      if (chosen.kind === 'keyboard') {
        // 重启后键盘缩放不会自动保留，重新按一遍
        await conn.send('Page.bringToFront')
        await conn.send('Emulation.setFocusEmulationEnabled', { enabled: true })
        await dispatchCtrlKey(conn, '0', 'Digit0', 48, '0')
        for (let i = 0; i < 6; i++) {
          await dispatchCtrlKey(conn, 'Equal', 'Equal', 187, '+')
          const s = await evaluateOn(conn, `(${zoomState.toString()})()`)
          if (s.devicePixelRatio > baseline.devicePixelRatio * 1.5) break
        }
      }
      if (chosen.kind === 'native-keyboard') {
        // 系统注入的缩放级别 Chrome 已存进 profile；这里只做一次自证
        const s = await evaluateOn(conn, `(${zoomState.toString()})()`)
        if (s.devicePixelRatio < zoomBaseline.devicePixelRatio * 1.5) {
          await conn.send('Page.bringToFront')
          await sleep(400)
          for (let i = 0; i < 8; i++) {
            await injectBrowserZoomKey('plus')
            await sleep(400)
            const t = await evaluateOn(conn, `(${zoomState.toString()})()`)
            if (t.devicePixelRatio >= zoomBaseline.devicePixelRatio * 1.9) break
          }
        }
      }
      const afterResize = await evaluateOn(conn, `(${zoomState.toString()})()`)
      console.log(
        `  重启后窗口 ${physicalWidth}px：dpr=${afterResize.devicePixelRatio} innerWidth=${afterResize.innerWidth}`
      )
    }
    currentPhysical = physicalWidth
    await sleep(300)
  }

  for (const appearance of APPEARANCES) {
    await setAppearance(conn, appearance.id)
    for (const p of ZOOM_PAGES) {
      const loaded = await navAndWait(conn, p.url, p.key)
      const ctx = {
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: p.name,
        width: preset.cssWidth,
        cssWidth: null, // 用实测的 clientWidth
        section: 'real-zoom',
      }
      if (!loaded.ok) {
        coverage.notCovered += 1
        failures.push({
          kind: 'page-not-covered',
          appearance: appearance.id,
          appearanceName: appearance.name,
          page: p.name,
          width: preset.cssWidth,
          section: 'real-zoom',
          selector: p.key,
          value: loaded.reason,
          threshold: '页面必须渲染成功',
          unit: '',
          text: (loaded.info?.bodyText ?? '').slice(0, 60),
          detail: `真实200% ${appearance.id}/${p.name}@${preset.label} 未覆盖：${loaded.reason}`,
        })
        console.log(`  FAIL ${preset.label} ${appearance.id}/${p.name} 未覆盖（${loaded.reason}）`)
        continue
      }
      const probe = await evaluateOn(
        conn,
        `(${pageProbe.toString()})(${JSON.stringify(PROBE_CONFIG)})`
      )
      // 核对「实际 CSS 视口」是不是真的到了这一档：
      // 浏览器有最小窗口宽度，请求 195px 时实际可能只有 243px。
      // 这一档如果没有真的量到，就不能按标称档位记账，要单列成平台限制。
      const actualCssWidth = probe.doc.clientWidth
      const widthDeviation = actualCssWidth - preset.cssWidth
      const widthMatched = Math.abs(widthDeviation) <= WIDTH_TOLERANCE
      if (widthMatched) coverage.atRequestedWidth += 1
      else {
        coverage.platformLimited += 1
        report.platformLimits.push({
          appearance: appearance.id,
          page: p.name,
          preset: preset.label,
          requestedCssWidth: preset.cssWidth,
          actualCssWidth,
          deviation: widthDeviation,
          devicePixelRatio: probe.doc.devicePixelRatio,
          reason:
            widthDeviation > 0
              ? `实际 CSS 视口比标称宽 ${widthDeviation}px：浏览器最小窗口宽度限制，标称 ${preset.cssWidth}px 未达到（实测 ${actualCssWidth}px）`
              : `实际 CSS 视口比标称窄 ${-widthDeviation}px：标称 ${preset.cssWidth}px 未达到（实测 ${actualCssWidth}px）`,
        })
      }
      const judged = evaluateProbe(probe, {
        ...ctx,
        cssWidth: actualCssWidth,
      })
      failures.push(...judged.failures)
      exemptions.push(...judged.exemptions)
      coverage.measured += 1

      const shot = await conn.send('Page.captureScreenshot', { format: 'png' })
      const shotName = `${appearance.id}-${p.name}-${preset.label}.png`
      await writeFile(join(OUT, shotName), Buffer.from(shot.result.data, 'base64'))

      report.matrix.push({
        appearance: appearance.id,
        appearanceName: appearance.name,
        page: p.name,
        preset: preset.label,
        note: preset.note,
        status: judged.status,
        requestedCssWidth: preset.cssWidth,
        actualCssWidth,
        widthDeviation,
        widthMatched,
        effectiveTier: widthMatched ? preset.label : `${preset.label}@${actualCssWidth}px`,
        actualInnerWidth: probe.doc.innerWidth,
        devicePixelRatio: probe.doc.devicePixelRatio,
        visualViewportScale: probe.doc.visualViewportScale,
        screenshot: shotName,
        checks: judged.checks,
      })
      console.log(
        `${judged.status === 'fail' ? 'FAIL' : judged.status === 'exempt' ? 'EXPT' : 'OK  '} ${preset.label.padEnd(18)} ${appearance.id}/${p.name.padEnd(10)} CSS视口=${actualCssWidth}px（标称 ${preset.cssWidth}px，偏差 ${widthDeviation > 0 ? '+' : ''}${widthDeviation}px${widthMatched ? '' : ' ← 平台限制档'}）dpr=${probe.doc.devicePixelRatio} 溢出=${judged.checks.overflow.status} 字号<12px=${judged.checks.smallType.count} 对比度=${judged.checks.contrast.count} 目标<24px=${judged.checks.smallTargets.count}`
      )
    }
  }
}

/* --------------------------- 4) 汇总 --------------------------- */

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
  realZoomVerified: report.zoom.verified,
  platformLimits: report.platformLimits.length,
}

await writeFile(join(OUT, 'zoom-real-200.json'), JSON.stringify(report, null, 2))

const describe = (f) =>
  [
    `[${f.kind}]`,
    f.appearanceName ?? f.appearance,
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
  `真实缩放：${report.zoom.verified ? '已验证' : '未验证'}（方式：${report.zoom.method ?? '-'}，实测 ${report.zoom.effectiveZoomPercent ?? '-'}%）`
)
console.log(
  `覆盖 ${coverage.measured}/${coverage.expected} 组；失败 ${failures.length} 项 / 豁免 ${exemptions.length} 项`
)
console.log(
  `其中达到标称档位 ${coverage.atRequestedWidth} 组` +
    (coverage.platformLimited
      ? `，平台限制档 ${coverage.platformLimited} 组（见下）`
      : '（全部组都量到了标称 CSS 视口）')
)
if (report.platformLimits.length) {
  console.log('平台限制档（没量到标称 CSS 视口，按实测值记账）：')
  const seen = new Set()
  for (const p of report.platformLimits) {
    const key = p.preset + '|' + p.requestedCssWidth + '|' + p.actualCssWidth
    if (seen.has(key)) continue
    seen.add(key)
    console.log(`  - ${p.preset}：标称 ${p.requestedCssWidth}px → 实测 ${p.actualCssWidth}px（${p.reason}）`)
  }
}
if (Object.keys(byKind).length) {
  console.log('失败分类：' + Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join('  '))
}
if (exemptions.length) {
  console.log(`豁免 ${exemptions.length} 项：`)
  for (const e of exemptions) {
    console.log(`  - ${describe(e)} —— 豁免理由：${e.exemptReason}`)
  }
}
if (failures.length === 0) {
  console.log('全部通过，无失败项')
} else {
  console.log(`失败 ${failures.length} 项：`)
  for (const f of failures) {
    console.log('  - ' + describe(f) + (f.detail ? `（${f.detail}）` : ''))
  }
}
console.log(`报告：${join(OUT, 'zoom-real-200.json')}`)

await killChrome()
process.exit(failures.length === 0 ? 0 : 1)
