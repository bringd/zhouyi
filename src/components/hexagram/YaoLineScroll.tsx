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
 * 卷轴式 爻辞展示 — 工笔风格的 6 爻独立卡片列表。
 * 每爻显示：爻位 + 爻辞原文 + 释 + 今 + （可选）深意
 * 字段为空时显示「（待补）」占位符，确保 62/64 卦（暂无数据）仍能优雅渲染。
 */
export function YaoLineScroll({ yaoLines, className }: YaoLineScrollProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {yaoLines.map((yao, idx) => {
        const labels = yao.type === 'yang' ? POSITION_LABELS_YANG : POSITION_LABELS_YIN
        const label = labels[idx]
        const hasContent = yao.originalText || yao.explanation || yao.modernMeaning
        const hasDeepMeaning = yao.deepMeaning != null && yao.deepMeaning.trim() !== ''

        return (
          <motion.div
            key={yao.position}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.4, delay: idx * 0.05 }}
            className="relative pl-[70px] pr-5 py-4 bg-rice/70 rounded shadow-sm border border-june-bronze/15"
          >
            {/* 爻位 badge — 朱砂红 + 米色字 + 旋转 -2° */}
            <div
              className="absolute left-3 top-3 w-12 h-12 bg-june-red text-rice flex items-center justify-center font-display font-bold text-sm rounded-sm shadow-sm"
              style={{ transform: 'rotate(-2deg)' }}
              aria-label={label}
            >
              {label}
            </div>

            {/* 爻辞原文 */}
            {yao.originalText ? (
              <div className="font-display text-lg text-ink font-bold mb-2 leading-snug">
                {yao.originalText}
              </div>
            ) : (
              <div className="font-display text-base text-ink-light/50 italic mb-2">
                （爻辞待补）
              </div>
            )}

            {/* 释 */}
            {yao.explanation && (
              <div className="font-body text-sm text-ink-light italic mb-1.5">
                <span className="text-june-bronze font-display">▎释：</span>
                {yao.explanation}
              </div>
            )}

            {/* 今 */}
            {yao.modernMeaning && (
              <div className="font-body text-sm text-ink-light leading-relaxed">
                <span className="text-june-bronze font-display">▎今：</span>
                {yao.modernMeaning}
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
          </motion.div>
        )
      })}
    </div>
  )
}
