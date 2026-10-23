import type { HexagramId } from './hexagram'
import type { AppearanceId } from '@/lib/appearance'

/**
 * User records — divination history and saved items.
 * Stored in LocalStorage (no backend in MVP).
 */

/** 三数起卦或今日卦境的记录 */
export interface UserRecord {
  /** uuid */
  id: string

  /** 记录类型 */
  type: 'three-number' | 'daily'

  /** 创建时间戳 (ms) */
  createdAt: number

  /** 三数起卦时的问题 (可选) */
  question?: string

  /** 三数起卦的输入 */
  numbers?: [number, number, number]

  /** 时区 (IANA, e.g. 'Asia/Singapore') */
  region: string

  /** 时区 (e.g. "Asia/Singapore") */
  timezone: string

  /** 本卦 ID */
  mainHexagramId: HexagramId

  /** 动爻 (1-6) */
  movingLine: 1 | 2 | 3 | 4 | 5 | 6

  /** 变卦 ID */
  changedHexagramId: HexagramId

  /** AI 解读 (用户主动请求时缓存) */
  aiInterpretation?: string

  /** 用户备注 */
  userNote?: string

  /** schema 版本 */
  version: 1
}

/** 用户设置 */
export interface UserSettings {
  /** Claude API Key (加密存 LocalStorage) */
  apiKey?: string

  /** 首选语言 (MVP 仅 zh-CN) */
  preferredLocale: 'zh-CN'

  /** 主题 (MVP 仅 light) */
  theme: 'light'

  /**
   * 站点外观：三套视觉风格之一。
   * 与 theme 分开存放——theme 仍是「明/暗」的老字段，扩展它会混装两种语义。
   */
  appearance?: AppearanceId
}
