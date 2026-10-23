import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  NotebookPen,
} from 'lucide-react'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import { YehangAtlas } from '@/components/appearances/yehang/YehangAtlas'
import type { HomeAppearanceProps } from '@/components/appearances/shared/types'
import { getHexagramById } from '@/lib/divination'
import { hexagramLineTypes } from '@/lib/hexagramLines'
import type { Hexagram, HexagramId } from '@/types'
import '@/styles/appearance/yehang.css'

/** 主题里的卦序可能来自外部，做一次安全查表，查不到就跳过这一张卡。 */
function safeHexagram(id: number): Hexagram | null {
  if (!Number.isInteger(id) || id < 1 || id > 64) return null
  return getHexagramById(id as HexagramId)
}

/**
 * 夜航观象 · 首页。
 *
 * 只展示 props 传来的真实内容：今日卦（主卦 / 变卦 / 动爻 / 日期 / 时区）
 * 与真实阅读主题（readingThemes + activeThemeIndex + onThemeChange）。
 * 不取数、不发请求、不写存储。
 */
export function HomeYehang({
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
  const activeTheme = readingThemes[activeThemeIndex] ?? readingThemes[0]
  const moving =
    movingLine >= 1 && movingLine <= 6
      ? (movingLine as 1 | 2 | 3 | 4 | 5 | 6)
      : undefined

  return (
    <div className="yh-page yh-home">
      <section className="yh-hero" aria-labelledby="yh-home-title">
        <div className="yh-hero__copy">
          <p className="yh-kicker">
            <span />
            一场向内的探索，现在开始
          </p>
          <h1 className="yh-hero__title" id="yh-home-title">
            天地之间，
            <br />
            总有你的<span>坐标。</span>
          </h1>
          <p className="yh-hero__lead">
            让三个数字，连接此刻的心绪。在六十四种可能中，寻找前行的微光。
          </p>
          <div className="yh-hero__actions">
            <Link to="/divination" className="yh-btn">
              开启一次观象
              <ArrowUpRight size={17} aria-hidden="true" />
            </Link>
            <a href="#yh-today" className="yh-btn yh-btn--text">
              遇见今日卦境
              <ArrowDown size={15} aria-hidden="true" />
            </a>
          </div>
          <p className="yh-hero__stamp">
            <span>{dateLabel}</span>
            {timeZone ? (
              <>
                <i aria-hidden="true" />
                <span>{timeZone}</span>
              </>
            ) : null}
          </p>
          <div className="yh-hero__meta">
            <span>一事一问</span>
            <span>一日一观</span>
            <span>一念一新</span>
          </div>
        </div>
        <YehangAtlas variant="hero" caption="THE CELESTIAL ATLAS" />
      </section>

      <div className="yh-lower">
        <section
          className="yh-today"
          id="yh-today"
          aria-labelledby="yh-today-title"
        >
          <div className="yh-today__top">
            <span className="yh-overline">DAILY READING</span>
            <span>{dateLabel}</span>
          </div>
          <div className="yh-today__heading">
            <h2 id="yh-today-title">今日卦境</h2>
            <p>今日的答案，藏在变化里。</p>
          </div>
          <div className="yh-today__body">
            <div className="yh-today__reading">
              <span className="yh-overline">
                第 {String(main.number).padStart(2, '0')} 卦 /{' '}
                {main.keywords.slice(0, 2).join(' · ')}
              </span>
              <h3>{main.name}</h3>
              <p>{main.modernInterpretation}</p>
              <div className="yh-today__readouts">
                <span className="yh-readout">
                  动爻 <b>第 {movingLine} 爻</b>
                </span>
                <span className="yh-readout">
                  变卦 <b>{changed.name}</b>
                </span>
              </div>
              <p className="yh-today__more">
                <Link to={`/hexagram/${main.id}`} className="yh-link">
                  展开今日卦境
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </p>
            </div>
            <div className="yh-today__art">
              <YaoLineStack
                className="yh-glyph"
                lines={hexagramLineTypes(main)}
                highlightLine={moving}
                width={52}
                thickness={4}
                lineGap={6}
                label={`${main.name}，第 ${movingLine} 爻动`}
              />
            </div>
          </div>
        </section>

        <aside className="yh-explore" aria-label="探索易象阁">
          <span className="yh-overline">THE PRACTICE</span>
          <h2>
            从一卦，
            <br />
            走向更辽阔的自己。
          </h2>
          <Link to="/codex" className="yh-explore__link">
            <span>
              <BookOpen size={18} aria-hidden="true" />
              六十四卦图鉴
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <Link to="/records" className="yh-explore__link">
            <span>
              <NotebookPen size={18} aria-hidden="true" />
              把领悟，写进卦册
            </span>
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <section
        className="yh-reading"
        aria-labelledby="yh-reading-title"
      >
        <div className="yh-reading__heading">
          <div>
            <span className="yh-overline">一卦一境</span>
            <h2 id="yh-reading-title">翻开易经的一页</h2>
          </div>
          <Link to="/codex" className="yh-link">
            浏览全部卦象
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div
          className="yh-reading__toolbar"
          role="group"
          aria-label="卦象阅读主题"
        >
          {readingThemes.map((theme, index) => (
            <button
              type="button"
              key={`${theme.label}-${index}`}
              aria-pressed={index === activeThemeIndex}
              aria-controls={themeId}
              onClick={() => onThemeChange(index)}
            >
              {theme.label}
            </button>
          ))}
          <span>六十四卦，读懂人生的不同章节。</span>
          {/* 切换主题后的结果播报 */}
          {activeTheme ? (
            <span className="sr-only" role="status" aria-live="polite">
              {`已切换到「${activeTheme.label}」，显示 ${activeTheme.ids.length} 个卦象`}
            </span>
          ) : null}
        </div>
        <ul className="yh-reading__grid" id={themeId}>
          {(activeTheme?.ids ?? [])
            .map((id) => ({ id, hexagram: safeHexagram(id) }))
            .filter(
              (item): item is { id: number; hexagram: Hexagram } =>
                item.hexagram !== null,
            )
            .map(({ id, hexagram }) => (
              <li key={id}>
                <Link to={`/hexagram/${hexagram.id}`} className="yh-reading__card">
                  <span className="yh-reading__card-top">
                    第 {String(hexagram.number).padStart(2, '0')} 卦
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </span>
                  <div className="yh-reading__card-symbol">
                    <YaoLineStack
                      className="yh-glyph"
                      lines={hexagramLineTypes(hexagram)}
                      width={34}
                      thickness={3}
                      lineGap={4}
                    />
                    <span aria-hidden="true">{hexagram.shortName}</span>
                  </div>
                  <h3>{hexagram.name}</h3>
                  <p>{hexagram.keywords.slice(0, 3).join(' · ')}</p>
                </Link>
              </li>
            ))}
        </ul>
      </section>

      <div className="yh-note">
        <span>“穷则变，变则通，通则久。”</span>
        <p>不求预知一切，只为更好地回应当下。</p>
      </div>
    </div>
  )
}
