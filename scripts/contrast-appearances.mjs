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
  if (isField) {
    // 原值**总是**先存下来（不只是空的时候）：
    // 早期实现只在空值时存，释放时却无条件用这个属性恢复，
    // 于是本来有内容的输入框被清空了——审核工具不能改用户的输入。
    // 只在第一次准备时存，避免第二次准备把「示例文字」当成原值存回去。
    if (!el.hasAttribute('data-pc-old-value')) {
      el.setAttribute('data-pc-old-value', el.value)
    }
    if (!el.value) {
      // 输入框空着的时候画面上没有字，量不到对比度：临时塞一段示例文字（测完还原）
      const proto =
        el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
      setter.call(el, '示例文字')
      filled = true
    }
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
  // 只作诊断与兜底用——判定值改用**屏幕上真正画出来的字色**（见 analyzePair），
  // 组透明度、伪元素、text-fill 都会被那一版如实算进去。
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
  // 元素实际呈现的缩放倍率：
  // transform: scale(.5) 之后，computed font-size 仍是 32px，
  // 但屏幕上看到的是 16px——按 32px 选「大字」门槛就会放过本该按正文判的文字。
  // getBoundingClientRect() 含所有 transform 的缩放，offsetWidth 不含，
  // 两者相除就是实际呈现倍率（含祖先的缩放）。
  const visualScale = (node) => {
    try {
      const rect = node.getBoundingClientRect()
      const own = node.offsetWidth || rect.width
      if (!own || !isFinite(own) || own <= 0) return 1
      const s = rect.width / own
      return s > 0.05 && s < 20 ? s : 1
    } catch (e) {
      return 1
    }
  }
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  let textNode = null
  while ((textNode = walker.nextNode())) {
    if (!(textNode.nodeValue || '').trim()) continue
    const parent = textNode.parentElement
    if (!parent) continue
    const pcs = getComputedStyle(parent)
    const pcolor = pcs.color
    const popacity = effectiveOpacity(parent)
    const pscale = visualScale(parent)
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
        fontSize: parseFloat(pcs.fontSize) * pscale,
        fontWeight: parseInt(pcs.fontWeight) || 400,
        scale: pscale,
        text: (textNode.nodeValue || '').trim().slice(0, 40),
      })
    }
  }
  // 输入框 / 文本域没有文本节点，文字是浏览器渲染的 value：
  // 用整个盒子当片段，字色取元素自身的计算 color。
  if (fragments.length === 0) {
    const escale = visualScale(el)
    fragments.push({
      x: 0,
      y: 0,
      w: r.width,
      h: r.height,
      color: cs.color,
      opacity: effectiveOpacity(el),
      fontSize: parseFloat(cs.fontSize) * escale,
      fontWeight: parseInt(cs.fontWeight) || 400,
      scale: escale,
      text: 'value',
    })
  }

  // 替换元素（SVG 图标、图片、canvas）记录下来**只作诊断**：
  // 早期实现把它们整个外接矩形当遮挡区排除，结果把「压在图标框里的可见文字」
  // 一起排除了（透明空 SVG + 前景文字就是这种情况）。
  // 现在靠掩膜本身把它们排除掉：掩膜不强制 SVG 的 fill/stroke，
  // 于是 SVG 在两张掩膜里长得一样，相减后自然消失 ✓。
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
    document.getElementById('__pc_placeholder')?.remove()
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

/**
 * 页面内：把目标元素及其子元素的文字变透明。
 *
 * 原样恢复：改之前把元素/后代的内联 color 存下来（data-pc-old-color），
 * 恢复时写回去——直接 removeProperty 会把应用自己写的内联颜色也抹掉，
 * 那样后面再测同一个元素时读到的字色就不对了。
 *
 * 伪元素（::before/::after）的生成内容也一起变透明：
 * 那不是元素自己的文本片段，留着会污染「无字」那张图的底色。
 */
function makeTransparent(tag, on) {
  const el = document.querySelector(`[data-pc-target="${tag}"]`)
  if (!el) return false
  const nodes = [el, ...el.querySelectorAll('*')]
  const styleId = `__pc_pseudo_${tag}`
  // 要清掉的「文字绘制通道」：
  // color 只是其中一条，-webkit-text-fill-color 会盖过它继续把字画出来，
  // 少了它，「无字」那张图里字还在（实测会把 21:1 算成 1:1）。
  const inkProps = {
    color: 'transparent',
    '-webkit-text-fill-color': 'transparent',
    // 置透明期间关掉过渡（理由同 applyMask）：
    // 恢复时如果还在过渡，前后读到的字色 alpha 不一样，
    // 会被自己的操作误判成「测量期间页面在动」。
    transition: 'none',
  }
  if (on) {
    nodes.forEach((c) => {
      c.dataset.pcOldInk = JSON.stringify(
        Object.keys(inkProps).map((prop) => ({
          prop,
          v: c.style.getPropertyValue(prop),
          p: c.style.getPropertyPriority(prop),
        }))
      )
      for (const prop of Object.keys(inkProps)) {
        try {
          c.style.setProperty(prop, inkProps[prop], 'important')
        } catch (e) {
          /* 忽略 */
        }
      }
    })
    const sel = `[data-pc-target="${tag}"]`
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `
${sel}::before, ${sel}::after, ${sel} *::before, ${sel} *::after {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}
`
    document.head.appendChild(style)
  } else {
    nodes.forEach((c) => {
      const raw = c.dataset.pcOldInk
      if (!raw) return
      let list = []
      try {
        list = JSON.parse(raw)
      } catch (e) {
        list = []
      }
      for (const item of list) {
        // 顺序很重要：**transition 最后恢复**，而且中间强制结算一次样式。
        // 元素自带 `transition: all .2s` 时，工具把字色改成 transparent
        // 会触发它的颜色过渡；恢复时如果颜色和 transition 在同一次样式结算里
        // 生效，颜色会在过渡中途被读到（rgba(...,0.235) 之类），
        // 被自己的操作误判成「测量期间页面在动」。
        if (item.prop === 'transition') continue
        if (!item.v) c.style.removeProperty(item.prop)
        else c.style.setProperty(item.prop, item.v, item.p || '')
      }
      void c.offsetWidth
      for (const item of list) {
        if (item.prop !== 'transition') continue
        if (!item.v) c.style.removeProperty(item.prop)
        else c.style.setProperty(item.prop, item.v, item.p || '')
      }
      delete c.dataset.pcOldInk
    })
    document.getElementById(styleId)?.remove()
  }
  return true
}

/** 页面内：测完一个元素后清掉标记与临时内容 */
function releaseTarget(tag) {
  const el = document.querySelector(`[data-pc-target="${tag}"]`)
  if (!el) return false
  el.removeAttribute('data-pc-target')
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
    const proto =
      el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(el, el.getAttribute('data-pc-old-value') || '')
    el.removeAttribute('data-pc-old-value')
  }
  return true
}

/**
 * 页面内：给目标元素套上「受控背景」——白底黑字（或白底无字）。
 *
 * 用途：单独截**与原背景无关**的字形掩膜。
 * 有了它，算法就能在原背景上认出「哪里是文字」，
 * 包括字色与底色相同（黑字压纯黑底）这种「有字/无字两图完全一样」的情况。
 *
 * mode：
 *   'text' —— 白底黑字（掩膜 A）
 *   'none' —— 白底无字（掩膜 B）
 * 两张掩膜相减才是纯字形：原生控件（滚动条、textarea 的缩放抓手）
 * 在两张里长得一样，相减后自动消失——只靠「非白即字」会把它们误认成文字。
 *
 * 关键实现（第三轮独立审核逼出来的）：
 * 1. **强制样式走内联 style.setProperty(..., 'important')**，
 *    而不是只靠样式表的 `!important`。
 *    内联 important 在层叠里压过样式表的 important，
 *    所以像 `<span style="background-color:black!important">` 这种写法
 *    不会再把掩膜的白底顶掉（顶掉的话那段字在掩膜里就消失了，
 *    落点丢失 → 元素被别处的文字「带过」→ 假通过）。
 *    用完按原值原样恢复（含优先级）。
 * 2. **不强制 fill / stroke**：SVG 图标在自己的两张掩膜里长得一样，
 *    相减后自然消失，不必再把整个外接矩形当遮挡区排除
 *    （那样会把压在图标框里的可见文字也一起排掉）。
 * 3. **伪元素生成内容在两张掩膜里都中性化**：
 *    `::before/::after` 的文字不属于元素自己的文本片段，
 *    让它在两张里都透明，就不会变成假的文字落点。
 */
function applyMask(tag, mode, on) {
  const el = document.querySelector(`[data-pc-target="${tag}"]`)
  if (!el) return false
  const styleId = `__pc_mask_${tag}`
  const existing = document.getElementById(styleId)
  if (!on) {
    if (existing) existing.remove()
    // 恢复内联强制样式
    const nodes = [el, ...el.querySelectorAll('*')]
    nodes.forEach((c) => {
      const raw = c.dataset.pcMaskSaved
      if (!raw) return
      let saved = {}
      try {
        saved = JSON.parse(raw)
      } catch (e) {
        saved = {}
      }
      // 恢复顺序：**transition 最后恢复**，而且中间要强制结算一次样式。
      //
      // 元素自带 `transition: all .2s` 时，掩膜把字色改成 #000 / transparent
      // 会触发它的颜色过渡。还原时如果只是「先改颜色、最后改 transition」，
      // 浏览器会在**同一次样式结算**里同时看到两者 → 过渡照跑，
      // 颜色在过渡中途被读到（rgba(...,0.235) 之类），
      // 被自己的操作误判成「测量期间页面在动」。
      // 强制一次重排，让「颜色恢复」在 transition:none 的状态下先结算掉。
      const propsOrder = Object.keys(saved).filter((p) => p !== 'transition')
      propsOrder.push('transition')
      for (const prop of propsOrder) {
        const entry = saved[prop]
        if (prop === 'transition') continue
        if (!entry || !entry.v) c.style.removeProperty(prop)
        else c.style.setProperty(prop, entry.v, entry.p || '')
      }
      void c.offsetWidth
      for (const prop of propsOrder) {
        const entry = saved[prop]
        if (prop !== 'transition') continue
        if (!entry || !entry.v) c.style.removeProperty(prop)
        else c.style.setProperty(prop, entry.v, entry.p || '')
      }
      delete c.dataset.pcMaskSaved
    })
    return true
  }
  if (existing) existing.remove()
  const nodes = [el, ...el.querySelectorAll('*')]
  const ink = mode === 'none' ? 'transparent' : '#000000'
  const props = {
    opacity: '1',
    color: ink,
    '-webkit-text-fill-color': ink,
    'background-color': '#FFFFFF',
    'background-image': 'none',
    'border-color': '#FFFFFF',
    'outline-color': '#FFFFFF',
    'text-decoration-color': '#FFFFFF',
    'text-shadow': 'none',
    'box-shadow': 'none',
    // 强制期间关掉过渡：
    // 工具自己改内联色会触发元素的 color 过渡，
    // 恢复时颜色还在过渡中途——前后两次读到的字色 alpha 不一样，
    // 会被自己的操作误判成「测量期间页面在动」。
    transition: 'none',
  }
  nodes.forEach((c) => {
    // 快照只在**第一次**强制时记：第二次（换 ink 颜色）如果再记一遍，
    // 存下来的就是「上一次强制后的值」，还原时会把掩膜样式留在页面上——
    // 那个 -webkit-text-fill-color 会盖过 color 继续把字画成黑色，
    // 「无字」那张图就废了。
    let saved = {}
    const already = c.dataset.pcMaskSaved
    if (already) {
      try {
        saved = JSON.parse(already)
      } catch (e) {
        saved = {}
      }
    } else {
      for (const prop of Object.keys(props)) {
        saved[prop] = { v: c.style.getPropertyValue(prop), p: c.style.getPropertyPriority(prop) }
      }
      try {
        c.dataset.pcMaskSaved = JSON.stringify(saved)
      } catch (e) {
        /* 忽略 */
      }
    }
    for (const prop of Object.keys(props)) {
      try {
        c.style.setProperty(prop, props[prop], 'important')
      } catch (e) {
        /* 某些属性在个别元素上不可设，忽略 */
      }
    }
  })
  const sel = `[data-pc-target="${tag}"]`
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
${sel}::before, ${sel}::after, ${sel} *::before, ${sel} *::after {
  color: transparent !important;
  -webkit-text-fill-color: transparent !important;
}
`
  document.head.appendChild(style)
  return true
}

/**
 * 页面内：把所有动画推到终态。
 *
 * 入场动画（framer-motion）可能**在测量中途才启动**：
 * 比如 whileInView 动画要等元素滚进视口才触发，
 * 稳定轮询那一瞬间还没有动画在跑，等截图时动画却已经跑了一半。
 * 四张截图落在动画的不同帧上，掩膜和原背景就对不上了，
 * 会量出「文字压在半透明装饰上」的假低对比度。
 * 所以每次截图前都再冻一次，保证四张图是同一帧。
 */
function freezeAnimations() {
  if (!document.getAnimations) return 0
  let n = 0
  document.getAnimations().forEach((a) => {
    try {
      const timing = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null
      if (timing && timing.iterations === Infinity) a.pause()
      else a.finish()
      n += 1
    } catch (e) {
      try {
        a.pause()
      } catch (e2) {
        /* 忽略 */
      }
    }
  })
  return n
}

/** 页面内：读一个元素当前的渲染状态（用来判断两次截图之间页面有没有变） */
function readState(selector, index) {
  const el = document.querySelectorAll(selector)[index]
  if (!el) return { missing: true }
  const r = el.getBoundingClientRect()
  const cs = getComputedStyle(el)
  let acc = 1
  let n = el
  while (n && n.nodeType === 1) {
    const o = parseFloat(getComputedStyle(n).opacity)
    if (Number.isFinite(o)) acc *= o
    n = n.parentElement
  }
  // 片段矩形：后代在动画里来回动时，元素外盒可能没变，片段却已经错位了，
  // 只看外盒会漏掉这种漂移。
  const fragments = []
  try {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let node = null
    while ((node = walker.nextNode())) {
      if (!(node.nodeValue || '').trim()) continue
      const range = document.createRange()
      try {
        range.selectNodeContents(node)
      } catch (e) {
        continue
      }
      for (const rect of range.getClientRects()) {
        if (rect.width < 0.5 || rect.height < 0.5) continue
        fragments.push({
          x: Math.round((rect.left - r.left) * 10) / 10,
          y: Math.round((rect.top - r.top) * 10) / 10,
          w: Math.round(rect.width * 10) / 10,
          h: Math.round(rect.height * 10) / 10,
          text: (node.nodeValue || '').trim().slice(0, 40),
        })
      }
    }
  } catch (e) {
    /* 忽略 */
  }
  return {
    x: r.x,
    y: r.y,
    w: r.width,
    h: r.height,
    color: cs.color,
    opacity: acc,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    fragments,
  }
}

/**
 * 页面内：分析两张截图。
 *
 * coreMedianRatio = 字芯像素中位前景 / 中位背景的对比度（参考值）
 * weakestRatio    = **文字色落在最不利底色上的对比度**（判定值）
 * minPixelRatio   = 逐像素「该像素自己的颜色 vs 脚下底色」的对比度（参考量）
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
 * 再往后（发布准备复验）又补了一条更狠的边界：
 * 同一张图右半边是 #010101 / #000000 底，**黑字压纯黑底**时
 * 「有字」和「无字」两张图在那一侧**逐像素完全相同**——
 * 差值法在任何阈值下都找不到那个落点，于是又报出左半边的 21:1。
 * 这说明「用原背景的差值找字」这条路本身就是死的：
 * 底色和字色一样时，那两张图里**根本没有关于「有没有字」的信息**。
 *
 * 这一版把「哪里是文字」和「对比度多大」**彻底解耦**：
 * 文字位置改由**受控背景下的字形掩膜**认定——
 * 把目标强制画成「白底黑字」再截一张（applyMask），
 * 掩膜里非白像素就是字形，覆盖率 α = 1 − 平均亮度/255，
 * 与原背景毫无关系；黑字压纯黑底时掩膜照样能认出字形。
 * 然后回到**原背景**上取该落点的底色，用该片段自己的字色算对比度。
 * 每个落点用**它所属文本片段自己的颜色** C 去算对比度，
 * 多色后代（<em> 强调色等）各自配对，不会张冠李戴。
 *
 * 抗锯齿边缘的逐像素混合值仍然记录下来，名字是 minPixelRatio，只作参考。
 *
 * 第三个参数组之后的 maskB64 是**受控背景掩膜**：
 * 少了这张图，「有字/无字」两张图在同色落点上完全没有信息，
 * 算法无法判断那里到底有没有字——那种情况下宁可报错，也不能报一个假的高对比度。
 */
function analyzePair(aB64, bB64, fragments, obstacles, maskTextB64, maskNoneB64) {
  return (async () => {
    if (!maskTextB64 || !maskNoneB64) {
      throw new Error(
        '缺少受控背景掩膜：仅凭「有字/无字」两张图无法区分「文字与底色同色」的落点' +
          '（黑字压纯黑底时两图完全相同），必须提供两张「白底黑字 / 白底无字」掩膜图'
      )
    }
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
    const M1 = await load(maskTextB64)
    const M2 = await load(maskNoneB64)
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

    // 「有字 − 无字」的差值：只作参考量与诊断用（最小像素比、差异像素数）。
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

    // 受控背景掩膜的覆盖率 α：
    // 掩膜 A（白底黑字）− 掩膜 B（白底无字）＝纯字形。
    // 原生控件（滚动条、textarea 的缩放抓手）在两张掩膜里长得一样，相减后消失，
    // 不会被误认成文字；字形像素的差值 = 255×α，与原背景毫无关系。
    // 这一步把「哪里是文字」和「对比度多大」彻底分开：
    // 掩膜认字只看字形，底色多少留到后面用原背景去算。
    const maskAlpha = new Float32Array(W * H)
    for (let p = 0, i = 0; p < W * H; p++, i += 4) {
      const d =
        (Math.abs(M1.data[i] - M2.data[i]) +
          Math.abs(M1.data[i + 1] - M2.data[i + 1]) +
          Math.abs(M1.data[i + 2] - M2.data[i + 2])) /
        3
      maskAlpha[p] = Math.max(0, Math.min(1, d / 255))
    }

    // 替换元素（图标 / 图片）不是文字，它们的像素不算文字落点。
    //
    // 注意：**这里只作诊断，不再真的排除**。
    // 旧实现按替换元素的**整个外接矩形**排除落点，
    // 于是「透明空 SVG 框里的可见文字」被一起排掉
    // （独立审核实测：掩膜已认出 2972 个落点，全被障碍矩形删了 → 报 21:1 通过）。
    // 现在掩膜不强制 fill/stroke：SVG 图标在自己的两张掩膜里长得一样，
    // 相减后自然消失，不再需要整框排除。
    const blocked = (x, y) => {
      for (const o of obstacles || []) {
        if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) return true
      }
      return false
    }

    const NOISE = 3 // 单通道差值低于此值视为噪声（PNG 无损，剩下的都是抗锯齿边）
    const ALPHA_MIN = 0.5 // 掩膜覆盖率到这个程度才算「这个像素被文字盖住了」
    const CORE_ALPHA = 0.9 // 覆盖率到这个程度，字芯像素才是「纯字色」
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
    // 每个片段单独判：不同片段可能字号不同（大字阈值 3:1 / 正文 4.5:1），
    // 必须各按各的实际呈现字号选门槛，不能整个元素共用一个。
    const fragResults = []
    // 诊断：没测到文字时要能说清是「掩膜里没有字」还是「差异不够」还是「片段没颜色」
    const diag = {
      fragmentCount: fragList.length,
      parsedColorCount: 0,
      diffPixelCount: 0,
      fragMaskPixelCount: 0,
      maskTextPixelCount: 0,
      maskMaxAlpha: 0,
      maxDiffInFrag: 0,
      uncoveredFragments: 0,
    }
    diag.diffPixelCount = diffPixelCount
    for (let p = 0; p < W * H; p++) {
      if (maskAlpha[p] >= ALPHA_MIN) diag.maskTextPixelCount++
      if (maskAlpha[p] > diag.maskMaxAlpha) diag.maskMaxAlpha = Math.round(maskAlpha[p] * 100) / 100
    }

    const medianOf = (list) => {
      if (!list.length) return null
      const c = list.slice().sort((x, y) => x - y)
      const m = c[Math.floor(c.length / 2)]
      return { r: m.r, g: m.g, b: m.b }
    }

    for (const frag of fragList) {
      const C = parseColor(frag.color)
      if (!C) continue
      diag.parsedColorCount++
      const fx0 = Math.max(0, Math.floor(frag.x))
      const fy0 = Math.max(0, Math.floor(frag.y))
      const fx1 = Math.min(W - 1, Math.ceil(frag.x + frag.w) - 1)
      const fy1 = Math.min(H - 1, Math.ceil(frag.y + frag.h) - 1)
      // 本片段的落点与字芯
      const fragCore = []
      const fragEdge = []
      let fragWorst = Infinity
      let fragWorstIdx = -1
      let fragWorstFg = null
      let fragWorstBg = null
      for (let y = fy0; y <= fy1; y++) {
        for (let x = fx0; x <= fx1; x++) {
          const p = y * W + x
          if (isEdge(x, y)) continue
          // 文字像素由**受控背景掩膜**认定：只看字形覆盖率，与原底色无关。
          // 这样字色和底色一样（黑字压纯黑底）时，那个落点照样会被算进来。
          const alpha = maskAlpha[p]
          if (alpha < ALPHA_MIN) continue
          diag.fragMaskPixelCount++
          const i = p * 4
          const bg = { r: B.data[i], g: B.data[i + 1], b: B.data[i + 2] }
          const painted = { r: A.data[i], g: A.data[i + 1], b: A.data[i + 2] }
          if (alpha >= CORE_ALPHA) {
            fragCore.push({ p, i, bg, painted, alpha })
            coreFgList.push(painted)
            coreBgList.push(bg)
          } else {
            fragEdge.push({ p, i, bg, painted, alpha })
          }
          // 参考值：这个像素自己（抗锯齿混合后）的颜色对它脚下底色的对比度
          const rp = ratio(painted, bg)
          if (rp < minPixel) {
            minPixel = rp
            minPixelFg = painted
            minPixelBg = bg
          }
        }
      }

      // 这一段文字**在屏幕上真正画出来的颜色**：
      // 取字芯像素（A 图）反解出来的纯字色。
      //
      // 反解公式：painted = α·C + (1−α)·bg  →  C = (painted − (1−α)·bg) / α
      // 其中 α 是掩膜给出的覆盖率（掩膜是纯黑字压纯白底，差值正好等于 255×α）。
      // 小字号（12~14px）的笔画只有一两个像素宽，字芯覆盖率往往到不了 1，
      // 直接拿 painted 当字色会**系统性低估**对比度（12px 实测低估约 16%，
      // 会把 5.1:1 报成 4.26:1，凭空造出失败）。反解之后拿到的才是真实字色。
      //
      // 声明色（color 的自身 alpha 合成到底色）作为**上界**一起参与：
      // 取两者里更保守的那个，避免反解在极端情况下把字色算得过头。
      const pureColor = (painted, bg, alpha) => {
        if (alpha >= 0.995) return painted
        const inv = {
          r: (painted.r - (1 - alpha) * bg.r) / alpha,
          g: (painted.g - (1 - alpha) * bg.g) / alpha,
          b: (painted.b - (1 - alpha) * bg.b) / alpha,
        }
        return {
          r: Math.max(0, Math.min(255, inv.r)),
          g: Math.max(0, Math.min(255, inv.g)),
          b: Math.max(0, Math.min(255, inv.b)),
        }
      }
      const corePainted = fragCore.map((s) => pureColor(s.painted, s.bg, s.alpha))
      const rendered = medianOf(corePainted)
      // 声明色只作兜底（没有字芯像素时）：半透明字色按自身 alpha 合成到底色上，
      // **不再**把组 opacity 再乘一次（那是屏幕上的效果，不是字色本身的属性）。
      const declaredEff = (bg) => composite(C, bg)
      const fragColor = rendered || declaredEff({ r: 255, g: 255, b: 255 })

      const fragSamples = []
      const evaluateSpot = (s, usePainted) => {
        const bg = s.bg
        // 字芯像素：用反解出来的纯字色（最接近真实的文字颜色）；
        // 边缘像素：抗锯齿混合过，用片段的中位字色更准。
        const fg = usePainted ? pureColor(s.painted, bg, s.alpha) : fragColor
        // 声明色给出的「意图对比度」作为上界一起看：取更保守的那个。
        const r = Math.min(ratio(fg, bg), ratio(declaredEff(bg), bg))
        if (r < fragWorst) {
          fragWorst = r
          fragWorstIdx = s.p
          fragWorstFg = fg
          fragWorstBg = bg
        }
        if (r < weakest) {
          weakest = r
          weakestIdx = s.p
          weakestFg = fg
          weakestBg = bg
        }
        if (fragSamples.length < 60) {
          fragSamples.push({
            x: s.p % W,
            y: Math.floor(s.p / W),
            ratio: Math.round(r * 100) / 100,
            textColor: {
              r: Math.round(fg.r),
              g: Math.round(fg.g),
              b: Math.round(fg.b),
            },
            backdrop: { r: bg.r, g: bg.g, b: bg.b },
            painted: { r: s.painted.r, g: s.painted.g, b: s.painted.b },
            alpha: Math.round(s.alpha * 100) / 100,
          })
        }
      }
      for (const s of fragCore) evaluateSpot(s, true)
      for (const s of fragEdge) evaluateSpot(s, false)

      // 片段级覆盖检查：这段文字在掩膜里一个字形都没认出来 →
      // 说明掩膜没能覆盖它（内联 important 背景、filter、遮罩层等），
      // 这种情况下不能拿「别处的文字」当这个元素的通过依据。
      // 但**被裁切到画面外**的片段不算：它本来就看不见，
      // 截图里根本没有它的像素（Range 的矩形仍然会报出被裁掉的那几行）。
      const inFrame = fx1 >= 0 && fx0 <= W - 1 && fy1 >= 0 && fy0 <= H - 1
      const inkCount = fragCore.length + fragEdge.length
      const covered = inkCount > 0 || !inFrame
      if (!covered) diag.uncoveredFragments++

      const fontSize = Number.isFinite(frag.fontSize) ? frag.fontSize : 16
      const fontWeight = Number.isFinite(frag.fontWeight) ? frag.fontWeight : 400
      // 门槛（3:1 / 4.5:1）由调用侧算：analyzePair 会被序列化进页面执行，
      // 拿不到 Node 侧的 THRESHOLDS。
      fragResults.push({
        text: frag.text ?? '',
        covered,
        inkCount,
        coreCount: fragCore.length,
        ratio: fragWorst === Infinity ? null : Math.round(fragWorst * 100) / 100,
        point: fragWorstIdx >= 0 ? { x: fragWorstIdx % W, y: Math.floor(fragWorstIdx / W) } : null,
        fg: fragWorstFg,
        bg: fragWorstBg,
        fontSize: Math.round(fontSize * 10) / 10,
        fontWeight,
        samples: fragSamples.sort((a, b) => a.ratio - b.ratio).slice(0, 12),
      })
      for (const s of fragSamples) {
        if (samples.length < 400) samples.push(s)
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
      // 逐片段结果：调用侧按各片段自己的实际字号选门槛
      fragmentResults: fragResults,
      // 有片段在掩膜里一个字形都没认出来 → 取证不完整，不能当通过依据
      uncoveredFragments: diag.uncoveredFragments,
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
  let prevColor = null
  let stableSamples = 0
  /** 等页面稳定：动画停了，而且字色连续两次读数相同 */
  const settle = async () => {
    prevColor = null
    stableSamples = 0
    const deadline = Date.now() + 4000
    while (Date.now() < deadline) {
      prepared = await evaluate(
        `(${prepareTarget.toString()})(${JSON.stringify(selector)}, ${index}, ${JSON.stringify(tag)})`
      )
      if (prepared.missing) break
      if (prepared.invisible) break
      // 连续多次采样都「没有动画在跑 + 字色没变」才算稳。
      // 为什么要连续多次而不是一次：
      //   - 字色本身也要稳定：按钮的入场淡入是 CSS color 过渡
      //     （computed color 的 alpha 在变），它不在 document.getAnimations() 里，
      //     冻结动画管不到——不额外等一下，前后两次读到的字色 alpha 不一样，
      //     会被判成「测量期间页面在动」。
      //   - framer-motion 的错峰入场是**一个接一个**开始的，两个动画之间
      //     会有一小段「没有动画在跑」的缝；只看一次就收工，
      //     很可能正好收在那条缝里，下一张截图时新动画才启动 → 判成漂移
      //     （实测青岚图鉴页偶发一次 unstable，复跑即过）。
      if (prepared.settled && prepared.color === prevColor) stableSamples += 1
      else stableSamples = 0
      prevColor = prepared.color
      if (stableSamples >= 2) break
      await sleep(120)
    }
    return prepared
  }
  await settle()
  if (prepared.missing) return { status: 'missing' }
  if (prepared.invisible) return { status: 'invisible', ...prepared }
  // 还是没稳定（例如有循环动画一直在跑）：按「元素当前的不透明度」如实记录，
  // 并在报告里标出来，不当成通过依据。
  if (!prepared.settled) {
    prepared.unsettled = true
  }

  // 再冻一次动画并**重新取一次目标状态**：
  // 冻结会把动画推到终态，元素的 opacity/位置可能跟稳定轮询那一瞬间不同，
  // 字色与覆盖率必须按冻结后的状态算。
  await evaluate(`(${freezeAnimations.toString()})()`)
  prepared = await evaluate(
    `(${prepareTarget.toString()})(${JSON.stringify(selector)}, ${index}, ${JSON.stringify(tag)})`
  )
  if (prepared.missing) return { status: 'missing' }
  if (prepared.invisible) return { status: 'invisible', ...prepared }
  if (!prepared.settled) prepared.unsettled = true

  const before = await evaluate(`(${readState.toString()})(${JSON.stringify(selector)}, ${index})`)

  // 截图坐标系：clip 用的是**文档坐标**（captureBeyondViewport 会渲染整页再裁），
  // 而 getBoundingClientRect() 给的是视口坐标——页面滚动过时两者差一个 scrollY，
  // 不加就会截到别的区域（审核实测：滚动 800px 后整块元素截空，判成 no-text）。
  const scroll = await evaluate(`({ x: window.scrollX, y: window.scrollY })`)
  const clipOf = (p) => ({
    x: Math.round(p.x + (scroll?.x ?? 0)),
    y: Math.round(p.y + (scroll?.y ?? 0)),
    width: Math.round(p.w),
    height: Math.round(p.h),
    scale: 1,
  })

  // 四张截图必须落在同一帧上：**每张之前都重新冻结一次动画**。
  const captureOnce = async () => {
    const clip = clipOf(prepared)
    await evaluate(`(${freezeAnimations.toString()})()`)
    const withText = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true,
    })
    // 第二、三张：受控背景掩膜（白底黑字 / 白底无字）。
    // 这两张只用来认「哪里是文字」，与原背景无关。
    // 没有它们，黑字压纯黑底这种落点永远找不到（详见 analyzePair 的说明）；
    // 两张相减才能把原生控件（滚动条、缩放抓手）排除掉。
    await evaluate(`(${applyMask.toString()})(${JSON.stringify(tag)}, 'text', true)`)
    await sleep(120)
    await evaluate(`(${freezeAnimations.toString()})()`)
    const maskTextShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true,
    })
    await evaluate(`(${applyMask.toString()})(${JSON.stringify(tag)}, 'none', true)`)
    await sleep(120)
    await evaluate(`(${freezeAnimations.toString()})()`)
    const maskNoneShot = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true,
    })
    await evaluate(`(${applyMask.toString()})(${JSON.stringify(tag)}, 'none', false)`)
    await sleep(60)
    // 第四张：把文字变透明，得到该落点的**原背景色**。
    await evaluate(`(${makeTransparent.toString()})(${JSON.stringify(tag)}, true)`)
    await sleep(120)
    await evaluate(`(${freezeAnimations.toString()})()`)
    const withoutText = await send('Page.captureScreenshot', {
      format: 'png',
      clip,
      captureBeyondViewport: true,
    })
    await evaluate(`(${makeTransparent.toString()})(${JSON.stringify(tag)}, false)`)
    await evaluate(`document.getElementById('__pc_placeholder')?.remove(); true`)
    await evaluate(`(${releaseTarget.toString()})(${JSON.stringify(tag)})`)
    await sleep(60)
    return { withText, withoutText, maskTextShot, maskNoneShot }
  }

  let shots = await captureOnce()
  let after = await evaluate(`(${readState.toString()})(${JSON.stringify(selector)}, ${index})`)
  const stateChanged = (a, b) => {
    if (!a || !b || a.missing || b.missing) return true
    if (Math.abs(a.x - b.x) > 0.5) return true
    if (Math.abs(a.y - b.y) > 0.5) return true
    if (Math.abs(a.w - b.w) > 0.5) return true
    if (Math.abs(a.h - b.h) > 0.5) return true
    if (a.color !== b.color) return true
    if (Math.abs(a.opacity - b.opacity) > 0.01) return true
    if ((a.scrollX ?? 0) !== (b.scrollX ?? 0)) return true
    if ((a.scrollY ?? 0) !== (b.scrollY ?? 0)) return true
    // 片段矩形：后代在动画里来回动时，元素外盒可能没变，片段却已经错位了
    const af = a.fragments ?? []
    const bf = b.fragments ?? []
    if (af.length !== bf.length) return true
    for (let i = 0; i < af.length; i++) {
      if (Math.abs(af[i].x - bf[i].x) > 0.5) return true
      if (Math.abs(af[i].y - bf[i].y) > 0.5) return true
      if (Math.abs(af[i].w - bf[i].w) > 0.5) return true
      if (Math.abs(af[i].h - bf[i].h) > 0.5) return true
      if (af[i].text !== bf[i].text) return true
    }
    return false
  }
  if (stateChanged(before, after)) {
    // 页面在截图过程中变了（多半是刚触发的入场动画）：重来一次。
    // 重来时**重新等稳定并重新取基准**：
    //   - 不重新等的话，动画还在跑，第二次照样漂移；
    //   - 不重新取基准的话，第二次即使已经稳定，也会被拿旧基准判成漂移
    //     （审核实测 parent-drift-once）。
    prepared.driftDetail = { before, after }
    await evaluate(`(${freezeAnimations.toString()})()`)
    await settle()
    if (prepared.missing) return { status: 'missing' }
    if (prepared.invisible) return { status: 'invisible', ...prepared }
    if (!prepared.settled) prepared.unsettled = true
    const before2 = await evaluate(
      `(${readState.toString()})(${JSON.stringify(selector)}, ${index})`
    )
    shots = await captureOnce()
    after = await evaluate(`(${readState.toString()})(${JSON.stringify(selector)}, ${index})`)
    if (stateChanged(before2, after)) {
      prepared.unsettled = true
      prepared.drift = true
      prepared.driftDetail = { before: before2, after }
    }
  }

  const withText = shots.withText
  const withoutText = shots.withoutText
  const maskTextShot = shots.maskTextShot
  const maskNoneShot = shots.maskNoneShot

  if (!withText.result?.data || !withoutText.result?.data || !maskTextShot.result?.data || !maskNoneShot.result?.data) {
    return { status: 'no-text', ...prepared }
  }
  const analysis = await evaluate(
    `(${analyzePair.toString()})(${JSON.stringify(withText.result.data)}, ${JSON.stringify(withoutText.result.data)}, ${JSON.stringify(prepared.fragments ?? [])}, ${JSON.stringify(prepared.obstacles ?? [])}, ${JSON.stringify(maskTextShot.result.data)}, ${JSON.stringify(maskNoneShot.result.data)})`
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

  // 片段级判定：每一段文字按**它自己实际呈现的字号/字重**选门槛。
  // 整个元素共用一个门槛会把 transform:scale(.5) 之后的正文
  // 当成 32px 大字放过去（审核实测：实际 16px、对比度 3.54:1 却被按 3:1 判通过）。
  const fragRows = (analysis.fragmentResults ?? []).map((f) => {
    const fSize = Number.isFinite(f.fontSize) ? f.fontSize : size
    const fWeight = Number.isFinite(f.fontWeight) ? f.fontWeight : weight
    const fLarge =
      fSize >= THRESHOLDS.largeTextMinSizePx ||
      (fSize >= THRESHOLDS.largeTextBoldMinSizePx && fWeight >= THRESHOLDS.largeTextBoldMinWeight)
    const fNeed = fLarge ? THRESHOLDS.largeTextMinContrast : THRESHOLDS.minContrast
    return {
      text: f.text,
      covered: f.covered,
      inkCount: f.inkCount,
      coreCount: f.coreCount,
      ratio: f.ratio,
      fontSize: f.fontSize,
      fontWeight: f.fontWeight,
      need: fNeed,
      // 没有实测值（片段被裁切到画面外）不算失败；
      // 有实测值就按它自己的门槛判。
      ok: f.ratio === null ? f.covered : f.ratio >= fNeed,
      point: f.point,
      fg: f.fg,
      bg: f.bg,
      samples: f.samples,
    }
  })
  const failing = fragRows.filter((f) => !f.ok)
  // 取证不完整（片段在掩膜里没认出字形）→ 不能当成通过
  const uncovered = fragRows.filter((f) => !f.covered)
  // 元素级门槛取各片段里**最严**的那个：
  // transform:scale(.5) 之后的正文片段需要 4.5:1，
  // 元素自身的 computed font-size（32px）不能代表它。
  const elementNeed = fragRows.length
    ? Math.max(...fragRows.map((f) => f.need))
    : need
  return {
    status: 'measured',
    ...prepared,
    ...analysis,
    need: elementNeed,
    elementComputedNeed: need,
    // 判定值取「所有片段里最差的那个」；片段级结论在 fragmentRows 里
    ok: failing.length === 0 && uncovered.length === 0,
    fragmentRows: fragRows,
    failingFragments: failing.length,
    uncoveredFragments: uncovered.length,
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
 * 算法自检（复验方两轮 P2 的硬要求）。
 *
 * 复验方给的反例：500×70 画布，左半白底、右半深色底，两侧都画纯黑 24px 加粗文字。
 * 第二轮把深色底加到 #333 / #030303 / #010101 / #000000：
 *   - #333 那侧真实对比度 1.6621:1，旧算法（取全局最大差值 90% 以上）只看得到白底，报 21:1 判通过；
 *   - #010101 / #000000 那侧，「有字」与「无字」两张图**逐像素完全相同**，
 *     差值法在任何阈值下都找不到那个落点，同样报 21:1 判通过。
 * 后者说明「用原背景的差值找字」这条路本身是死的，
 * 必须用**受控背景下的字形掩膜**定位文字，再回到原背景算对比度。
 *
 * 自检覆盖：
 *   1) 四档深色底：报出的最弱值必须落在深色那一侧（x > 250）且低于 4.5；
 *   2) 单色合格文本（黑字只落白底）必须仍然通过（>= 4.5）；
 *   3) 多色后代：两个片段各用各的字色，低对比那个片段必须被抓出来。
 *
 * 组透明度、伪元素、text-fill、transform 缩放这些**只有真实 DOM 才表达得出来**的
 * 组合，由另一个 DOM 级门禁覆盖：`scripts/contrast-dom-regressions.mjs`
 * （canvas 画不出 CSS 组透明度的叠加语义，放在这里测只会自欺欺人）。
 * 自检不过就中止脚本，不产出通过结论。
 */
async function runAlgorithmSelfTest() {
  const res = await evaluate(`(async () => {
    const analyze = ${analyzePair.toString()}
    const W = 500, H = 70
    const b64 = (canvas) => canvas.toDataURL('image/png').split(',')[1]

    // 双色底：左半白底、右半 gray 底，两侧都画同样的黑字
    const makeTwoTone = (gray, withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W / 2, H)
      x.fillStyle = gray; x.fillRect(W / 2, 0, W / 2, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
        x.fillText('MMMM', W / 2 + 10, 45)
      }
      return b64(c)
    }
    // 受控背景掩膜：白底黑字 / 白底无字（与原背景无关的字形图）
    const makeMask = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
        x.fillText('MMMM', W / 2 + 10, 45)
      }
      return b64(c)
    }
    // 单色合格样例：黑字只落白底
    // 注意：文字位置必须与掩膜一致（左右两半都画），
    // 否则掩膜里有字、原图没字的那一侧会被算成「字色==底色」= 1:1。
    const makeWhite = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
        x.fillText('MMMM', W / 2 + 10, 45)
      }
      return b64(c)
    }
    // 多色后代：左半白底黑字、右半白底深灰字（#767676 → 约 4.54:1，低于大字阈值 3? 不，用 #808080 更低）
    const makeTwoColors = (withText) => {
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const x = c.getContext('2d')
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H)
      if (withText) {
        x.fillStyle = '#000000'
        x.font = 'bold 24px sans-serif'
        x.fillText('MMMM', 10, 45)
        x.fillStyle = '#9a9a9a'
        x.fillText('MMMM', W / 2 + 10, 45)
      }
      return b64(c)
    }

    const frags = [{ x: 0, y: 0, w: W, h: H, color: 'rgb(0, 0, 0)' }]
    const maskText = makeMask(true)
    const maskNone = makeMask(false)
    const out = { grays: [], white: null, multiColor: null }

    for (const gray of ['#333333', '#030303', '#010101', '#000000']) {
      const r = await analyze(makeTwoTone(gray, true), makeTwoTone(gray, false), frags, [], maskText, maskNone)
      out.grays.push({ gray, ratio: r.weakestRatio, point: r.weakestPoint, pixels: r.corePixelCount })
    }

    const white = await analyze(makeWhite(true), makeWhite(false), frags, [], maskText, maskNone)
    out.white = { ratio: white.weakestRatio, point: white.weakestPoint, pixels: white.corePixelCount }

    // 多色：左半黑字、右半 #9a9a9a 字；片段按左右各给一个颜色
    const multiFrags = [
      { x: 0, y: 0, w: W / 2, h: H, color: 'rgb(0, 0, 0)' },
      { x: W / 2, y: 0, w: W / 2, h: H, color: 'rgb(154, 154, 154)' },
    ]
    const mc = await analyze(makeTwoColors(true), makeTwoColors(false), multiFrags, [], maskText, maskNone)
    out.multiColor = { ratio: mc.weakestRatio, point: mc.weakestPoint }

    return out
  })()`)

  const problems = []
  const grays = res?.grays ?? []
  // 深色底四档：真实值依次约 1.66 / 1.02 / 1.01 / 1.00，全部低于 4.5
  const expected = { '#333333': 1.66, '#030303': 1.02, '#010101': 1.01, '#000000': 1.0 }
  for (const g of grays) {
    if (g.ratio === null) {
      problems.push('深色底 ' + g.gray + ' 没有测出任何文字落点（weakestRatio=null）')
      continue
    }
    if (!(g.ratio < 4.5)) {
      problems.push('深色底 ' + g.gray + ' 未被判失败：weakestRatio=' + g.ratio + '，应 < 4.5（真实值约 ' + expected[g.gray] + ':1）')
    }
    if (!g.point || !(g.point.x > 250)) {
      problems.push('深色底 ' + g.gray + ' 的最弱落点没落在深色那一侧：point=' + JSON.stringify(g.point))
    }
    const exp = expected[g.gray]
    if (exp && Math.abs(g.ratio - exp) > 0.2) {
      problems.push('深色底 ' + g.gray + ' 的最弱值偏差过大：实测 ' + g.ratio + '，真实约 ' + exp)
    }
  }
  if (grays.length < 4) {
    problems.push('深色底自检只跑了 ' + grays.length + ' 档，应为 4 档')
  }

  const white = res?.white
  if (!white || white.ratio === null) {
    problems.push('合格样例没有测出文字落点（weakestRatio=null）')
  } else if (!(white.ratio >= 4.5)) {
    problems.push('合格样例被误判：weakestRatio=' + white.ratio + '，应 >= 4.5')
  }

  // 多色后代：右半 #9a9a9a 压白底约 2.85:1，必须被抓出来（不能按左半的黑色算成 21:1）
  const mc = res?.multiColor
  if (!mc || mc.ratio === null) {
    problems.push('多色样例没有测出文字落点（weakestRatio=null）')
  } else if (!(mc.ratio < 4.5)) {
    problems.push('多色后代没有按各自字色配对：weakestRatio=' + mc.ratio + '，应 < 4.5（#9a9a9a 压白底约 2.85:1）')
  } else if (!(mc.ratio > 2)) {
    problems.push('多色后代的实测值异常偏低：weakestRatio=' + mc.ratio + '（#9a9a9a 压白底约 2.6~2.9:1）')
  }

  const ok = problems.length === 0
  console.log('\n=== 算法自检 ===')
  for (const g of grays) {
    console.log(
      '  深色底 ' + g.gray + ': weakestRatio=' + g.ratio + ' 最弱落点=' + JSON.stringify(g.point)
    )
  }
  console.log('  合格样例（黑字压白底）: weakestRatio=' + (white ? white.ratio : 'null'))
  console.log('  多色后代（各自字色）: weakestRatio=' + (mc ? mc.ratio : 'null'))
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

// 调试用：只测某几个组合（如 DSH_ONLY=qinglan/divination）。
// 正式取证不要设这个变量——报告要覆盖全部组合。
const ONLY = (process.env.DSH_ONLY ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const shouldMeasure = (appearance, page) => !ONLY.length || ONLY.includes(`${appearance}/${page}`)

for (const appearance of APPEARANCES) {
  await setAppearance(appearance)
  for (const p of PAGES) {
    if (!shouldMeasure(appearance, p.name)) continue
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
            (d.maskTextPixelCount ?? 0) === 0
              ? '受控背景掩膜里没有找到字形（截图与原背景对不上，或元素不在画面上）'
              : (d.fragMaskPixelCount ?? 0) === 0
                ? '掩膜里有字形，但都落在文字片段之外'
                : `片段内掩膜最大覆盖率 ${d.maskMaxAlpha}，文字片段 ${d.fragmentCount} 个`
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
        // 取证不可信的三种情况，一律**判失败**，绝不当作通过依据：
        //   1) 测量期间页面在动（unsettled / drift）；
        //   2) 有文字片段在掩膜里没认出字形（取证不完整）；
        //   3) 片段实测值低于它自己的门槛。
        const unstable = r.unsettled === true || r.drift === true
        const incomplete = (r.uncoveredFragments ?? 0) > 0
        const row = {
          ...base,
          status: exempt ? 'exempt' : unstable || incomplete || !r.ok ? 'fail' : 'pass',
          exempt,
          exemptReason: exempt ? reason : undefined,
          cssColor: r.color,
          fontSize: r.size,
          fontWeight: r.weight,
          elementOpacity: r.opacity,
          settled: r.settled !== false && !unstable,
          unstable,
          drift: r.drift === true,
          driftDetail: r.driftDetail,
          uncoveredFragments: r.uncoveredFragments ?? 0,
          failingFragments: r.failingFragments ?? 0,
          fragmentRows: r.fragmentRows,
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
        if (unstable) {
          row.detail = '测量期间页面发生变化（动画/位移），重测后仍不稳定：结果不可信，按失败处理'
        } else if (incomplete) {
          row.detail = `有 ${r.uncoveredFragments} 段文字在受控背景掩膜里没认出字形（取证不完整），按失败处理`
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
        } else if (unstable) {
          report.failures.push({
            kind: 'unstable',
            appearance,
            page: p.name,
            label,
            selector,
            index,
            value: r.weakestRatio,
            threshold: '测量期间页面保持稳定',
            unit: '',
            text: r.text,
            detail: `${appearance}/${p.name}/${label} 测量期间页面发生变化（重测后仍不稳定）：结果不可信，不作为通过依据`,
          })
        } else if (incomplete) {
          report.failures.push({
            kind: 'incomplete-coverage',
            appearance,
            page: p.name,
            label,
            selector,
            index,
            value: r.uncoveredFragments,
            threshold: '每段文字都要在掩膜里认得出字形',
            unit: '段',
            text: r.text,
            detail: `${appearance}/${p.name}/${label} 有 ${r.uncoveredFragments} 段文字在受控背景掩膜里没认出字形：取证不完整，不作为通过依据`,
          })
        } else if (!r.ok) {
          const worstFrag = (r.fragmentRows ?? [])
            .filter((f) => !f.ok)
            .sort((a, b) => (a.ratio ?? 99) - (b.ratio ?? 99))[0]
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
            detail:
              `${appearance}/${p.name}/${label} 最弱落点对比度 ${r.weakestRatio}:1 < ${r.need}:1` +
              (worstFrag
                ? `（片段「${worstFrag.text}」实际字号 ${worstFrag.fontSize}px 需 ${worstFrag.need}:1）`
                : `（字芯中位 ${r.coreMedianRatio}:1）`),
          })
        }
        if (!worstRow || r.weakestRatio < worstRow.weakestRatio) worstRow = row
        const mark = exempt ? 'EXPT' : row.status === 'pass' ? 'OK  ' : 'FAIL'
        const extra = unstable ? ' [不稳定]' : incomplete ? ' [取证不完整]' : ''
        console.log(
          `  ${mark} ${label.padEnd(12)} #${index} 最弱=${String(r.weakestRatio).padEnd(6)} 中位=${String(r.coreMedianRatio).padEnd(6)} 像素=${String(r.minPixelRatio ?? '-').padEnd(6)} 需=${r.need}  字号=${r.size.padEnd(5)} 最弱点=(${r.weakestRelativePoint?.x ?? '-'},${r.weakestRelativePoint?.y ?? '-'}) CSS色=${r.color.padEnd(20)} 「${r.text}」${extra}`
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
