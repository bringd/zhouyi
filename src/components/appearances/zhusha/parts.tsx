import type { ReactNode } from 'react'
import { getHexagramById } from '@/lib/divination'
import type { Hexagram, HexagramId } from '@/types'

/**
 * 朱砂档案（zhusha）三页共用的展示零件。
 *
 * 这里只放「装饰件」与「安全查表」两类纯展示逻辑：
 * - 装饰件一律 aria-hidden，不参与读屏；
 * - 查表失败返回 null，不抛错——卦象 id 来自上层 props，缺失时宁可少画一张卡，
 *   也不能让整页白屏。
 */

/** 印版：朱砂顶边的方框 + 圆形印章 + 竖排边栏 + 底部界线 */
export function ZhushaPlate({
  variant = 'hero',
}: {
  variant?: 'hero' | 'compact'
}) {
  return (
    <div
      className={
        variant === 'compact' ? 'zh-plate zh-plate--compact' : 'zh-plate'
      }
      aria-hidden="true"
    >
      <div className="zh-plate__ring">
        <span className="zh-plate__glyph">易</span>
        <i className="zh-plate__motto">一阴一阳之谓道</i>
      </div>
      <span className="zh-plate__side">观乎天文 · 以察时变</span>
      <span className="zh-plate__edition">
        卷 壹
        <br />
        六十四象
      </span>
      <div className="zh-plate__rules">
        {Array.from({ length: 7 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
    </div>
  )
}

/** 眉题：朱砂色的小号宽字距标签 */
export function ZhushaOverline({
  children,
  icon,
}: {
  children: ReactNode
  icon?: ReactNode
}) {
  return (
    <span className="zh-overline">
      {icon}
      {children}
    </span>
  )
}

/** 安全的卦象查表：id 不存在时返回 null */
export function safeHexagram(id: number): Hexagram | null {
  try {
    return getHexagramById(id as HexagramId)
  } catch {
    return null
  }
}

/** 动爻位置：只在 1–6 之间时返回，用于高亮爻线 */
export function asLinePosition(
  position: number
): 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  return position >= 1 && position <= 6
    ? (position as 1 | 2 | 3 | 4 | 5 | 6)
    : undefined
}
