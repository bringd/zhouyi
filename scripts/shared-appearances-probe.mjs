/**
 * 三套外观验收脚本共用的判定口径与浏览器侧探针。
 *
 * 三个脚本共用同一套阈值、同一个探针、同一个判定函数，避免「脚本之间口径不一致」：
 *   - scripts/acceptance-appearances.mjs  页面矩阵（字号 / 对比度 / 目标尺寸 / 横向溢出）
 *   - scripts/contrast-appearances.mjs    像素级对比度复核（coreMedianRatio / weakestRatio）
 *   - scripts/zoom-real-200.mjs           真实浏览器 200% 缩放矩阵
 *
 * 本文件只放纯数据与纯函数，不做任何 CDP 连接。
 *
 * 判定口径（对应 docs/reviews/2026-10-23-three-appearances-acceptance.md 的 P2-02）：
 *   - 字号：非装饰正文的计算字号 < 12px 记失败。装饰性 = aria-hidden 子树
 *     + DECORATIVE_EXEMPTIONS 里显式列出的项（必须带 exemptReason）。
 *   - 对比度：< 4.5 记失败；大字号（>= 24px，或 >= 18.66px 且 font-weight >= 700）
 *     允许 3:1。文字落在位图上时 CSS 采样不可靠，记为豁免并注明交由像素级脚本复核。
 *   - 目标尺寸：可点击目标 < 24x24 记失败；主按钮另列一节（44px 仅作参考，不单独判失败）。
 *   - 横向溢出：CSS 视口 >= 320px 时记失败；< 320px 记为显式豁免（低于本项目设计下限）。
 */

/** 判定阈值（三个脚本共用） */
export const THRESHOLDS = {
  /** 非装饰正文的最小字号（px）。这是本项目约定，不是声称 WCAG 规定统一最小字号 */
  minFontSizePx: 12,
  /** 正文对比度下限 */
  minContrast: 4.5,
  /** 大字号对比度下限 */
  largeTextMinContrast: 3,
  /** 大字号字号阈值 */
  largeTextMinSizePx: 24,
  /** 大字号加粗阈值 */
  largeTextBoldMinSizePx: 18.66,
  /** 大字号加粗的字重阈值 */
  largeTextBoldMinWeight: 700,
  /** 可点击目标的最小尺寸（px） */
  minTargetPx: 24,
  /** 移动端主按钮的参考尺寸（px）：只单列出来供复核，不单独判失败 */
  advisoryPrimaryTargetPx: 44,
  /** 本项目设计下限（CSS px）：低于此宽度的横向溢出不判失败，但必须显式记录豁免 */
  designFloorCssPx: 320,
}

/**
 * 显式列出的装饰性豁免项。
 * 判据：这些元素只是纹样 / 重复信息，不承载独立语义；
 * 每一条都必须写清理由，报告里单列打印，不允许静默跳过。
 */
export const DECORATIVE_EXEMPTIONS = [
  {
    className: 'ql-scene__poem',
    reason: '青岚首页拱形山水上的题刻：装饰性书法纹样，重复首页主旨，不承载独立信息',
  },
  {
    className: 'zh-pair__watermark',
    reason: '朱砂结果页卦名水印：纯装饰叠层，重复呈现同一卦名',
  },
  {
    className: 'result-hexagram-watermark',
    reason: '结果页卦象水印：纯装饰底纹',
  },
  {
    className: 'ql-scene__index',
    reason: '青岚首页山水图注：装饰性图注（带 aria-hidden）',
  },
]

/** 主按钮目标选择器：这些目标单列一节，移动端按 44px 参考值提示 */
export const PRIMARY_TARGET_SELECTORS = [
  '.ui-button--primary',
  '.zh-submit',
  '.zh-primary',
  '.divination-submit',
  '.yh-form__submit',
  '.yh-btn',
  '.home-primary-link',
  '.daily-open',
  'button[type="submit"]',
]

/** 像素级复核脚本名：位图上的文字豁免时移交到这里 */
export const PIXEL_PROBE_SCRIPT = 'contrast-appearances.mjs'

/**
 * 像素级对比度脚本的目标清单。
 *
 * 放在共享模块里，是为了让页面矩阵脚本能校验「移交」是真的：
 * 位图上的文字被显式豁免并移交到这里时，这里必须真的有对应目标；
 * 没有对应目标就不是「移交」而是「两边都没测」，必须判失败。
 *
 * 条目格式：[标签, 选择器] 或 [标签, 选择器, 豁免理由]
 */
export const CONTRAST_TARGETS = {
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

/** 把 cssPath 拆成 {tag, classes} 片段 */
function pathSegments(path) {
  return String(path ?? '')
    .split(' > ')
    .map((seg) => {
      const parts = seg.split('.')
      const tag = parts[0].split(':')[0].toLowerCase()
      const classes = parts.slice(1).map((c) => c.split(':')[0])
      return { tag, classes }
    })
}

/** 一个选择器分支是否覆盖了这个元素 */
function alternativeCovers(alternative, finding) {
  const segs = pathSegments(finding.selector)
  const parts = alternative.trim().split(/\s+/)
  return parts.every((part) => {
    if (part.startsWith('.')) {
      const name = part.slice(1).replace(/\\/g, '')
      return segs.some((s) => s.classes.includes(name))
    }
    if (part.startsWith('#')) return false
    return segs.some((s) => s.tag === part.toLowerCase())
  })
}

/**
 * 位图上的文字是否真的被像素级脚本覆盖到。
 * 覆盖不到 → 不是「移交」而是「两边都没测」→ 必须判失败。
 */
export function pixelCoversFinding(finding, page, appearance) {
  const pageTargets = CONTRAST_TARGETS[page]
  if (!pageTargets) return { covered: false, target: null }
  const list = [...(pageTargets.common ?? []), ...(pageTargets[appearance] ?? [])]
  for (const [label, selector] of list) {
    const alternatives = String(selector).split(',').map((s) => s.trim())
    if (alternatives.some((alt) => alternativeCovers(alt, finding))) {
      return { covered: true, target: `${label}（${selector}）` }
    }
  }
  return { covered: false, target: null }
}

/** 参与「目标尺寸」检查的交互元素 */
export const TARGET_SELECTOR =
  'a, button, [role="button"], input, select, textarea, summary, [role="tab"], [role="menuitem"], [role="switch"], label[for]'

/**
 * 浏览器侧探针。
 *
 * 注意：这个函数会被 `fn.toString()` 之后注入页面执行，因此
 *   1) 不能引用模块作用域里的任何东西（阈值等一律从参数 T 传入）；
 *   2) 返回值必须是可结构化克隆的纯数据。
 *
 * 只返回「低于阈值」的发现项 + 计数，避免把整页 DOM 塞进 JSON。
 *
 * @param {object} T 阈值与豁免清单（见 buildProbeConfig）
 */
export function pageProbe(T) {
  const parseColor = (value) => {
    if (!value) return null
    const m = String(value).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const parts = m[1].split(',').map((s) => parseFloat(s))
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return null
    return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 }
  }
  const luminance = (c) => {
    const f = (v) => {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }
  const contrastRatio = (a, b) => {
    const l1 = luminance(a)
    const l2 = luminance(b)
    const hi = Math.max(l1, l2)
    const lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }
  const classListOf = (el) =>
    (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)

  /** 元素在 DOM 里的可定位路径 */
  const cssPath = (el) => {
    const parts = []
    let node = el
    let depth = 0
    while (node && node.nodeType === 1 && node !== document.body && depth < 6) {
      let seg = node.tagName.toLowerCase()
      const cls = classListOf(node).slice(0, 3)
      if (cls.length) seg += '.' + cls.join('.')
      const parent = node.parentElement
      if (parent) {
        const same = Array.prototype.filter.call(
          parent.children,
          (c) => c.tagName === node.tagName
        )
        if (same.length > 1) {
          seg += ':nth-of-type(' + (same.indexOf(node) + 1) + ')'
        }
      }
      parts.unshift(seg)
      node = node.parentElement
      depth += 1
    }
    return parts.join(' > ')
  }

  /** 自身或祖先是否 aria-hidden="true" */
  const ariaHiddenOf = (el) => {
    let node = el
    while (node && node !== document.body) {
      if (node.getAttribute && node.getAttribute('aria-hidden') === 'true') return true
      node = node.parentElement
    }
    return false
  }

  const decorativeOf = (el) => {
    const cls = classListOf(el)
    for (const ex of T.decorativeExemptions) {
      if (cls.indexOf(ex.className) >= 0) return ex
    }
    return null
  }

  /**
   * 背景候选：元素自身/祖先的不透明背景色 + 渐变色阶（半透明色阶先与底色合成）。
   * hasImage=true 表示这一层是位图，CSS 采样不可靠。
   */
  const blend = (fg, bg, alpha) => ({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
    a: 1,
  })

  const collectBackgrounds = (el) => {
    const gradients = []
    let hasImage = false
    let base = null
    let node = el
    let depth = 0
    while (node && node !== document.documentElement && depth < 12) {
      const cs = getComputedStyle(node)
      const bi = cs.backgroundImage
      if (bi && bi !== 'none') {
        if (bi.indexOf('url(') >= 0) {
          hasImage = true
        } else {
          const stops = bi.match(/rgba?\([^)]*\)/g) || []
          stops.forEach((s) => {
            const c = parseColor(s)
            if (c && c.a > 0.05) {
              gradients.push({
                source: 'gradient:' + (node === el ? 'self' : 'ancestor'),
                color: c,
              })
            }
          })
        }
      }
      const bc = parseColor(cs.backgroundColor)
      if (bc && bc.a > 0.95) {
        base = { source: node === el ? 'self' : 'ancestor', color: bc }
        break
      }
      node = node.parentElement
      depth += 1
    }
    if (!base) {
      const bodyBg =
        parseColor(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 }
      base = { source: 'body', color: bodyBg }
    }
    const candidates = [base]
    for (const g of gradients) {
      candidates.push({
        source: g.source,
        color: g.color.a >= 0.95 ? g.color : blend(g.color, base.color, g.color.a),
      })
    }
    return { candidates, hasImage }
  }

  // 位图遮挡检测：文字中心落在某张位图内 → 真实底色必须靠像素级测量
  const rasterRects = Array.prototype.slice
    .call(document.querySelectorAll('img, canvas, video, picture'))
    .map((n) => n.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)

  const overRaster = (rect) => {
    const cx = rect.x + rect.width / 2
    const cy = rect.y + rect.height / 2
    return rasterRects.some(
      (r) => cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height
    )
  }

  const smallType = []
  const contrast = []
  const smallTargets = []
  const primaryTargets = []
  const decorativeHits = []
  const ariaHiddenSample = []
  let textCount = 0
  let ariaHiddenCount = 0
  let targetCount = 0

  const elements = Array.prototype.slice.call(document.querySelectorAll('body *'))
  for (const el of elements) {
    const cs = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    const visible =
      cs.display !== 'none' && cs.visibility !== 'hidden' && rect.width > 0 && rect.height > 0

    const ownText = Array.prototype.slice
      .call(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => (n.textContent || '').trim())
      .join(' ')
      .trim()

    if (ownText) {
      textCount += 1
      const ariaHidden = ariaHiddenOf(el)
      const decorative = decorativeOf(el)
      if (ariaHidden) {
        ariaHiddenCount += 1
        if (ariaHiddenSample.length < 5) {
          ariaHiddenSample.push({ selector: cssPath(el), text: ownText.slice(0, 24) })
        }
      } else if (decorative) {
        decorativeHits.push({
          selector: cssPath(el),
          text: ownText.slice(0, 24),
          className: decorative.className,
          exempt: true,
          exemptReason: decorative.reason,
        })
      } else if (visible) {
        const size = parseFloat(cs.fontSize)
        const weight = parseInt(cs.fontWeight, 10) || 400
        if (size < T.minFontSizePx) {
          smallType.push({
            selector: cssPath(el),
            classes: classListOf(el),
            text: ownText.slice(0, 24),
            fontSize: size,
            fontWeight: weight,
            color: cs.color,
          })
        }
        const fg = parseColor(cs.color)
        if (fg && fg.a >= 0.3) {
          const { candidates, hasImage } = collectBackgrounds(el)
          const onImage = hasImage || overRaster(rect)
          const large =
            size >= T.largeTextMinSizePx ||
            (size >= T.largeTextBoldMinSizePx && weight >= T.largeTextBoldMinWeight)
          const need = large ? T.largeTextMinContrast : T.minContrast
          let worst = null
          for (const b of candidates) {
            // 半透明文字先与底色合成，量到的才是眼睛真正看到的对比度
            const eff = fg.a >= 0.999 ? fg : blend(fg, b.color, fg.a)
            const r = contrastRatio(eff, b.color)
            if (!worst || r < worst.ratio) {
              worst = { ratio: r, bg: b.color, source: b.source, fg: eff }
            }
          }
          if (worst && worst.ratio < need) {
            contrast.push({
              selector: cssPath(el),
              classes: classListOf(el),
              text: ownText.slice(0, 24),
              fontSize: size,
              fontWeight: weight,
              need,
              ratio: Math.round(worst.ratio * 100) / 100,
              fg: { r: fg.r, g: fg.g, b: fg.b, a: fg.a },
              fgComposited: { r: worst.fg.r, g: worst.fg.g, b: worst.fg.b, a: 1 },
              bg: worst.bg,
              bgSource: worst.source,
              onImage,
            })
          }
        }
      }
    }

    let isTarget = false
    try {
      isTarget = el.matches(T.targetSelector)
    } catch (e) {
      isTarget = false
    }
    if (isTarget) {
      targetCount += 1
      let isPrimary = false
      for (const s of T.primaryTargetSelectors) {
        try {
          if (el.matches(s)) {
            isPrimary = true
            break
          }
        } catch (e) {
          /* 选择器不合法时忽略 */
        }
      }
      if (visible && !ariaHiddenOf(el)) {
        const w = Math.round(rect.width)
        const h = Math.round(rect.height)
        const label = (el.textContent || el.getAttribute('aria-label') || el.value || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 24)
        if (isPrimary) {
          primaryTargets.push({ selector: cssPath(el), text: label, width: w, height: h })
        }
        if (w < T.minTargetPx || h < T.minTargetPx) {
          smallTargets.push({
            selector: cssPath(el),
            text: label,
            width: w,
            height: h,
            primary: isPrimary,
          })
        }
      }
    }
  }

  const de = document.documentElement
  return {
    doc: {
      scrollWidth: de.scrollWidth,
      clientWidth: de.clientWidth,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport ? window.visualViewport.scale : null,
      title: document.title,
    },
    counts: {
      textElements: textCount,
      ariaHiddenTextElements: ariaHiddenCount,
      targetElements: targetCount,
      domElements: elements.length,
    },
    ariaHiddenSample,
    decorativeHits,
    smallType,
    contrast,
    smallTargets,
    primaryTargets,
  }
}

/** 组装注入页面的探针参数（阈值 + 豁免 + 选择器） */
export function buildProbeConfig() {
  return {
    ...THRESHOLDS,
    decorativeExemptions: DECORATIVE_EXEMPTIONS,
    primaryTargetSelectors: PRIMARY_TARGET_SELECTORS,
    targetSelector: TARGET_SELECTOR,
  }
}

/**
 * 把探针结果判成 pass / fail / exempt / not-covered，并生成失败与豁免条目。
 *
 * @param {object} probe pageProbe 的返回值
 * @param {object} ctx { appearance, appearanceName, page, width, cssWidth, section }
 * @returns {{ checks: object, failures: object[], exemptions: object[] }}
 */
export function evaluateProbe(probe, ctx) {
  const failures = []
  const exemptions = []
  const base = {
    appearance: ctx.appearance,
    appearanceName: ctx.appearanceName ?? ctx.appearance,
    page: ctx.page,
    width: ctx.width,
    section: ctx.section ?? 'matrix',
  }

  /* ------------------------------ 横向溢出 ------------------------------ */
  const cssWidth = ctx.cssWidth ?? probe.doc.clientWidth
  const overflowX = probe.doc.scrollWidth > probe.doc.clientWidth
  const overflow = {
    status: 'pass',
    scrollWidth: probe.doc.scrollWidth,
    clientWidth: probe.doc.clientWidth,
    cssWidth,
    threshold: `scrollWidth <= clientWidth（CSS 视口 >= ${THRESHOLDS.designFloorCssPx}px 时判失败）`,
    value: probe.doc.scrollWidth,
  }
  if (overflowX) {
    if (cssWidth < THRESHOLDS.designFloorCssPx) {
      overflow.status = 'exempt'
      overflow.exempt = true
      overflow.exemptReason = `CSS 视口 ${cssWidth}px 低于本项目设计下限 ${THRESHOLDS.designFloorCssPx}px，本档不判失败，仅记录`
      exemptions.push({
        ...base,
        kind: 'overflow',
        selector: 'document.documentElement',
        value: probe.doc.scrollWidth,
        threshold: `${THRESHOLDS.designFloorCssPx}px 设计下限`,
        text: '',
        exempt: true,
        exemptReason: overflow.exemptReason,
      })
    } else {
      overflow.status = 'fail'
      failures.push({
        ...base,
        kind: 'overflow',
        selector: 'document.documentElement',
        value: probe.doc.scrollWidth,
        threshold: probe.doc.clientWidth,
        unit: 'px',
        text: '',
        detail: `横向溢出 ${probe.doc.scrollWidth}px > 视口 ${probe.doc.clientWidth}px`,
      })
    }
  }

  /* ------------------------------ 字号 < 12px ------------------------------ */
  const smallType = {
    status: probe.smallType.length ? 'fail' : 'pass',
    count: probe.smallType.length,
    threshold: `>= ${THRESHOLDS.minFontSizePx}px`,
    findings: probe.smallType.map((f) => ({
      ...f,
      value: f.fontSize,
      threshold: THRESHOLDS.minFontSizePx,
      unit: 'px',
    })),
  }
  for (const f of smallType.findings) {
    failures.push({
      ...base,
      kind: 'smallType',
      selector: f.selector,
      value: f.value,
      threshold: f.threshold,
      unit: f.unit,
      text: f.text,
      detail: `非装饰文字计算字号 ${f.value}px < ${f.threshold}px`,
    })
  }

  /* ------------------------------ 对比度 ------------------------------ */
  const DEFER_REASON = `文字落在位图上，CSS 采样不可靠；移交 ${PIXEL_PROBE_SCRIPT} 像素级复核（coreMedianRatio / weakestRatio）`
  const contrastFindings = probe.contrast.map((f) => ({ ...f }))
  const contrastFail = contrastFindings.filter((f) => !f.onImage)
  const contrastExempt = contrastFindings.filter((f) => f.onImage)
  const contrast = {
    status: contrastFail.length ? 'fail' : contrastExempt.length ? 'exempt' : 'pass',
    count: contrastFindings.length,
    threshold: `< ${THRESHOLDS.minContrast}:1（大字号 ${THRESHOLDS.largeTextMinContrast}:1）`,
    findings: contrastFindings,
  }
  for (const f of contrastFail) {
    failures.push({
      ...base,
      kind: 'contrast',
      selector: f.selector,
      value: f.ratio,
      threshold: f.need,
      unit: ':1',
      text: f.text,
      detail: `实测对比度 ${f.ratio}:1 < ${f.need}:1（底色取自 ${f.bgSource}）`,
    })
  }
  for (const f of contrastExempt) {
    // 移交必须是真的：像素级脚本里没有对应目标 = 两边都没测 → 判失败
    const cover = pixelCoversFinding(f, ctx.page, ctx.appearance)
    if (!cover.covered) {
      failures.push({
        ...base,
        kind: 'handoff-not-covered',
        selector: f.selector,
        value: f.ratio,
        threshold: f.need,
        unit: ':1',
        text: f.text,
        detail:
          `文字落在位图上被豁免，但 ${PIXEL_PROBE_SCRIPT} 在 ${ctx.page}/${ctx.appearance} 没有对应目标：` +
          `两边都没测，不能豁免`,
      })
      const row = contrast.findings.find((x) => x.selector === f.selector)
      if (row) {
        row.exempt = false
        row.handoffMissing = true
      }
      continue
    }
    const row = contrast.findings.find((x) => x.selector === f.selector)
    if (row) {
      row.exempt = true
      row.exemptReason = DEFER_REASON
      row.handoff = PIXEL_PROBE_SCRIPT
      row.handoffTarget = cover.target
    }
    exemptions.push({
      ...base,
      kind: 'contrast',
      selector: f.selector,
      value: f.ratio,
      threshold: f.need,
      unit: ':1',
      text: f.text,
      exempt: true,
      exemptReason: DEFER_REASON,
      handoff: PIXEL_PROBE_SCRIPT,
      handoffTarget: cover.target,
    })
  }

  /* ------------------------------ 目标尺寸 ------------------------------ */
  const smallTargets = {
    status: probe.smallTargets.length ? 'fail' : 'pass',
    count: probe.smallTargets.length,
    threshold: `>= ${THRESHOLDS.minTargetPx}x${THRESHOLDS.minTargetPx}px`,
    findings: probe.smallTargets.map((f) => ({
      ...f,
      value: `${f.width}x${f.height}`,
      threshold: THRESHOLDS.minTargetPx,
      unit: 'px',
    })),
  }
  for (const f of smallTargets.findings) {
    failures.push({
      ...base,
      kind: 'smallTarget',
      selector: f.selector,
      value: f.value,
      threshold: f.threshold,
      unit: f.unit,
      text: f.text,
      detail: `可点击目标 ${f.width}x${f.height}px 低于 ${THRESHOLDS.minTargetPx}x${THRESHOLDS.minTargetPx}px`,
    })
  }

  /* ------------------------------ 主按钮目标（单列） ------------------------------ */
  const isMobile = ctx.width <= 768
  const smallPrimary = probe.primaryTargets.filter(
    (t) => t.width < THRESHOLDS.advisoryPrimaryTargetPx || t.height < THRESHOLDS.advisoryPrimaryTargetPx
  )
  const primaryTargets = {
    status: isMobile && smallPrimary.length ? 'exempt' : 'pass',
    count: probe.primaryTargets.length,
    reference: `${THRESHOLDS.advisoryPrimaryTargetPx}px（移动端参考值，不单独判失败）`,
    findings: probe.primaryTargets.map((t) => ({
      ...t,
      value: `${t.width}x${t.height}`,
      meetsReference: t.width >= THRESHOLDS.advisoryPrimaryTargetPx && t.height >= THRESHOLDS.advisoryPrimaryTargetPx,
    })),
  }
  if (primaryTargets.status === 'exempt') {
    primaryTargets.exempt = true
    primaryTargets.exemptReason = `移动端主按钮目标小于 ${THRESHOLDS.advisoryPrimaryTargetPx}px 参考值：本项只单列出来供复核，不判失败`
    for (const t of smallPrimary) {
      exemptions.push({
        ...base,
        kind: 'primaryTarget',
        selector: t.selector,
        value: `${t.width}x${t.height}`,
        threshold: THRESHOLDS.advisoryPrimaryTargetPx,
        unit: 'px',
        text: t.text,
        exempt: true,
        exemptReason: primaryTargets.exemptReason,
      })
    }
  }

  /* ------------------------------ 装饰性豁免命中 ------------------------------ */
  for (const d of probe.decorativeHits) {
    exemptions.push({
      ...base,
      kind: 'decorative',
      selector: d.selector,
      value: null,
      threshold: null,
      text: d.text,
      exempt: true,
      exemptReason: d.exemptReason,
    })
  }

  const checks = {
    overflow,
    smallType,
    contrast,
    smallTargets,
    primaryTargets,
  }

  const statuses = Object.values(checks).map((c) => c.status)
  const status = statuses.includes('fail')
    ? 'fail'
    : statuses.includes('not-covered')
      ? 'not-covered'
      : statuses.includes('exempt')
        ? 'exempt'
        : 'pass'

  return { checks, failures, exemptions, status }
}
