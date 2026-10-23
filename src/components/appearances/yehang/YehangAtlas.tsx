import { useId } from 'react'

export interface YehangAtlasProps {
  /** 尺寸档位：首页大图 / 起卦页小图 */
  variant?: 'hero' | 'compact'
  /** 底部图注（纯装饰） */
  caption?: string
  /** 中心的仪式字 */
  centerGlyph?: string
  /** 中心的拉丁小字 */
  centerNote?: string
}

/**
 * 夜航观象的星图场景（装饰层）。
 *
 * - 纯静态，没有任何持续动画：装饰性图形不参与「减少动态效果」的开关，
 *   因为它本来就不动。
 * - 颜色全部来自语义令牌（见 yehang.css），SVG 里只用 currentColor /
 *   stop-color 类名，不写死十六进制。
 * - 整棵子树 aria-hidden：不承载信息，读屏用户直接跳过。
 */
export function YehangAtlas({
  variant = 'hero',
  caption,
  centerGlyph = '观',
  centerNote = 'LOOK WITHIN',
}: YehangAtlasProps) {
  const uid = useId().replace(/:/g, '')

  return (
    <div
      className={`yh-atlas yh-atlas--${variant}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 600 600" fill="none">
        <defs>
          <radialGradient id={`yh-glow-${uid}`}>
            <stop className="yh-atlas__glow-start" offset="0" />
            <stop className="yh-atlas__glow-end" offset="1" />
          </radialGradient>
        </defs>
        <circle
          cx="300"
          cy="300"
          r="290"
          fill={`url(#yh-glow-${uid})`}
        />
        <g className="yh-atlas__rings" stroke="currentColor">
          <circle cx="300" cy="300" r="230" opacity=".5" />
          <circle cx="300" cy="300" r="218" opacity=".2" />
          <circle
            cx="300"
            cy="300"
            r="157"
            strokeDasharray="2 9"
            opacity=".55"
          />
          <circle cx="300" cy="300" r="110" opacity=".3" />
          {Array.from({ length: 64 }, (_, i) => (
            <path
              key={i}
              d={i % 8 === 0 ? 'M300 62v23' : 'M300 68v10'}
              transform={`rotate(${i * 5.625} 300 300)`}
              opacity={i % 8 === 0 ? '.9' : '.4'}
            />
          ))}
          <path d="M300 48v504M48 300h504M125 125l350 350M125 475l350-350" opacity=".13" />
          <path d="M179 190l204-35 80 189-195 112-89-266Z" opacity=".4" />
          <path d="M179 190l284 154M383 155L268 456" opacity=".2" />
        </g>
        <g className="yh-atlas__marks">
          {[
            [179, 190],
            [383, 155],
            [463, 344],
            [268, 456],
            [107, 387],
            [452, 111],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle className="yh-atlas__star" cx={cx} cy={cy} r="3" />
              <circle
                className="yh-atlas__star-ring"
                cx={cx}
                cy={cy}
                r="8"
                opacity=".25"
              />
            </g>
          ))}
        </g>
        <text x="300" y="118" textAnchor="middle" fontSize="14" letterSpacing="6">
          乾 · 天
        </text>
        <text x="300" y="502" textAnchor="middle" fontSize="14" letterSpacing="6">
          坤 · 地
        </text>
      </svg>
      <div className="yh-atlas__center">
        <span>{centerGlyph}</span>
        <small>{centerNote}</small>
      </div>
      {caption ? <span className="yh-atlas__caption">{caption}</span> : null}
    </div>
  )
}
