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

/**
 * 卷轴式 爻辞展示 — 工笔风格的 6 爻独立卡片列表（A 方案）。
 * 左侧 mini 6 爻指示器（当前爻朱砂红高亮 + 左缘金线），右侧爻辞 / 释 / 今 / 深意。
 * 字段为空时显示「（待补）」占位符，确保 62/64 卦（暂无数据）仍能优雅渲染。
 */
export function YaoLineScroll({ yaoLines, className }: YaoLineScrollProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {yaoLines.map((yao, idx) => {
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
            {/* 左侧 mini 6 爻指示器 — 当前爻朱砂红 + 左缘金线 */}
            <div
              className="flex flex-col gap-[3px] shrink-0"
              aria-label={`位置指示器，当前在第 ${yao.position} 爻`}
              data-testid="mini-yao-stack"
            >
              {[6, 5, 4, 3, 2, 1].map((pos) => {
                const isCurrent = pos === yao.position
                return (
                  <div
                    key={pos}
                    className={cn(
                      'flex gap-[2px] py-[1px]',
                      isCurrent
                        ? 'px-[3px] bg-june-red/15 border-l-2 border-june-red rounded-sm'
                        : 'px-0 border-l-2 border-transparent'
                    )}
                    data-current={isCurrent ? 'true' : 'false'}
                  >
                    <div
                      className={cn(
                        'h-[3px] w-[10px]',
                        isCurrent ? 'bg-june-red' : 'bg-ink/20'
                      )}
                    />
                    <div
                      className={cn(
                        'h-[3px] w-[10px]',
                        isCurrent ? 'bg-june-red' : 'bg-ink/20'
                      )}
                    />
                  </div>
                )
              })}
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 min-w-0">
              {/* 爻位 + 卦辞：爻位作为小标签 */}
              <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
                <span
                  className="font-display text-xs text-june-red font-bold tracking-widest shrink-0"
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
