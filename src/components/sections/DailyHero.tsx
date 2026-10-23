import { ArrowRight, CalendarDays, MoveUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import { getTodayHexagram } from '@/lib/daily'
import { getHexagramById } from '@/lib/divination'
import { hexagramLineTypes } from '@/lib/hexagramLines'
import { cn } from '@/utils/cn'
import type { Hexagram } from '@/types'

export interface DailyHeroProps {
  /** Override the auto-generated daily hexagram (for testing) */
  mainHexagram?: Hexagram
  changedHexagram?: Hexagram
  movingLine?: 1 | 2 | 3 | 4 | 5 | 6
  region?: string
  date?: string
  className?: string
}

export function DailyHero({
  mainHexagram: providedMain,
  changedHexagram: providedChanged,
  movingLine: providedMoving,
  region,
  date,
  className,
}: DailyHeroProps) {
  const daily = providedMain && providedChanged ? null : getTodayHexagram()
  const main =
    providedMain ?? (daily ? getHexagramById(daily.mainHexagramId) : null)
  const changed =
    providedChanged ?? (daily ? getHexagramById(daily.changedHexagramId) : null)
  const moving = providedMoving ?? daily?.movingLine

  if (!main || !changed) return null

  const today =
    date ??
    new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'long',
    })

  // 每日卦象按「日期」计算，而日期取决于本地时区：跨过日界时不同地区会落到不同日期，
  // 因而可能看到不同卦象——时区不同并不必然意味着卦象不同。
  const timeZone =
    region ??
    (typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : '')

  return (
    <section
      className={cn('daily-section', className)}
      aria-labelledby="daily-title"
    >
      <div className="daily-section-heading">
        <h2 id="daily-title">
          <span className="section-mark" />今 日 卦 境
        </h2>
        <span className="daily-date">
          <CalendarDays size={13} aria-hidden="true" />
          {today}
          {region && ` · ${region}`}
        </span>
        <Link to="/codex" className="home-text-link">
          查看 64 卦<MoveUpRight size={14} aria-hidden="true" />
        </Link>
      </div>
      {timeZone && (
        <p className="daily-timezone">
          时区 {timeZone} · 每日卦象按本地日期计算，跨过日界时各地区可能看到不同卦象
        </p>
      )}

      <div className="daily-card">
        <div className="daily-symbol">
          <span className="daily-symbol-caption">观 象 · 知 时</span>
          <div className="daily-symbol-ring">
            <YaoLineStack
              lines={hexagramLineTypes(main)}
              // 主卦图旁边没有等价文字，给出中文名称
              label={`${main.name}卦象图`}
              highlightLine={moving}
              width={76}
              thickness={6}
              lineGap={9}
            />
          </div>
          <span className="daily-symbol-number">
            HEXAGRAM {String(main.number).padStart(2, '0')}
          </span>
        </div>

        <div className="daily-reading">
          <div className="daily-name-row">
            <h3>{main.name}</h3>
            <span className="daily-number">第 {main.number} 卦</span>
          </div>
          <div className="daily-keywords">
            {main.keywords.slice(0, 4).map((keyword) => (
              <span key={keyword}>{keyword}</span>
            ))}
          </div>
          {main.modernInterpretation && (
            <p className="daily-interpretation">{main.modernInterpretation}</p>
          )}
          <div className="daily-change">
            <span>{`动爻 · 第 ${moving} 爻`}</span>
            <ArrowRight size={13} aria-hidden="true" />
            <Link
              to={`/hexagram/${changed.id}`}
            >{`变卦 · ${changed.name}`}</Link>
          </div>
        </div>

        <div className="daily-invitation">
          <span className="home-eyebrow">一日一卦，一期一会</span>
          <p>
            借一卦之象，
            <br />
            照见当下的自己。
          </p>
          <Link to={`/hexagram/${main.id}`} className="daily-open">
            展开卦境
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/divination" className="daily-divination">
            三数起卦
            <MoveUpRight size={12} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
