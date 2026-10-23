import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Feather,
  Sun,
} from 'lucide-react'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import type { HomeAppearanceProps } from '@/components/appearances/shared/types'
import { getHexagramById } from '@/lib/divination'
import { hexagramLineTypes } from '@/lib/hexagramLines'
import type { Hexagram, HexagramId } from '@/types'
import '@/styles/appearance/qinglan-home.css'

/**
 * 青岚书院 · 首页视图。
 *
 * 版式对应设计稿 `src/pages/DesignGallery.tsx` 的 `direction === "a"` 分支，
 * 配 `src/styles/design-gallery.css` 里 `.dg-site`（A 主题）那一组规则：
 *
 *   1. Hero 左右分区：左侧「慢下来，读懂此刻的自己」，右侧拱形青绿山水插画；
 *   2. 今日卦境：一条分隔线 + 眉题 + 真实日期，下方标题栏 / 解读栏 / 卦象栏；
 *   3. 探索易象阁：浅绿面板里的两个入口，并承接「一卦一境」的阅读主题切换；
 *   4. 收尾题记：「穷则变，变则通，通则久。」
 *
 * 只接收数据与回调：今日卦境、阅读主题都由页面算好传进来，
 * 这里不取数、不请求、不写存储，切换外观时换掉整棵子树即可。
 */

/** 动爻位置收敛到 1–6（外部传入的是普通 number） */
function asLinePosition(value: number): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  return value >= 1 && value <= 6 ? (value as 1 | 2 | 3 | 4 | 5 | 6) : undefined
}

/** 按 id 取卦；非法 id 返回 null，避免整个首页崩掉 */
function findHexagram(id: number): Hexagram | null {
  if (!Number.isInteger(id) || id < 1 || id > 64) return null
  return getHexagramById(id as HexagramId)
}

/**
 * 拱形山水插画（装饰层）。
 *
 * - 直接复用设计稿 `Scene` 里 direction === "a" 的那段内联 SVG：拱形画框里
 *   层叠青绿山峦 + 暖日 + 雾，与提案逐笔一致；
 * - 渐变 id 用 useId 生成，避免同页多实例互相覆盖；
 * - 颜色全部由 CSS 类名承担（见 qinglan-home.css），SVG 内不写死色值；
 * - 整棵子树 aria-hidden：插画与题刻是装饰，不参与读屏。
 */
function QinglanScene() {
  const uid = useId().replace(/:/g, '')

  return (
    <div className="ql-scene" aria-hidden="true">
      <svg viewBox="0 0 700 560" fill="none" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient
            id={`ql-sky-${uid}`}
            x1="350"
            y1="0"
            x2="350"
            y2="560"
            gradientUnits="userSpaceOnUse"
          >
            <stop className="ql-scene__sky-top" />
            <stop offset="1" className="ql-scene__sky-bottom" />
          </linearGradient>
          <linearGradient
            id={`ql-mist-${uid}`}
            x1="350"
            y1="310"
            x2="350"
            y2="560"
            gradientUnits="userSpaceOnUse"
          >
            <stop className="ql-scene__mist-top" />
            <stop offset="1" className="ql-scene__mist-bottom" />
          </linearGradient>
        </defs>
        <path
          className="ql-scene__sky"
          d="M0 0h700v560H0z"
          fill={`url(#ql-sky-${uid})`}
        />
        <circle className="ql-scene__sun" cx="455" cy="133" r="48" />
        <path
          className="ql-scene__ridge-far"
          d="M-30 376L112 226l65 57L316 89l126 184 70-62 220 211v153H-30Z"
        />
        <path
          className="ql-scene__ridge-mid"
          d="M-40 467L139 313l64 49 152-190 164 229 78-89 163 167v101H-40Z"
        />
        <path
          className="ql-scene__ridge-snow"
          d="M257 281l98-109-20 89 30 3 18 57 19 20-25-10-41-55-50 34Z"
        />
        <path
          className="ql-scene__ridge-near"
          d="M-34 529L61 450l88 26 138-95 149 90 93-104 164 125 70 83H-34Z"
        />
        <path
          className="ql-scene__water"
          d="M343 404c-86 15-74 53-19 63s52 27-26 42-49 31 20 51"
          strokeWidth="13"
        />
        <path
          className="ql-scene__mist"
          d="M0 310h700v250H0z"
          fill={`url(#ql-mist-${uid})`}
        />
        <g className="ql-scene__birds">
          <path
            d="M507 173q8-9 16 0 7-8 15-2M548 153q6-7 12 0 7-6 13-1"
            strokeWidth="1.5"
          />
        </g>
      </svg>
      <span className="ql-scene__poem">
        山静日长
        <br />
        万物有时
      </span>
      <span className="ql-scene__index">山水之间，照见自己。</span>
    </div>
  )
}

export function HomeQinglan({
  main,
  changed,
  movingLine,
  dateLabel,
  timeZone,
  readingThemes,
  activeThemeIndex,
  onThemeChange,
}: HomeAppearanceProps) {
  const themeId = useId()
  const safeIndex =
    activeThemeIndex >= 0 && activeThemeIndex < readingThemes.length
      ? activeThemeIndex
      : 0
  const activeTheme = readingThemes[safeIndex] ?? readingThemes[0]
  const moving = asLinePosition(movingLine)
  const keywords = main.keywords.slice(0, 2).join(' · ')

  return (
    <div className="ql-home">
      <section className="ql-hero ql-container" aria-labelledby="ql-hero-title">
        <div className="ql-hero__copy">
          <p className="ql-hero__kicker">
            <span className="ql-rule" />
            与古老的智慧，重新相遇
          </p>
          <h1 className="ql-hero__title" id="ql-hero-title">
            慢下来，
            <br />
            读懂此刻的<em>自己。</em>
          </h1>
          <p className="ql-hero__lede">
            借一卦之象，留一刻清明。让《周易》的智慧，成为日常里温柔而坚定的陪伴。
          </p>
          <div className="ql-hero__actions">
            <Link className="ql-primary" to="/divination">
              静心起一卦
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a className="ql-text-action" href="#ql-today">
              遇见今日卦境
              <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="ql-hero__meta">
            <span>一事一问</span>
            <span>一日一观</span>
            <span>一念一新</span>
          </p>
        </div>

        {/* 拱形青绿山水插画：纯装饰 */}
        <QinglanScene />
      </section>

      <div className="ql-home-lower ql-container">
        <section
          className="ql-today"
          id="ql-today"
          aria-labelledby="ql-today-title"
        >
          <div className="ql-section-top">
            <span className="ql-overline">
              <Sun size={15} aria-hidden="true" />
              DAILY READING
            </span>
            <span className="ql-section-top__date">
              {dateLabel}
              {timeZone ? ` · ${timeZone}` : ''}
            </span>
          </div>

          <div className="ql-today__layout">
            <div className="ql-today__heading">
              {/* 标题按仓库既有写法把字距留白写进文本，
                  读屏与视觉读到的是同一串字（见 tests/pages/Home.test.tsx） */}
              <h2 id="ql-today-title">今 日 卦 境</h2>
              <p>今日的答案，藏在变化里。</p>
            </div>

            <div className="ql-today__reading">
              <span className="ql-overline">
                第 {main.number} 卦
                {keywords ? ` / ${keywords}` : ''}
              </span>
              <h3>{main.name}</h3>
              {main.modernInterpretation && (
                <p className="ql-today__summary">{main.modernInterpretation}</p>
              )}
              <div className="ql-today__change">
                <span>{`动爻 · 第 ${movingLine} 爻`}</span>
                <ArrowRight size={13} aria-hidden="true" />
                <Link to={`/hexagram/${changed.id}`}>
                  {`变卦 · ${changed.name}`}
                </Link>
              </div>
              <Link className="ql-text-action" to={`/hexagram/${main.id}`}>
                展开今日卦境
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="ql-today__art">
              <YaoLineStack
                lines={hexagramLineTypes(main)}
                highlightLine={moving}
                width={70}
                thickness={6}
                lineGap={8}
                label={`${main.name}卦象图，第 ${movingLine} 爻动`}
              />
              <span>观象，而后知时。</span>
            </div>
          </div>
        </section>

        <section
          className="ql-explore"
          aria-labelledby="ql-explore-title"
        >
          <span className="ql-overline">THE PRACTICE / 日常之易</span>
          <h2 id="ql-explore-title">
            从一卦，
            <br />
            走向更辽阔的自己。
          </h2>
          <Link className="ql-explore__link" to="/codex">
            <span>
              <BookOpen size={18} aria-hidden="true" />
              六十四卦图鉴
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link className="ql-explore__link" to="/records">
            <span>
              <Feather size={18} aria-hidden="true" />
              把领悟，写进卦册
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>

          {/* 一卦一境：提案首页没有这一块，正式功能必须保留，
              因此收进「探索易象阁」面板里，做成一条克制的卦象条 */}
          <section className="ql-reading" aria-labelledby="ql-reading-title">
            <h3 id="ql-reading-title">翻开易经的一页</h3>
            <div
              className="ql-themes"
              role="group"
              aria-label="卦象阅读主题"
            >
              {readingThemes.map((theme, index) => (
                <button
                  type="button"
                  key={`${theme.label}-${index}`}
                  aria-pressed={safeIndex === index}
                  aria-controls={themeId}
                  onClick={() => onThemeChange(index)}
                >
                  {theme.label}
                </button>
              ))}
              {/* 切换主题后的结果播报 */}
              <span className="sr-only" role="status" aria-live="polite">
                {`已切换到「${activeTheme?.label ?? ''}」，显示 ${
                  activeTheme?.ids.length ?? 0
                } 个卦象`}
              </span>
            </div>

            <ul className="ql-reading__list" id={themeId}>
              {(activeTheme?.ids ?? []).map((id) => {
                const hexagram = findHexagram(id)
                if (!hexagram) return null
                return (
                  <li key={id}>
                    <Link
                      className="ql-reading__item"
                      to={`/hexagram/${hexagram.id}`}
                    >
                      <YaoLineStack
                        lines={hexagramLineTypes(hexagram)}
                        width={26}
                        thickness={3}
                        lineGap={3}
                      />
                      <span className="ql-reading__name">{hexagram.name}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <div className="ql-reading__links">
              <Link to="/codex">
                探索六十四卦
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
              <Link to="/feed">
                与同道，共读易
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
          </section>
        </section>
      </div>

      <div className="ql-home-note ql-container">
        <span>“穷则变，变则通，通则久。”</span>
        <p>不求预知一切，只为更好地回应当下。</p>
      </div>
    </div>
  )
}
