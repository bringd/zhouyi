// V2 — 3 个新位置指示器方案对比（解决"太弱"问题）
// 访问: /yao-design-compare

import { useState } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { cn } from '@/utils/cn'
import type { YaoLine } from '@/types'

const SAMPLE_QIAN: YaoLine[] = [
  { position: 1, type: 'yang', originalText: '初九：潜龙勿用。', explanation: '阳气初生于下，如龙潜藏深渊，时机未到，勿轻动。', modernMeaning: '起步阶段能力尚弱，宜静心学习、积累实力。', deepMeaning: '潜非隐——潜龙在水下但仍有生机。' },
  { position: 2, type: 'yang', originalText: '九二：见龙在田，利见大人。', explanation: '龙现于田，利于见德高之人。', modernMeaning: '才华初显，宜寻名师贵人。', deepMeaning: '"见龙"不是"飞龙"——龙还在地面。' },
  { position: 3, type: 'yang', originalText: '九三：君子终日乾乾，夕惕若厉，无咎。', explanation: '日夜勤勉警惕，方可免过。', modernMeaning: '关键转折位，宜加倍努力。', deepMeaning: '九三处下卦之顶，承上启下的"夹层"位置。' },
  { position: 4, type: 'yang', originalText: '九四：或跃在渊，无咎。', explanation: '可上可下、审时而动。', modernMeaning: '重要抉择期，进退有据。', deepMeaning: '一"或"字最吃紧——非必然之跃。' },
  { position: 5, type: 'yang', originalText: '九五：飞龙在天，利见大人。', explanation: '大展宏图之时。', modernMeaning: '事业巅峰、果断决策。', deepMeaning: '九五为"天子"之位，礼贤下士。' },
  { position: 6, type: 'yang', originalText: '上九：亢龙有悔。', explanation: '盛极而衰。', modernMeaning: '宜收敛锋芒、知进退。', deepMeaning: '"亢"为过盛——"盈不可久"乃天道。' },
]

const POSITION_LABELS_YANG = ['初九', '九二', '九三', '九四', '九五', '上九'] as const
const POSITION_LABELS_YIN = ['初六', '六二', '六三', '六四', '六五', '上六'] as const

// 真实 mini 爻 — 阳实 / 阴断
function MiniYao({ type, isCurrent, dim = false }: { type: 'yin' | 'yang'; isCurrent: boolean; dim?: boolean }) {
  const color = isCurrent ? '#9b2c2c' : dim ? 'rgba(26,26,26,0.18)' : '#1a1a1a'
  const w = 32
  if (type === 'yang') {
    return <div style={{ width: w, height: 6, background: color, borderRadius: 1 }} />
  } else {
    return (
      <div style={{ display: 'flex', gap: 4, width: w }}>
        <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
        <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
      </div>
    )
  }
}

function MiniHexagramStack({ currentLine }: { currentLine: number }) {
  return (
    <div className="flex flex-col bg-rice/60 border border-june-bronze/30 rounded-md p-2" style={{ gap: 7 }}>
      {[6, 5, 4, 3, 2, 1].map((pos) => {
        const isCurrent = pos === currentLine
        const sample = SAMPLE_QIAN[pos - 1]!
        return (
          <div
            key={pos}
            className={cn(
              'flex items-center justify-center transition-all rounded-sm',
              isCurrent ? 'bg-june-red/20 ring-2 ring-june-red shadow-sm' : 'opacity-60',
            )}
            style={{ padding: '2px 4px' }}
          >
            <MiniYao type={sample.type} isCurrent={isCurrent} dim={!isCurrent} />
          </div>
        )
      })}
    </div>
  )
}

// 方案 A：放大版 mini 卦象堆栈（每爻真实形状，当前爻红框高亮）
function Variant_A({ yao }: { yao: YaoLine }) {
  return (
    <div className="flex gap-3 p-4 pl-4 pr-5 bg-rice/70 rounded shadow-sm border border-june-bronze/15">
      <div className="shrink-0">
        <MiniHexagramStack currentLine={yao.position} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
          <span className="inline-block px-2 py-0.5 bg-june-red text-rice text-xs font-display font-bold rounded-sm">
            {yao.type === 'yang' ? POSITION_LABELS_YANG[yao.position - 1] : POSITION_LABELS_YIN[yao.position - 1]}
          </span>
          <div className="font-display text-lg text-ink font-bold leading-snug">{yao.originalText}</div>
        </div>
        {yao.explanation && <div className="font-body text-sm text-ink-light italic mb-1"><span className="text-june-bronze font-display">▎释：</span>{yao.explanation}</div>}
        {yao.modernMeaning && <div className="font-body text-sm text-ink-light"><span className="text-june-bronze font-display">▎今：</span>{yao.modernMeaning}</div>}
      </div>
    </div>
  )
}

// 方案 B：大号数字 + 爻形
function Variant_B({ yao }: { yao: YaoLine }) {
  return (
    <div className="flex gap-3 p-4 pr-5 bg-rice/70 rounded shadow-sm border border-june-bronze/15">
      <div className="shrink-0 flex flex-col items-center gap-1 px-3 py-2 bg-june-red/10 border-2 border-june-red rounded-md">
        <div className="flex items-baseline gap-0.5">
          <span className="font-display text-xs text-june-bronze">第</span>
          <span className="font-display text-3xl text-june-red font-bold leading-none">{yao.position}</span>
        </div>
        <div className="font-display text-xs text-june-bronze tracking-widest">爻</div>
        <div className="mt-1.5">
          <MiniYao type={yao.type} isCurrent />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display text-lg text-ink font-bold mb-1.5 leading-snug">{yao.originalText}</div>
        {yao.explanation && <div className="font-body text-sm text-ink-light italic mb-1"><span className="text-june-bronze font-display">▎释：</span>{yao.explanation}</div>}
        {yao.modernMeaning && <div className="font-body text-sm text-ink-light"><span className="text-june-bronze font-display">▎今：</span>{yao.modernMeaning}</div>}
      </div>
    </div>
  )
}

// 方案 C：横向 6 格指示条 + 圆点高亮 + 爻位标签
function Variant_C({ yao }: { yao: YaoLine }) {
  return (
    <div className="bg-rice/70 rounded shadow-sm border border-june-bronze/15 overflow-hidden">
      <div className="flex items-stretch border-b-2 border-june-bronze/20 bg-rice/50">
        <div className="px-3 py-2 flex flex-col justify-center text-xs text-june-bronze font-display tracking-widest border-r border-june-bronze/20 shrink-0">
          爻位
        </div>
        {[1, 2, 3, 4, 5, 6].map((pos) => {
          const isCurrent = pos === yao.position
          const label = yao.type === 'yang' ? POSITION_LABELS_YANG[pos - 1] : POSITION_LABELS_YIN[pos - 1]
          return (
            <div
              key={pos}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-1.5 px-1 transition-colors border-r border-june-bronze/15 last:border-r-0',
                isCurrent ? 'bg-june-red text-rice' : 'text-ink-light/50 hover:text-ink-light',
              )}
            >
              <div className={cn('font-display text-sm font-bold', isCurrent && 'text-base')}>{pos}</div>
              <div className="font-display text-[10px] mt-0.5">{label}</div>
            </div>
          )
        })}
      </div>
      <div className="p-4 pl-5 pr-5">
        <div className="font-display text-lg text-ink font-bold mb-1.5 leading-snug">{yao.originalText}</div>
        {yao.explanation && <div className="font-body text-sm text-ink-light italic mb-1"><span className="text-june-bronze font-display">▎释：</span>{yao.explanation}</div>}
        {yao.modernMeaning && <div className="font-body text-sm text-ink-light"><span className="text-june-bronze font-display">▎今：</span>{yao.modernMeaning}</div>}
      </div>
    </div>
  )
}

export default function YaoDesignCompare() {
  const [selectedLine, setSelectedLine] = useState<1 | 2 | 3 | 4 | 5 | 6>(3)
  const yao = SAMPLE_QIAN[selectedLine - 1]!

  return (
    <PageLayout>
      <div className="text-center mb-6">
        <div className="text-sm text-june-bronze font-display tracking-widest mb-1">第 1 卦 · 乾为天</div>
        <h1 className="text-display-md font-display text-ink tracking-widest mb-2">爻位指示器 V2 对比</h1>
        <p className="text-sm text-ink-light font-body">3 个更清晰的方案 · 切换爻位看效果</p>
      </div>

      <div className="flex justify-center gap-2 mb-8 flex-wrap">
        {SAMPLE_QIAN.map((y) => {
          const label = y.type === 'yang' ? POSITION_LABELS_YANG[y.position - 1] : POSITION_LABELS_YIN[y.position - 1]
          const isActive = y.position === selectedLine
          return (
            <button
              key={y.position}
              type="button"
              onClick={() => setSelectedLine(y.position as 1 | 2 | 3 | 4 | 5 | 6)}
              className={cn(
                'px-3 py-1.5 rounded-sm font-display text-sm transition-colors',
                isActive
                  ? 'bg-june-red text-rice'
                  : 'bg-rice text-ink border border-june-bronze hover:bg-rice-dark',
              )}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div>
          <div className="text-center mb-3">
            <div className="inline-block px-3 py-1 bg-june-gold/15 text-june-bronze rounded-pill text-xs font-display mb-1">A</div>
            <div className="text-sm font-display text-ink mt-1">放大版 mini 卦象</div>
            <div className="text-xs text-ink-light mt-1">真实爻形 · 6 行清晰 · 当前爻红框</div>
          </div>
          <Variant_A yao={yao} />
        </div>

        <div>
          <div className="text-center mb-3">
            <div className="inline-block px-3 py-1 bg-rice text-june-bronze rounded-pill text-xs font-display mb-1">B</div>
            <div className="text-sm font-display text-ink mt-1">大号「第 N 爻」</div>
            <div className="text-xs text-ink-light mt-1">最直观 · 大数字 + 爻形</div>
          </div>
          <Variant_B yao={yao} />
        </div>

        <div>
          <div className="text-center mb-3">
            <div className="inline-block px-3 py-1 bg-rice text-june-bronze rounded-pill text-xs font-display mb-1">C</div>
            <div className="text-sm font-display text-ink mt-1">顶部 6 格位置条</div>
            <div className="text-xs text-ink-light mt-1">1-6 全列出 · 当前格红底白字</div>
          </div>
          <Variant_C yao={yao} />
        </div>
      </div>

      <div className="text-center text-xs text-ink-light/60 font-body mt-8">
        V2 对比页 · 解决"指示器太弱"问题
      </div>
    </PageLayout>
  )
}
