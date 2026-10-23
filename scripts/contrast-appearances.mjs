/**
 * 三套外观的关键文字对比度（像素级，量真实合成底色）
 *
 * 用法：
 *   node scripts/contrast-appearances.mjs
 *
 * 方法（与上一轮修正后的做法一致）：
 *   对目标元素截两张图——正常、以及把该元素文字设为 transparent；
 *   两图的差集就是「字的像素」，差集位置在第二张图上的颜色就是它背后的
 *   真实底色（图片 / 渐变 / 半透明叠层都算进去），再与文字色算对比度。
 *   这样量出来的就是眼睛真正看到的对比度，而不是 CSS 里写的 background-color。
 *
 * 两个指标（对应 docs/reviews/2026-10-23-three-appearances-acceptance.md 的 P2-02）：
 *   - coreMedianRatio：字芯像素（差值 >= 0.9*最大差值）的前景色中位数 / 背景色中位数之比。
 *     它偏向上限，只能当参考值。
 *   - weakestRatio：字芯像素里「逐像素前景/背景对比度」的最小值 —— 也就是整个文字区域里
 *     最弱的落点，并记录该落点在元素内的相对坐标，便于人工复核。
 *   判定以 weakestRatio >= need 为准（更严），coreMedianRatio 一并写进 JSON 作参考。
 *
 * 覆盖缺项不再静默跳过：
 *   - 选择器一个都没匹配到 → 记 not-covered，并计入失败；
 *   - 匹配到但元素不可见（0 尺寸 / display:none）→ 同样记 not-covered，并计入失败；
 *   - aria-hidden 的装饰元素、显式声明的装饰目标 → 记 exempt，必须写 exemptReason。
 *
 * 环境变量：
 *   DSH_BASE_URL  默认 http://localhost:5173
 *   DSH_CDP       默认 http://127.0.0.1:9222
 *   DSH_OUT       默认 screenshots/contrast
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
import { THRESHOLDS, CONTRAST_TARGETS, PIXEL_PROBE_SCRIPT } from './shared-appearances-probe.mjs'

const BASE = process.env.DSH_BASE_URL ?? 'http://localhost:5173'
const CDP = process.env.DSH_CDP ?? 'http://127.0.0.1:9222'
const OUT = process.env.DSH_OUT ?? 'screenshots/contrast'
await mkdir(OUT, { recursive: true })

const APPEARANCES = ['qinglan', 'zhusha', 'yehang']

/**
 * 每个页面上要量的关键文字。
 * 条目格式：[标签, 选择器] 或 [标签, 选择器, 豁免理由]
 * 豁免理由必须写清「为什么这一项可以不算失败」，否则不允许豁免。
 */
const TARGETS = {
  home: {
    common: [],
    qinglan: [
      ['hero 标题', '.ql-hero__title'],
      ['hero 正文', '.ql-hero__lede'],
      ['每日卦境标题', '.ql-today__heading h2'],
      ['卦名', '.ql-today__reading h3'],
      ['今日解读', '.ql-today__summary'],
      ['行动入口', '.ql-explore__link'],
      ['滚动提示', '.ql-today__change'],
      ['山水图注（装饰）', '.ql-scene__index', '装饰性图注：元素自带 aria-hidden，不承载信息'],
      ['山水题刻（装饰）', '.ql-scene__poem', '装饰性书法纹样：重复首页主旨，不承载独立信息'],
    ],
    zhusha: [
      ['hero 标题', '.zh-hero__title'],
      ['hero 正文', '.zh-hero__lede'],
      ['今日卦境', '.zh-today__heading'],
      ['今日解读', '.zh-today__reading p'],
      ['主按钮', '.zh-primary'],
      ['副按钮', '.zh-text-action'],
      ['主行动条', '.zh-index-strip'],
    ],
    yehang: [
      ['hero 标题', '.yh-hero__title'],
      ['hero 正文', '.yh-hero__lead'],
      ['今日卦境', '.yh-today__heading'],
      ['今日解读', '.yh-today__reading p'],
      ['主按钮', '.yh-btn'],
      ['副按钮', '.yh-btn--text'],
      ['星图标注', '.yh-readout'],
    ],
  },
  divination: {
    common: [],
    qinglan: [
      ['页面标题', '.ql-cast__intro h1'],
      ['副标题', '.ql-cast__intro > p'],
      ['问题输入', 'textarea'],
      ['灵数标签', '.number-box-label'],
      ['状态提示', '.ql-cast__status b'],
      ['启卦按钮', '.ql-cast__submit'],
    ],
    zhusha: [
      ['页面标题', '.zh-cast__caption'],
      ['表单标题', '.zh-form__title'],
      ['问题输入', '.zh-textarea'],
      ['灵数标签', '.zh-number__hint'],
      ['状态提示', '.zh-status'],
      ['启卦按钮', '.zh-submit'],
    ],
    yehang: [
      ['页面标题', '.yh-cast__caption'],
      ['表单标题', '.yh-form__title'],
      ['问题输入', 'textarea'],
      ['灵数标签', '.yh-field__title-label'],
      ['状态提示', '.yh-form__note'],
      ['启卦按钮', '.yh-form__submit'],
    ],
  },
  result: {
    common: [],
    qinglan: [
      ['结果标题', '.ql-result__heading h1'],
      ['问题横幅', '.ql-result__banner-question'],
      ['卦名', '.ql-result-card h2'],
      ['侧栏正文', '.ql-result__sidebar-lead'],
      ['解读正文', '.ql-result__lead'],
    ],
    zhusha: [
      ['结果标题', '.zh-result__heading h1'],
      ['问题横幅', '.zh-banner__question'],
      ['卦名', '.zh-pair__link'],
      ['解读正文', '.zh-ai__content p'],
      ['侧栏正文', '.zh-sidebar p'],
      ['卦名水印（装饰）', '.zh-pair__watermark', '纯装饰水印：重复呈现同一卦名，不承载独立信息'],
    ],
    yehang: [
      ['结果标题', '.yh-result__heading h1'],
      ['问题横幅', '.yh-question-banner'],
      ['卦名', '.yh-reading-pair h3'],
      ['解读正文', '.yh-interpretation__content p'],
    ],
  },
  settings: {
    common: [
      ['页匾标题', 'h1'],
      ['区块标题', 'h2'],
      ['小节说明', '.text-ink-light'],
    ],
  },
  codex: {
    common: [
      ['页匾标题', 'h1'],
      ['卦名（卡片）', '.font-display.font-bold'],
    ],
  },
  records: {
    common: [
      ['页匾标题', 'h1'],
      ['正文', 'p'],
    ],
  },
  feed: {
    common: [
      ['页匾标题', 'h1'],
      ['正文', 'p'],
    ],
  },
}

const PAGES = [
  { name: 'home', url: `${BASE}/` },
  { name: 'divination', url: `${BASE}/divination` },
  { name: 'result', url: `${BASE}/result/contrast-record` },
  { name: 'settings', url: `${BASE}/settings` },
  { name: 'codex', url: `${BASE}/codex` },
  { name: 'records', url: `${BASE}/records` },
  { name: 'feed', url: `${BASE}/feed` },
]

/* --------------------------- CDP --------------------------- */

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
    throw new Error('页面脚本异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 300))
  }
  return r.result?.result?.value
}

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

async function seedRecord() {
  await evaluate(`(() => {
    localStorage.setItem('zhouyi:records', JSON.stringify([{
      id: 'contrast-record', type: 'three-number', createdAt: Date.now() - 3600e3,
      question: '面对新的工作机会，我该如何把握进退？', numbers: [123, 456, 789],
      region: 'Asia/Shanghai', timezone: 'Asia/Shanghai', mainHexagramId: 15,
      movingLine: 2, changedHexagramId: 46, version: 1,
      aiInterpretation: '## 卦象概要\\n泽地萃，聚集之象。\\n\\n## 当前状态\\n你正站在一个可以主动选择的关口。'
    }]))
    return true
  })()`)
}

/** 等待页面渲染完 */
async function waitRendered(key = 'main') {
  const deadline = Date.now() + 15000
  let last = null
  while (Date.now() < deadline) {
    // 导航过程中 document.body 可能还没建好（此时 body.innerText 会抛），
    // 这种瞬时异常不是「页面没渲染」，继续轮询即可，不该记成失败。
    try {
      last = await evaluate(`(() => ({
      ready: document.readyState,
      elements: document.querySelectorAll('body *').length,
      hasKey: !!document.querySelector(${JSON.stringify(key)}),
      appearance: document.documentElement.getAttribute('data-appearance'),
      viteOverlay: !!document.querySelector('vite-error-overlay'),
      text: ((document.body && document.body.innerText) || '').slice(0, 200)
    }))()`)
    } catch (e) {
      last = { transientError: String(e.message).slice(0, 120) }
      await sleep(150)
      continue
    }
    if (
      last &&
      last.ready === 'complete' &&
      last.hasKey &&
      last.elements > 20 &&
      !last.viteOverlay &&
      !/ERR_CONNECTION|无法访问此网站/.test(last.text)
    ) {
      return last
    }
    await sleep(150)
  }
  throw new Error('页面未渲染: ' + JSON.stringify(last).slice(0, 200))
}

/* --------------------------- 像素级测量 --------------------------- */

/**
 * 页面内：这一帧是否已经稳定下来。
 *
 * 入场动画（淡入）会让元素的 opacity 处在 0.05 这样的中间值，
 * 这时候量到的「文字颜色」其实是半透明的中间态，算出来的对比度是假的。
 * 有限动画（iterations !== Infinity）跑到完就算稳定；
 * 循环动画（呼吸、流光）由 freezeScene 暂停，不参与判断。
 *
 * 注意：prepareTarget 会被单独序列化后丢进页面执行，
 * 所以那里自带了一份同样的判断，两边要保持一致。
 */
function isSettled() {
  let anims = []
  try {
    anims = document.getAnimations ? document.getAnimations() : []
  } catch (e) {
    return true
  }
  for (const a of anims) {
    const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null
    if (!t) continue
    if (t.iterations === Infinity) continue
    if (a.playState === 'running' || a.playState === 'pending') return false
  }
  return true
}

/** 页面内：准备目标元素（填示例文字、打标记、量几何） */
function prepareTarget(selector, index, tag) {
  const el = document.querySelectorAll(selector)[index]
  if (!el) return { missing: true }
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) {
    return {
      invisible: true,
      display: cs.display,
      visibility: cs.visibility,
      width: r.width,
      height: r.height,
    }
  }
  const isField = el.tagName === 'TEXTAREA' || el.tagName === 'INPUT'
  let filled = false
  if (isField && !el.value) {
    // 输入框空着的时候画面上没有字，量不到对比度：临时塞一段示例文字（测完还原）
    const proto =
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    el.setAttribute('data-pc-old-value', el.value)
    setter.call(el, '示例文字')
    filled = true
  }
  el.setAttribute('data-pc-target', tag)
  // 目标元素内部可能有多段不同颜色的文字（例如标题里的 <em> 用强调色）。
  // 把元素与后代的颜色一起收进来，判定时按「最不利的那个颜色」算，
  // 免得只拿父元素的颜色去套子元素的像素。
  const colorSet = []
  const pushColor = (c) => {
    if (c && !colorSet.includes(c)) colorSet.push(c)
  }
  pushColor(cs.color)
  el.querySelectorAll('*').forEach((c) => {
    const cc = getComputedStyle(c)
    pushColor(cc.color)
  })

  // ------------------------------------------------------------------
  // 逐文本片段的「文字矩形 + 它自己的颜色」
  //
  // 第二轮复验 P2 的硬要求：落点必须按**该处文字自己的颜色**配对，
  // 不能把元素所有后代颜色混在一起取最不利；否则一个红色的 <em>
  // 会被父元素的颜色判掉，反之亦然。
  // 坐标以元素盒子左上角为原点（与截图裁剪原点一致）。
  // ------------------------------------------------------------------
  const fragments = []
  // 元素（含祖先）的有效不透明度：
  // 文字最终渲染出来的颜色 = color 与底色按「color 的 alpha × 各级 opacity」混合。
  // 不算这一层的话，`opacity: 0.16` 的装饰水印会被当成「覆盖率只有 16%」，
  // 于是「差值 / 理论差值」算出来的覆盖率永远到不了阈值，量不到文字。
  const effectiveOpacity = (node) => {
    let acc = 1
    let n = node
    while (n && n.nodeType === 1) {
      const o = parseFloat(getComputedStyle(n).opacity)
      if (Number.isFinite(o)) acc *= o
      n = n.parentElement
    }
    return acc
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let textNode = null
  while ((textNode = walker.nextNode())) {
    if (!(textNode.nodeValue || '').trim()) continue
    const parent = textNode.parentElement
    if (!parent) continue
    const pcolor = getComputedStyle(parent).color
    const popacity = effectiveOpacity(parent)
    const range = document.createRange()
    try {
      range.selectNodeContents(textNode)
    } catch (e) {
      continue
    }
    const rects = range.getClientRects()
    for (const rect of rects) {
      if (rect.width < 0.5 || rect.height < 0.5) continue
      fragments.push({
        x: rect.left - r.left,
        y: rect.top - r.top,
        w: rect.width,
        h: rect.height,
        color: pcolor,
        opacity: popacity,
      })
    }
  }
  // 输入框 / 文本域没有文本节点，文字是浏览器渲染的 value：
  // 用整个盒子当片段，字色取元素自身的计算 color。
  if (fragments.length === 0) {
    fragments.push({ x: 0, y: 0, w: r.width, h: r.height, color: cs.color, opacity: effectiveOpacity(el) })
  }

  // 替换元素（SVG 图标、图片、canvas）不是文字：
  // 把它们当遮挡区排除，避免 icon 的像素被当成文字落点来判。
  const obstacles = []
  el.querySelectorAll('svg, img, canvas, video, picture, iframe').forEach((c) => {
    const cr = c.getBoundingClientRect()
    if (cr.width < 0.5 || cr.height < 0.5) return
    obstacles.push({
      x: cr.left - r.left,
      y: cr.top - r.top,
      w: cr.width,
      h: cr.height,
    })
  })
  const path = []
  let node = el
  let depth = 0
  while (node && node.nodeType === 1 && node !== document.body && depth < 5) {
    let seg = node.tagName.toLowerCase()
    const cls = (node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3)
    if (cls.length) seg += '.' + cls.join('.')
    path.unshift(seg)
    node = node.parentElement
    depth += 1
  }
  return {
    missing: false,
    invisible: false,
    filled,
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    color: cs.color,
    colors: colorSet,
    fragments,
    obstacles,
    opacity: effectiveOpacity(el),
    // 这一帧是否稳定（没有有限动画在跑）：
    // 入场动画期间元素 opacity 可能只有 0.05，量到的对比度是假的。
    // 注意：prepareTarget 会被单独序列化后丢进页面执行，
    // 所以这里必须自带判断，不能引用同文件里的其他函数。
    settled: (() => {
      let anims = []
      try {
        anims = document.getAnimations ? document.getAnimations() : []
      } catch (e) {
        return true
      }
      for (const a of anims) {
        const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null
        if (!t) continue
        if (t.iterations === Infinity) continue
        if (a.playState === 'running' || a.playState === 'pending') return false
      }
      return true
    })(),
    size: cs.fontSize,
    weight: cs.fontWeight,
    text: ((el.textContent || '') + (el.value || '')).trim().replace(/\s+/g, ' ').slice(0, 24),
    ariaHidden: !!(el.closest && el.closest('[aria-hidden="true"]')),
    path: path.join(' > '),
  }
}

/** 页面内：冻结算动画、等图片、注入透明 placeholder */
function freezeScene() {
  return (async () => {
    if (document.getAnimations) {
      document.getAnimations().forEach((a) => {
        try {
          const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null
          if (timing && timing.iterations === Infinity) a.pause()
          else a.finish()
        } catch (e) {
          try {
            a.pause()
          } catch (e2) {
            /* 忽略 */
          }
        }
      })
    }
    const s = document.createElement('style')
    s.id = '__pc_placeholder'
    s.textContent = '::placeholder { color: transparent !important; }'
    document.head.appendChild(s)
    // 等图片加载完：否则两次截图之间 SVG 淡入，差集会把整幅山水当成「文字像素」
    const imgs = [...document.images].filter((i) => !i.complete)
    await Promise.all(
      imgs.map(
        (i) =>
          new Promise((res) => {
            i.addEventListener('load', res, { once: true })
            i.addEventListener('error', res, { once: true })
            setTimeout(res, 3000)
          })
      )
    )
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)))
    // 等字体加载完：否则「有字」「无字」两张截图可能用的是不同字体，
    // 差集里出现的是字形变化而不是文字覆盖，量出来的覆盖率是假的
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready
      } catch (e) {
        /* 忽略 */
      }
    }
    return true
  })()
}

/** 页面内：把目标元素及其子元素的文字变透明 */
function makeTransparent(tag, on) {
  const el = document.querySelector(`[data-pc-target="${tag}"]`)
  if (!el) return false
  if (on) {
    el.style.setProperty('color', 'transparent', 'important')
    el.querySelectorAll('*').forEach((c) => c.style.setProperty('color', 'transparent', 'important'))
  } else {
    el.style.removeProperty('color')
    el.querySelectorAll('*').forEach((c) => c.style.removeProperty('color'))
    el.removeAttribute('data-pc-target')
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      const proto =
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, el.getAttribute('data-pc-old-value') || '')
      el.removeAttribute('data-pc-old-value')
    }
  }
  return true
}

/**
 * 页面内：分析两张截图。
 *
 * coreMedianRatio = 字芯像素中位前景 / 中位背景的对比度（参考值）
 * weakestRatio    = **文字色落在最不利底色上的对比度**（判定值）
 * minPixelRatio   = 逐像素「该像素自己的颜色 vs 脚下底色」的对比度（参考值）
 *
 * 判定值的口径（第一轮验收 P2-02 的硬要求）：
 * 文字的对比度取决于两件事——文字本身的颜色，和它**落在哪一块底色上**。
 * 落到渐变 / 插画 / 图片上时，同一段文字的不同位置底色不同，
 * 只看中位数会漏掉「压在最深那块底色上」的最坏落点。
 * 所以判定值取：
 *   对每一个文字落点，取它**正下方那一块底色**，
 *   用**该处文字自己的颜色**（按 alpha 与底色合成）
 *   对这块底色算对比度，取所有落点里的**最小值**。
 *
 * 第二轮复验 P2 的硬要求（这一版改的就是这里）：
 * 旧实现用「两张图全局最大差值的 90%」来圈定哪些像素算文字像素：
 *
 *     const cut = maxDiff * 0.9
 *     if (diffs[p] >= cut) { ... }
 *
 * 这等于**优先保留前景/背景差异最大的区域**，恰好把要找的
 * 「低对比度落点」排除掉了。独立反例：同一段纯黑文字分别落在
 * 白底与 #333 底上，#333 那侧的真实对比度只有 1.66:1，
 * 旧算法因为 #333 侧的差值（51）远小于白底侧（255），
 * 压根没去看那一侧，于是报出 21:1 并判通过。
 *
 * 新实现把「哪里是文字」和「对比度多大」**解耦**：
 * 像素被文字覆盖的比例 α 可以从混色公式直接还原——
 *
 *     P = α·C + (1-α)·B   →   α = |P - B| / |C - B|
 *
 * 其中 P 是「有字」截图、 B 是「无字」截图、 C 是该处文字的真实颜色。
 * α 只取决于这个像素被盖住多少，**与对比度大小无关**，
 * 所以深底上的低对比文字照样会被认出来。
 * 每个落点再用**它所属文本片段自己的颜色** C 去算对比度，
 * 多色后代（<em> 强调色等）各自配对，不会张冠李戴。
 *
 * 抗锯齿边缘的逐像素混合值仍然记录下来，名字是 minPixelRatio，只作参考。
 */
function analyzePair(aB64, bB64, fragments, obstacles) {
  return (async () => {
    const load = async (b64) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      return {
        data: ctx.getImageData(0, 0, c.width, c.height).data,
        width: c.width,
        height: c.height,
      }
    }
    const A = await load(aB64)
    const B = await load(bB64)
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
      }
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
    }
    const ratio = (x, y) => {
      const l1 = lum(x)
      const l2 = lum(y)
      const hi = Math.max(l1, l2)
      const lo = Math.min(l1, l2)
      return (hi + 0.05) / (lo + 0.05)
    }
    const parseColor = (c) => {
      const m = String(c || '')
        .match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.%]+))?\s*\)/i)
      if (!m) return null
      const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
      return {
        r: parseFloat(m[1]),
        g: parseFloat(m[2]),
        b: parseFloat(m[3]),
        a: Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1,
      }
    }
    const composite = (c, bg) =>
      c.a >= 1
        ? { r: c.r, g: c.g, b: c.b }
        : {
            r: c.a * c.r + (1 - c.a) * bg.r,
            g: c.a * c.g + (1 - c.a) * bg.g,
            b: c.a * c.b + (1 - c.a) * bg.b,
          }
    const maxCh = (x, y) =>
      Math.max(Math.abs(x.r - y.r), Math.abs(x.g - y.g), Math.abs(x.b - y.b))

    const W = A.width
    const H = A.height
    // 裁剪框最外一圈像素不参与统计：
    // 截图裁到元素边界时，边界上被切掉一半的描边/边框在两次截图里的
    // 光栅化可能不同（例如匾额 SVG 被非整数倍缩放后的边缘描边），
    // 那不是文字像素，算进去会把对比度误判成 1:1。
    const edge = 1
    const isEdge = (x, y) => x < edge || y < edge || x >= W - edge || y >= H - edge

    // 每个像素「被盖住的程度」：单通道最大差（0-255）
    const diffs = new Uint16Array(W * H)
    let maxDiff = 0
    let diffPixelCount = 0
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const d = Math.max(
        Math.abs(A.data[i] - B.data[i]),
        Math.abs(A.data[i + 1] - B.data[i + 1]),
        Math.abs(A.data[i + 2] - B.data[i + 2])
      )
      diffs[p] = d
      if (d > maxDiff) maxDiff = d
      if (d >= 3) diffPixelCount++
    }

    // 替换元素（图标 / 图片）不是文字，它们的像素不算文字落点
    const blocked = (x, y) => {
      for (const o of obstacles || []) {
        if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
      }
      return false
    }

    const NOISE = 3 // 单通道差值低于此值视为噪声（PNG 无损，剩下的都是抗锯齿边）
    const ALPHA_MIN = 0.5 // 覆盖率到这个程度才算「这个像素被文字盖住了」

    let weakest = Infinity
    let weakestIdx = -1
    let weakestFg = null
    let weakestBg = null
    let minPixel = Infinity
    let minPixelFg = null
    let minPixelBg = null
    const coreFgList = []
    const coreBgList = []
    const samples = []
    const fragList = (Array.isArray(fragments) ? fragments : []).filter(Boolean)
    // 诊断：没测到文字时要能说清是「没差异」还是「差异不够」还是「片段没颜色」
    const diag = {
      fragmentCount: fragList.length,
      parsedColorCount: 0,
      diffPixelCount: 0,
      fragDiffPixelCount: 0,
      maxDiffInFrag: 0,
      expectedAtMax: 0,
      alphaAtMax: 0,
    }
    diag.diffPixelCount = diffPixelCount

    for (const frag of fragList) {
      const C = parseColor(frag.color)
      if (!C) continue
      // 元素的 opacity 也要算进字色的 alpha：
      // 渲染出来的实际颜色 = color 与底色按「alpha × opacity」混合
      const op = Number.isFinite(frag.opacity) ? frag.opacity : 1
      C.a = Math.max(0, Math.min(1, C.a * op))
      diag.parsedColorCount++
      const fx0 = Math.max(0, Math.floor(frag.x))
      const fy0 = Math.max(0, Math.floor(frag.y))
      const fx1 = Math.min(W - 1, Math.ceil(frag.x + frag.w) - 1)
      const fy1 = Math.min(H - 1, Math.ceil(frag.y + frag.h) - 1)
      for (let y = fy0; y <= fy1; y++) {
        for (let x = fx0; x <= fx1; x++) {
          const p = y * W + x
          if (isEdge(x, y)) continue
          if (blocked(x, y)) continue
          const d = diffs[p]
          if (d < NOISE) continue
          diag.fragDiffPixelCount++
          const i = p * 4
          const bg = { r: B.data[i], g: B.data[i + 1], b: B.data[i + 2] }
          const painted = { r: A.data[i], g: A.data[i + 1], b: A.data[i + 2] }
          // 这一块底色上的「有效字色」（半透明文字要按底色合成）
          const eff = composite(C, bg)
          // 该像素如果被文字完全盖住，差值应该等于 |有效字色 - 底色|
          const expected = maxCh(eff, bg)
          if (expected < 1) continue // 这块底色上分不出文字
          // 覆盖率 α = |P-B| / |C-B|：只看「盖住多少」，与对比度大小无关
          const alpha = d / expected
          if (d > diag.maxDiffInFrag) {
            diag.maxDiffInFrag = d
            diag.expectedAtMax = expected
            diag.alphaAtMax = Math.round(alpha * 100) / 100
          }
          if (alpha < ALPHA_MIN) continue
          // 判定值：这段文字自己的颜色，落在这块底色上的对比度
          const r = ratio(eff, bg)
          if (r < weakest) {
            weakest = r
            weakestIdx = p
            weakestFg = eff
            weakestBg = bg
          }
          // 参考值：这个像素自己（抗锯齿混合后）的颜色对它脚下底色的对比度
          const rp = ratio(painted, bg)
          if (rp < minPixel) {
            minPixel = rp
            minPixelFg = painted
            minPixelBg = bg
          }
          if (alpha >= 0.9) {
            coreFgList.push(painted)
            coreBgList.push(bg)
          }
          if (samples.length < 400) {
            samples.push({
              x,
              y,
              ratio: Math.round(r * 100) / 100,
              textColor: {
                r: Math.round(eff.r),
                g: Math.round(eff.g),
                b: Math.round(eff.b),
              },
              backdrop: { r: bg.r, g: bg.g, b: bg.b },
              painted: { r: painted.r, g: painted.g, b: painted.b },
              alpha: Math.round(alpha * 100) / 100,
            })
          }
        }
      }
    }

    const median = (arr) => {
      const c = arr.slice().sort((x, y) => x - y)
      return c.length ? c[Math.floor(c.length / 2)] : 0
    }
    const coreFg = {
      r: median(coreFgList.map((c) => c.r)),
      g: median(coreFgList.map((c) => c.g)),
      b: median(coreFgList.map((c) => c.b)),
    }
    const coreBg = {
      r: median(coreBgList.map((c) => c.r)),
      g: median(coreBgList.map((c) => c.g)),
      b: median(coreBgList.map((c) => c.b)),
    }
    const coreMedianRatio = coreFgList.length ? ratio(coreFg, coreBg) : null
    const point =
      weakestIdx >= 0 ? { x: weakestIdx % W, y: Math.floor(weakestIdx / W) } : null
    return {
      coreMedianRatio: coreMedianRatio === null ? null : Math.round(coreMedianRatio * 100) / 100,
      weakestRatio: weakest === Infinity ? null : Math.round(weakest * 100) / 100,
      weakestPoint: point,
      weakestFg,
      weakestBg,
      minPixelRatio: minPixel === Infinity ? null : Math.round(minPixel * 100) / 100,
      minPixelFg,
      minPixelBg,
      samples: samples.sort((a, b) => a.ratio - b.ratio).slice(0, 12),
      coreFg,
      coreBg,
      corePixelCount: coreFgList.length,
      textPixelCount: samples.length,
      fragmentCount: fragList.length,
      diag,
      maxDiff,
      imageWidth: W,
      imageHeight: H,
    }
  })()
}

/**
 * 测量单个元素。
 * 返回 { status: 'measured' | 'missing' | 'invisible' | 'no-text', ... }
 */
async function measureElement(selector, index, tag) {
  // 先冻结算动画/过渡，再取元素状态：
  // 元素颜色如果正在过渡（appearance 切换时的 color transition），
  // 读到的是中间帧（带 alpha 的插值色），用它算对比度会算错。
  await evaluate(`(${freezeScene.toString()})()`)

  // 等页面稳定下来再量：
  // 入场动画期间元素的 opacity 可能只有 0.05，这时候量到的
  // 「文字颜色」是半透明中间态，算出来的对比度是假的（会把 14:1 报成 1.25:1）。
  // 这里轮询到没有有限动画在跑为止，不用固定 sleep。
  const settleDeadline = Date.now() + 4000
  let prepared = null
  while (Date.now() < settleDeadline) {
    prepared = await evaluate(
      `(${prepareTarget.toString()})(${JSON.stringify(selector)}, ${index}, ${JSON.stringify(tag)})`
    )
    if (prepared.missing) break
    if (prepared.invisible) break
    if (prepared.settled) break
    await sleep(120)
  }
  if (prepared.missing) return { status: 'missing' }
  if (prepared.invisible) return { status: 'invisible', ...prepared }
  // 还是没稳定（例如有循环动画一直在跑）：按「元素当前的不透明度」如实记录，
  // 并在报告里标出来，不当成通过依据。
  if (!prepared.settled) {
    prepared.unsettled = true
  }

  const clip = { x: prepared.x, y: prepared.y, width: prepared.w, height: prepared.h, scale: 1 }
  const withText = await send('Page.captureScreenshot', {
    format: 'png',
    clip,
    captureBeyondViewport: true,
  })
  await evaluate(`(${makeTransparent.toString()})(${JSON.stringify(tag)}, true)`)
  await sleep(120)
  const withoutText = await send('Page.captureScreenshot', {
    format: 'png',
    clip,
    captureBeyondViewport: true,
  })
  await evaluate(`(${makeTransparent.toString()})(${JSON.stringify(tag)}, false)`)
  await evaluate(`document.getElementById('__pc_placeholder')?.remove(); true`)
  await sleep(60)

  if (!withText.result?.data || !withoutText.result?.data) {
    return { status: 'no-text', ...prepared }
  }
  const analysis = await evaluate(
    `(${analyzePair.toString()})(${JSON.stringify(withText.result.data)}, ${JSON.stringify(withoutText.result.data)}, ${JSON.stringify(prepared.fragments ?? [])}, ${JSON.stringify(prepared.obstacles ?? [])})`
  )
  if (!analysis || analysis.weakestRatio === null) {
    return { status: 'no-text', ...prepared }
  }
  const size = parseFloat(prepared.size)
  const weight = parseInt(prepared.weight) || 400
  const large =
    size >= THRESHOLDS.largeTextMinSizePx ||
    (size >= THRESHOLDS.largeTextBoldMinSizePx && weight >= THRESHOLDS.largeTextBoldMinWeight)
  const need = large ? THRESHOLDS.largeTextMinContrast : THRESHOLDS.minContrast
  const point = analysis.weakestPoint
  return {
    status: 'measured',
    ...prepared,
    ...analysis,
    need,
    ok: analysis.weakestRatio >= need,
    weakestRelativePoint: point
      ? {
          x: point.x,
          y: point.y,
          relX: prepared.w ? Math.round((point.x / prepared.w) * 1000) / 1000 : null,
          relY: prepared.h ? Math.round((point.y / prepared.h) * 1000) / 1000 : null,
        }
      : null,
  }
}

/* --------------------------- 算法自检 --------------------------- */

/**
 * 算法自检（第二轮复验 P2 的硬要求）。
 *
 * 用独立复验方给出的反例，卡住「取样偏差」这一类回归：
 *   500×70 画布，左半白底、右半 #333 底，两侧都画纯黑 24px 加粗文字。
 *   黑字压在 #333 上时真实对比度只有 1.6621:1（正文 4.5 / 大字 3 都不达标），
 *   但旧算法只取「全局最大差值的 90%」以上的那批像素，
 *   也就是只看到了白底那一侧，于是报出 21:1 并判通过。
 *
 * 自检三条：
 *   1) 反例的最弱落点必须落在深色那一侧（x > 250）；
 *   2) 反例的 weakestRatio 必须低于 4.5（即会进失败列表）；
 *   3) 单色合格文本（黑字只落白底）必须仍然通过。
 * 自检不过就中止脚本，不产出报告。
 */
async function runAlgorithmSelfTest() {
  const res = await evaluate(`(async () => {
    const analyze = ${analyzePair.toString()}
    const W = 500, H = 70
    const b64 = (canvas) => canvas.toDataURL('image/png').split(',')[1]
    const makeBoth = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W / 2, H)
      x.fillStyle = '#333333'; x.fillRect(W / 2, 0, W / 2, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
        x.fillText('MMMM', W / 2 + 10, 45)
      }
      return b64(c)
    }
    const makeWhite = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
      }
      return b64(c)
    }
    const frags = [{ x: 0, y: 0, w: W, h: H, color: 'rgb(0, 0, 0)' }]
    const both = await analyze(makeBoth(true), makeBoth(false), frags, [])
    const white = await analyze(makeWhite(true), makeWhite(false), frags, [])
    return {
      both: { ratio: both.weakestRatio, point: both.weakestPoint, pixels: both.corePixelCount },
      white: { ratio: white.weakestRatio, point: white.weakestPoint, pixels: white.corePixelCount },
    }
  })()`)

  const problems = []
  const both = res?.both
  const white = res?.white
  if (!both || both.ratio === null) {
    problems.push('反例没有测出任何文字落点（weakestRatio=null）')
  } else {
    if (!(both.ratio < 4.5)) {
      problems.push('反例未被判失败：weakestRatio=' + both.ratio + '，应 < 4.5（深色侧真实值 1.66:1）')
    }
    if (!both.point || !(both.point.x > 250)) {
      problems.push('反例的最弱落点没落在深色那一侧：point=' + JSON.stringify(both.point))
    }
  }
  if (!white || white.ratio === null) {
    problems.push('合格样例没有测出文字落点（weakestRatio=null）')
  } else if (!(white.ratio >= 4.5)) {
    problems.push('合格样例被误判：weakestRatio=' + white.ratio + '，应 >= 4.5')
  }

  const ok = problems.length === 0
  console.log('\n=== 算法自检 ===')
  console.log(
    '  反例（黑字压 #333 底）: weakestRatio=' +
      (both ? both.ratio : 'null') +
      ' 最弱落点=' +
      JSON.stringify(both ? both.point : null)
  )
  console.log('  合格样例（黑字压白底）: weakestRatio=' + (white ? white.ratio : 'null'))
  console.log(
    ok
      ? '  自检通过'
      : '  自检不通过:\n' + problems.map((p) => '    - ' + p).join('\n')
  )
  return { ok, problems, res }
}

/* --------------------------- 主流程 --------------------------- */

const report = {
  generatedAt: new Date().toISOString(),
  base: BASE,
  thresholds: THRESHOLDS,
  metrics: {
    coreMedianRatio:
      '字芯像素（覆盖率 α>=0.9）的前景色中位数 / 背景色中位数 的对比度（参考值）',
    weakestRatio:
      '按「文字覆盖率 α = |P-B| / |C-B| >= 0.5」定位文字落点（与对比度大小无关），每个落点用该处文字自己的颜色（元素计算样式 color，按 alpha 与底色合成）对它脚下那块底色算对比度，取所有落点里的最小值（判定值，越低越差）',
    minPixelRatio:
      '文字落点里「该像素自己的颜色 vs 脚下底色」的对比度最小值：量到的是抗锯齿混合，不是文字对比度，只作参考',
    decision: 'weakestRatio >= need 才算通过',
  },
  rows: [],
  failures: [],
  exemptions: [],
  summary: {},
}

await send('Emulation.setDeviceMetricsOverride', {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
})
await send('Page.navigate', { url: `${BASE}/` })
await sleep(1200)
await seedRecord()

// 算法自检必须在正式测量之前跑：自检不过说明测量本身不可信，
// 这时候产出一份「全绿」报告是最危险的。
const selfTest = await runAlgorithmSelfTest()
report.selfTest = selfTest
if (!selfTest.ok) {
  await writeFile(join(OUT, 'contrast-appearances.json'), JSON.stringify(report, null, 2))
  console.error('\n算法自检不通过，已中止测量（不产出通过结论）')
  process.exit(1)
}

let tagSeq = 0

for (const appearance of APPEARANCES) {
  await setAppearance(appearance)
  for (const p of PAGES) {
    await send('Page.navigate', { url: p.url })
    try {
      await waitRendered()
    } catch (e) {
      report.failures.push({
        kind: 'page-not-covered',
        appearance,
        page: p.name,
        label: '(整页)',
        selector: 'main',
        value: e.message.slice(0, 120),
        threshold: '页面必须渲染成功',
        unit: '',
        text: '',
        detail: `${appearance}/${p.name}: ${e.message}`,
      })
      continue
    }
    const list = [...(TARGETS[p.name].common ?? []), ...(TARGETS[p.name][appearance] ?? [])]
    console.log(`\n=== ${appearance} / ${p.name} ===`)
    for (const [label, selector, exemptReason] of list) {
      const matchCount = await evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
      if (!matchCount) {
        const row = {
          appearance,
          page: p.name,
          label,
          selector,
          status: 'not-covered',
          exempt: false,
          detail: '选择器未匹配到任何元素：该项没有被验收',
        }
        report.rows.push(row)
        report.failures.push({
          kind: 'not-covered',
          appearance,
          page: p.name,
          label,
          selector,
          value: 0,
          threshold: '>= 1 个匹配元素',
          unit: '个',
          text: '',
          detail: `${appearance}/${p.name}/${label} 选择器 ${selector} 未匹配到任何元素`,
        })
        console.log(`  NOCV ${label.padEnd(12)} 选择器未匹配（${selector}）`)
        continue
      }
      let worstRow = null
      for (let index = 0; index < matchCount; index++) {
        const tag = `pc-${appearance}-${p.name}-${tagSeq++}`
        const r = await measureElement(selector, index, tag)
        const base = {
          appearance,
          page: p.name,
          label,
          selector,
          index,
          matchedCount: matchCount,
        }
        if (r.status === 'missing') {
          report.rows.push({ ...base, status: 'not-covered', detail: '元素在测量时消失' })
          report.failures.push({
            kind: 'not-covered',
            ...base,
            value: 0,
            threshold: '>= 1 个匹配元素',
            unit: '个',
            text: '',
            detail: `${appearance}/${p.name}/${label} 第 ${index} 个元素在测量时消失`,
          })
          continue
        }
        if (r.status === 'invisible') {
          report.rows.push({
            ...base,
            status: 'not-covered',
            detail: `元素不可见（display=${r.display} visibility=${r.visibility} ${Math.round(r.width)}x${Math.round(r.height)}）`,
            width: r.width,
            height: r.height,
          })
          report.failures.push({
            kind: 'not-covered',
            ...base,
            value: `${Math.round(r.width)}x${Math.round(r.height)}`,
            threshold: '可见（宽高 > 0）',
            unit: 'px',
            text: '',
            detail: `${appearance}/${p.name}/${label} 元素不可见（display=${r.display}）`,
          })
          console.log(`  NOCV ${label.padEnd(12)} 元素不可见（${selector}）`)
          continue
        }
        if (r.status === 'no-text') {
          const d = r.diag || {}
          const why =
            (d.diffPixelCount ?? 0) === 0
              ? '两次截图完全一致（文字没有被置透明，或元素不在画面上）'
              : (d.fragDiffPixelCount ?? 0) === 0
                ? '画面上有变化，但都落在文字片段之外'
                : `片段内最大差值 ${d.maxDiffInFrag}，理论满覆盖差值 ${Math.round(
                    d.expectedAtMax ?? 0
                  )}，覆盖率 α=${d.alphaAtMax}（阈值 0.5）`
          report.rows.push({
            ...base,
            status: 'not-covered',
            detail: '元素上没有可测量的文字像素：' + why,
            diag: d,
          })
          report.failures.push({
            kind: 'not-covered',
            ...base,
            value: null,
            threshold: '可测量的文字像素',
            unit: '',
            text: r.text ?? '',
            detail: `${appearance}/${p.name}/${label} 元素上没有可测量的文字像素：${why}`,
          })
          console.log(`  NOCV ${label.padEnd(12)} 无可测文字（${selector}） ${why}`)
          continue
        }
        const exempt = Boolean(exemptReason) || r.ariaHidden
        const reason = exemptReason
          ? exemptReason
          : '元素位于 aria-hidden="true" 子树内：装饰性内容，按装饰豁免'
        const row = {
          ...base,
          status: exempt ? 'exempt' : r.ok ? 'pass' : 'fail',
          exempt,
          exemptReason: exempt ? reason : undefined,
          cssColor: r.color,
          fontSize: r.size,
          fontWeight: r.weight,
          elementOpacity: r.opacity,
          settled: r.settled !== false,
          coreMedianRatio: r.coreMedianRatio,
          weakestRatio: r.weakestRatio,
          minPixelRatio: r.minPixelRatio,
          need: r.need,
          weakestRelativePoint: r.weakestRelativePoint,
          weakestFg: r.weakestFg,
          weakestBg: r.weakestBg,
          minPixelFg: r.minPixelFg,
          minPixelBg: r.minPixelBg,
          samples: r.samples,
          coreFg: r.coreFg,
          coreBg: r.coreBg,
          corePixelCount: r.corePixelCount,
          text: r.text,
          elementPath: r.path,
        }
        report.rows.push(row)
        if (exempt) {
          report.exemptions.push({
            kind: 'contrast',
            appearance,
            page: p.name,
            label,
            selector,
            index,
            value: r.weakestRatio,
            threshold: r.need,
            unit: ':1',
            text: r.text,
            exempt: true,
            exemptReason: reason,
          })
        } else if (!r.ok) {
          report.failures.push({
            kind: 'contrast',
            appearance,
            page: p.name,
            label,
            selector,
            index,
            value: r.weakestRatio,
            threshold: r.need,
            unit: ':1',
            text: r.text,
            detail: `${appearance}/${p.name}/${label} 最弱落点对比度 ${r.weakestRatio}:1 < ${r.need}:1（字芯中位 ${r.coreMedianRatio}:1）`,
          })
        }
        if (!worstRow || r.weakestRatio < worstRow.weakestRatio) worstRow = row
        const mark = exempt ? 'EXPT' : r.ok ? 'OK  ' : 'FAIL'
        console.log(
          `  ${mark} ${label.padEnd(12)} #${index} 最弱=${String(r.weakestRatio).padEnd(6)} 中位=${String(r.coreMedianRatio).padEnd(6)} 像素=${String(r.minPixelRatio ?? '-').padEnd(6)} 需=${r.need}  字号=${r.size.padEnd(5)} 最弱点=(${r.weakestRelativePoint?.x ?? '-'},${r.weakestRelativePoint?.y ?? '-'}) CSS色=${r.color.padEnd(20)} 「${r.text}」`
        )
      }
      if (worstRow) {
        report.rows.push({
          appearance,
          page: p.name,
          label: `${label}（该选择器最差元素）`,
          selector,
          status: worstRow.status,
          summary: true,
          weakestRatio: worstRow.weakestRatio,
          coreMedianRatio: worstRow.coreMedianRatio,
          need: worstRow.need,
          exempt: worstRow.exempt,
          exemptReason: worstRow.exemptReason,
        })
      }
    }
  }
}

const statusCount = { pass: 0, fail: 0, exempt: 0, 'not-covered': 0 }
for (const row of report.rows) {
  if (row.summary) continue
  statusCount[row.status] = (statusCount[row.status] ?? 0) + 1
}
report.summary = {
  rows: report.rows.filter((r) => !r.summary).length,
  byStatus: statusCount,
  failures: report.failures.length,
  exemptions: report.exemptions.length,
}

await writeFile(join(OUT, 'contrast-appearances.json'), JSON.stringify(report, null, 2))

console.log('\n================ 结论 ================')
console.log(
  `通过 ${statusCount.pass} / 失败 ${statusCount.fail} / 豁免 ${statusCount.exempt} / 未覆盖 ${statusCount['not-covered']}`
)
if (report.exemptions.length) {
  console.log(`豁免 ${report.exemptions.length} 项：`)
  for (const e of report.exemptions) {
    console.log(
      `  - ${e.appearance}/${e.page}/${e.label}（${e.selector}）实测 ${e.value}:1 —— 豁免理由：${e.exemptReason}`
    )
  }
}
if (report.failures.length === 0) {
  console.log('全部通过，无失败项')
} else {
  console.log(`失败 ${report.failures.length} 项：`)
  for (const f of report.failures) {
    console.log(
      `  - [${f.kind}] ${f.appearance}/${f.page}/${f.label} ${f.selector ?? ''} 实测 ${f.value ?? '-'}${f.unit ?? ''} 阈值 ${f.threshold ?? '-'}${f.unit ?? ''}${f.text ? ` 「${f.text}」` : ''}`
    )
  }
}
console.log(`报告：${join(OUT, 'contrast-appearances.json')}`)
ws.close()
process.exit(report.failures.length === 0 ? 0 : 1)
