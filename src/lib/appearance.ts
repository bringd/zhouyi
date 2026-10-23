/**
 * 外观（Appearance）—— 站点三套视觉风格的稳定标识与校验。
 *
 * 约定：
 * - 正式界面统一称「外观」，不出现「方案 A/B/C」「设计实验室」等提案措辞。
 * - 存储值只用 qinglan / zhusha / yehang 三个白名单值，读写都要过白名单，
 *   非法值、旧版本缺字段、存储损坏一律回落到默认外观（青岚书院）。
 * - 这里只放纯数据与纯函数，不碰 DOM 与 localStorage。
 */

export const APPEARANCE_IDS = ['qinglan', 'zhusha', 'yehang'] as const

export type AppearanceId = (typeof APPEARANCE_IDS)[number]

/** 默认外观：青岚书院 */
export const DEFAULT_APPEARANCE: AppearanceId = 'qinglan'

export interface AppearanceOption {
  id: AppearanceId
  /** 正式名称 */
  name: string
  /** 一句话气质描述 */
  tagline: string
  /** 卡片里的说明文字 */
  description: string
  /** 缩略示意用的颜色（纸面 / 主色 / 墨色） */
  swatch: { paper: string; accent: string; ink: string }
}

/** 三套外观的展示信息（设置页卡片与 Header 快捷入口共用） */
export const APPEARANCE_OPTIONS: readonly AppearanceOption[] = [
  {
    id: 'qinglan',
    name: '青岚书院',
    tagline: '山水 · 阅读 · 松弛',
    description: '浅纸色、青绿山水，留白宽舒，适合慢慢读。',
    swatch: { paper: '#f5f4ec', accent: '#355e4b', ink: '#263e34' },
  },
  {
    id: 'zhusha',
    name: '朱砂档案',
    tagline: '朱砂 · 书册 · 秩序',
    description: '暖纸色与朱砂红，方正边界，像一册装帧整齐的手稿。',
    swatch: { paper: '#f3ecdd', accent: '#a33a2e', ink: '#382c25' },
  },
  {
    id: 'yehang',
    name: '夜航观象',
    tagline: '星图 · 仪式 · 探索',
    description: '深色底、淡金与青绿，像在夜里摊开一张星图观测。',
    swatch: { paper: '#101f23', accent: '#d9c690', ink: '#ecebdc' },
  },
]

/** 是否是受支持的外观值 */
export function isAppearanceId(value: unknown): value is AppearanceId {
  return (
    typeof value === 'string' &&
    (APPEARANCE_IDS as readonly string[]).includes(value)
  )
}

/**
 * 每套外观的页面底色。
 *
 * 用途：`index.html` 的预绘脚本在样式表加载完成前先给 <html> 上底色，
 * 避免冷启动时闪一下别的颜色；运行时切换外观也要同步这个内联底色。
 * 取值必须与 `src/styles/tokens.css` / `src/styles/appearance.css` 里的
 * `--color-bg-page` 保持一致。
 */
export const APPEARANCE_PAGE_BG: Record<AppearanceId, string> = {
  qinglan: '#f5f4ec',
  zhusha: '#f3ecdd',
  yehang: '#101f23',
}

/**
 * 归一化外部输入：非法值 / 缺字段 / 非字符串一律回落到默认外观。
 * 读取存储时使用，保证旧设置与损坏数据不会让站点崩掉。
 */
export function normalizeAppearance(value: unknown): AppearanceId {
  return isAppearanceId(value) ? value : DEFAULT_APPEARANCE
}

/** 取展示信息 */
export function getAppearanceOption(id: AppearanceId): AppearanceOption {
  return (
    APPEARANCE_OPTIONS.find((option) => option.id === id) ??
    APPEARANCE_OPTIONS[0]
  )
}
