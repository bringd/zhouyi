import { motion } from 'framer-motion'
import { cn } from '@/utils/cn'
import type { YaoLine } from '@/types'

export interface YaoLineScrollProps {
  /** The 6 yao lines for this hexagram, in order 1-6 (bottom to top in original I Ching convention) */
  yaoLines: YaoLine[]
  className?: string
}

const POSITION_LABELS_YANG = ['初九', '九二', '九三', '九四', '九五', '上九'] as const
const POSITION_LABELS_YIN = ['初六', '六二', '六三', '六四', '六五', '上六'] as const

// 真实 mini 爻 — 阳实 / 阴断
function MiniYao({ type, isCurrent }: { type: 'yin' | 'yang'; isCurrent: boolean }) {
  const color = isCurrent ? '#9b2c2c' : 'rgba(26,26,26,0.18)'
  const w = 32
  if (type === 'yang') {
    return <div style={{ width: w, height: 6, background: color, borderRadius: 1 }} />
  }
  return (
    <div style={{ display: 'flex', gap: 4, width: w }}>
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
      <div style={{ width: (w - 4) / 2, height: 6, background: color, borderRadius: 1 }} />
    </div>
  )
}

interface MiniHexagramStackProps {
  yaoLines: YaoLine[]
  currentLine: number
}

function MiniHexagramStack({ yaoLines, currentLine }: MiniHexagramStackProps) {
  return (
    <div
      className="flex flex-col bg-rice/60 border border-june-bronze/30 rounded-md p-2"
      style={{ gap: 7 }}
      aria-label={`位置指示器，当前在第 ${currentLine} 爻`}
      data-testid="mini-yao-stack"
    >
      {[6, 5, 4, 3, 2, 1].map((pos) => {
        const isCurrent = pos === currentLine
        const yao = yaoLines[pos - 1]
        const type: 'yin' | 'yang' = yao?.type ?? 'yang'
        return (
          <div
            key={pos}
            data-current={isCurrent ? 'true' : 'false'}
            data-position={pos}
            className={cn(
              'flex items-center justify-center rounded-sm transition-all',
              isCurrent
                ? 'bg-june-red/20 ring-2 ring-june-red shadow-sm'
                : 'opacity-60',
            )}
            style={{ padding: '2px 4px' }}
          >
            <MiniYao type={type} isCurrent={isCurrent} />
          </div>
        )
      })}
    </div>
  )
}

/**
 * 卷轴式 爻辞展示 — 工笔风格的 6 爻独立卡片列表（A 方案 V2 增强版）。
 * 左侧放大版 mini 6 爻堆栈（真实爻形 + 当前爻红框红底高亮 + 其他爻灰显），
 * 右侧 爻位徽章 + 卦辞 / 释 / 今 / 深意。
 * 字段为空时显示「（待补）」占位符，确保空卦仍能优雅渲染。
 */
export function YaoLineScroll({ yaoLines, className }: YaoLineScrollProps) {
  // V3: 卦象传统视觉一致 — 卡片按 6→1 渲染（上九在顶、初九在底），
  // 与左侧 mini 卦象堆栈方向一致（6 上 1 下）。mini 堆栈内部仍按 yaoLines[pos-1] 查爻形。
  const displayOrder = [...yaoLines].reverse()

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {displayOrder.map((yao, idx) => {
        const labels = yao.type === 'yang' ? POSITION_LABELS_YANG : POSITION_LABELS_YIN
        const label = labels[yao.position - 1]
        const hasContent = yao.originalText || yao.explanation || yao.modernMeaning
        const hasDeepMeaning = yao.deepMeaning != null && yao.deepMeaning.trim() !== ''

        return (
          <motion.div
            key={yao.position}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
            className="flex gap-3 pl-4 pr-5 py-4 bg-rice/70 rounded shadow-sm border border-june-bronze/15"
            data-yao-position={yao.position}
          >
            {/* 左侧放大版 mini 6 爻堆栈 */}
            <div className="shrink-0">
              <MiniHexagramStack yaoLines={yaoLines} currentLine={yao.position} />
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 min-w-0">
              {/* 爻位徽章 + 卦辞 */}
              <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                <span
                  className="inline-block px-2 py-0.5 bg-june-red text-rice text-xs font-display font-bold rounded-sm shrink-0"
                  aria-label={label}
                >
                  {label}
                </span>
                {yao.originalText ? (
                  <div className="font-display text-lg text-ink font-bold leading-snug">
                    {yao.originalText}
                  </div>
                ) : (
                  <div className="font-display text-base text-ink-light/50 italic">
                    （爻辞待补）
                  </div>
                )}
              </div>

              {/* 释 */}
              {yao.explanation ? (
                <div className="font-body text-sm text-ink-light italic mb-1.5">
                  <span className="text-june-bronze font-display">▎释：</span>
                  {yao.explanation}
                </div>
              ) : (
                <div className="font-body text-sm text-ink-light/40 italic mb-1.5">
                  <span className="text-june-bronze/60 font-display">▎释：</span>（释义待补）
                </div>
              )}

              {/* 今 */}
              {yao.modernMeaning ? (
                <div className="font-body text-sm text-ink-light leading-relaxed">
                  <span className="text-june-bronze font-display">▎今：</span>
                  {yao.modernMeaning}
                </div>
              ) : (
                <div className="font-body text-sm text-ink-light/40 italic leading-relaxed">
                  <span className="text-june-bronze/60 font-display">▎今：</span>（今译待补）
                </div>
              )}

              {/* 深意 — 金线引出 */}
              {hasDeepMeaning && (
                <div className="mt-3 py-2.5 px-3 bg-gradient-to-r from-june-gold/20 to-transparent border-l-[3px] border-june-gold rounded-r-sm">
                  <div className="font-display text-xs font-bold text-june-bronze mb-1.5 tracking-wider">
                    深意
                  </div>
                  <div className="font-body text-sm text-ink leading-relaxed">
                    {yao.deepMeaning}
                  </div>
                </div>
              )}

              {/* 完全无内容时显示占位 */}
              {!hasContent && !hasDeepMeaning && (
                <div className="font-body text-sm text-ink-light/40 italic">
                  此爻内容待补全
                </div>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
