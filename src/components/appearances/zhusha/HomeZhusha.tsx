import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Feather, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import { hexagramLineTypes } from '@/lib/hexagramLines'
import type { HomeAppearanceProps } from '@/components/appearances/shared/types'
import { asLinePosition, safeHexagram, ZhushaOverline, ZhushaPlate } from './parts'
import '@/styles/appearance/zhusha.css'

/**
 * 朱砂档案 · 首页。
 *
 * 版式对应设计稿 `.dg-theme-b` 的首页：
 * 左侧是「东方智慧的当代读本」文案，右侧是一块朱砂顶边的印版（印章圆环 +
 * 竖排边栏 + 版次），底部压一条书册索引条；下半部是「今日卦境」正文栏与
 * 「探索」边栏，中间用一条墨线分栏；再往下是「一卦一境」的阅读主题。
 *
 * 内容全部来自 props：真实今日卦、真实日期与时区、真实阅读主题。
 * 本组件不取数、不发请求、不写存储。
 */
export function HomeZhusha({
  main,
  changed,
  movingLine,
  dateLabel,
  timeZone,
  readingThemes,
  activeThemeIndex,
  onThemeChange,
}: HomeAppearanceProps) {
  const safeIndex =
    activeThemeIndex >= 0 && activeThemeIndex < readingThemes.length
      ? activeThemeIndex
      : 0
  const activeTheme = readingThemes[safeIndex]
  const moving = asLinePosition(movingLine)

  return (
    <div className="zh-page zh-home">
      <section className="zh-hero zh-container" aria-labelledby="zh-home-title">
        <div className="zh-hero__copy">
          <p className="zh-hero__kicker">
            <span className="zh-rule" />
            东方智慧的当代读本 · 第一卷
          </p>
          <h1 className="zh-hero__title" id="zh-home-title">
            万物皆有时。
            <br />
            <em>你，也有答案。</em>
          </h1>
          <p className="zh-hero__lede">
            把纷繁的生活，翻成清晰的一页。从六十四种变化中，读出属于当下的启示。
          </p>
          <div className="zh-hero__actions">
            <Link className="zh-primary" to="/divination">
              翻开我的这一页
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a className="zh-text-action" href="#zh-today">
              遇见今日卦境
              <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="zh-hero__meta">
            <span>一事一问</span>
            <span>一日一观</span>
            <span>一念一新</span>
          </p>
        </div>

        <ZhushaPlate />

        <div className="zh-index-strip">
          <span>THE BOOK OF CHANGE</span>
          <span>一部写了三千年，仍未写完的书。</span>
          <span>01 — 64</span>
        </div>
      </section>

      <div className="zh-home-lower zh-container">
        <section
          className="zh-today"
          id="zh-today"
          aria-labelledby="zh-today-title"
        >
          <div className="zh-section-top">
            <ZhushaOverline icon={<Sun size={15} aria-hidden="true" />}>
              DAILY READING
            </ZhushaOverline>
            <span>
              {dateLabel}
              {timeZone ? ` · ${timeZone}` : ''}
            </span>
          </div>

          <div className="zh-today__layout">
            <div className="zh-today__heading">
              <h2 id="zh-today-title">今日卦境</h2>
              <p>今日的答案，藏在变化里。</p>
            </div>

            <div className="zh-today__art">
              <YaoLineStack
                lines={hexagramLineTypes(main)}
                highlightLine={moving}
                width={70}
                thickness={6}
                lineGap={8}
                label={`${main.name}卦象图`}
              />
              <span>观象，而后知时。</span>
            </div>

            <div className="zh-today__reading">
              <ZhushaOverline>
                第 {main.number} 卦 / {main.keywords.slice(0, 2).join(' · ')}
              </ZhushaOverline>
              <h3>{main.name}</h3>
              {main.modernInterpretation && <p>{main.modernInterpretation}</p>}
              <div className="zh-today__change">
                <span>动爻 · 第 {movingLine} 爻</span>
                <ArrowRight size={13} aria-hidden="true" />
                <Link to={`/hexagram/${changed.id}`}>变卦 · {changed.name}</Link>
              </div>
              <Link className="zh-text-action" to={`/hexagram/${main.id}`}>
                展开今日卦境
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <aside className="zh-explore" aria-label="探索易象阁">
          <ZhushaOverline>THE PRACTICE / 日常之易</ZhushaOverline>
          <h2>
            从一卦，
            <br />
            走向更辽阔的自己。
          </h2>
          <Link to="/codex">
            <span>
              <BookOpen size={18} aria-hidden="true" />
              六十四卦图鉴
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/records">
            <span>
              <Feather size={18} aria-hidden="true" />
              把领悟，写进卦册
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <section className="zh-reading zh-container" aria-labelledby="zh-reading-title">
        <div className="zh-reading__head">
          <div>
            <ZhushaOverline>一卦一境</ZhushaOverline>
            <h2 id="zh-reading-title">翻开易经的一页</h2>
          </div>
          <Link className="zh-text-action" to="/codex">
            浏览全部卦象
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>

        <div className="zh-themes" role="group" aria-label="卦象阅读主题">
          {readingThemes.map((theme, index) => (
            <button
              type="button"
              key={theme.label}
              aria-pressed={safeIndex === index}
              onClick={() => onThemeChange(index)}
            >
              {theme.label}
            </button>
          ))}
          <span className="zh-themes__note">
            六十四卦，读懂人生的不同章节。
          </span>
          {/* 切换主题后播报当前所选，读屏用户能知道正在看哪一组 */}
          <span className="sr-only" role="status" aria-live="polite">
            {`已切换到「${activeTheme?.label ?? ''}」，显示 ${
              activeTheme?.ids.length ?? 0
            } 个卦象`}
          </span>
        </div>

        <div className="zh-reading__grid">
          {(activeTheme?.ids ?? []).map((id) => {
            const hexagram = safeHexagram(id)
            if (!hexagram) return null
            return (
              <Link className="zh-card" to={`/hexagram/${hexagram.id}`} key={hexagram.id}>
                <div className="zh-card__top">
                  <span>第 {String(hexagram.number).padStart(2, '0')} 卦</span>
                  <ArrowUpRight size={15} aria-hidden="true" />
                </div>
                <div className="zh-card__symbol">
                  <YaoLineStack
                    lines={hexagramLineTypes(hexagram)}
                    width={42}
                    thickness={4}
                    lineGap={5}
                  />
                  <span aria-hidden="true">{hexagram.shortName}</span>
                </div>
                <h3>{hexagram.name}</h3>
                <p>{hexagram.keywords.slice(0, 3).join(' · ')}</p>
              </Link>
            )
          })}
        </div>
      </section>

      <div className="zh-home-note zh-container">
        <span>「穷则变，变则通，通则久。」</span>
        <p>不求预知一切，只为更好地回应当下。</p>
      </div>
    </div>
  )
}
