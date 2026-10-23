import type { FormEvent } from 'react'
import type { NumberFieldState } from '@/components/ui/NumberBoxRandomizer/state'
import type { Hexagram, UserRecord } from '@/types'

/**
 * 三套外观共用的视图契约。
 *
 * 原则：一套业务状态 + 三套展示。
 * - 视图组件只接收数据与回调，不自己取数、不自己发请求、不写存储；
 * - 业务状态（起卦输入、AI 流式内容、保存/发布状态）留在页面/容器组件里，
 *   切换外观只换视图子树，因此不会丢输入、不会重发请求、不会清空缓存；
 * - 视图里不得出现示例数据，一切内容来自 props。
 */

/* ----------------------------- 首页 ----------------------------- */

export interface HomeReadingTheme {
  label: string
  /** 该主题涵盖的卦序 */
  ids: readonly number[]
}

export interface HomeAppearanceProps {
  /** 今日主卦 */
  main: Hexagram
  /** 今日变卦 */
  changed: Hexagram
  /** 动爻（1–6） */
  movingLine: number
  /** 真实日期文案（由页面按本地时区生成） */
  dateLabel: string
  /** 本地时区（IANA），没有时区时为空串 */
  timeZone: string
  /** 首页「一卦一境」的阅读主题 */
  readingThemes: readonly HomeReadingTheme[]
  /** 当前选中的主题下标 */
  activeThemeIndex: number
  /** 切换阅读主题 */
  onThemeChange: (index: number) => void
}

/* --------------------------- 三数起卦 --------------------------- */

export type NumberPosition = 0 | 1 | 2

export interface CastAppearanceProps {
  /** 已填写的问题（受控） */
  question: string
  onQuestionChange: (value: string) => void
  /** 输入框占位提示（示例问题，由上层生成） */
  questionPlaceholder: string
  /**
   * 三个灵数位的完整状态：原始文本 / 合法值 / 取数器状态。
   * 由稳定层（DivinationForm）持有，切换外观时不丢。
   */
  numberFields: readonly [
    NumberFieldState,
    NumberFieldState,
    NumberFieldState,
  ]
  /** 用户输入的原始文本变化（可能是 '12' 这种未输完的中间态） */
  onNumberTextChange: (position: NumberPosition, text: string) => void
  /** 开始随机取数 */
  onRandomStart: (position: NumberPosition) => void
  /** 停止随机取数 */
  onRandomStop: (position: NumberPosition) => void
  /** 校验错误 */
  error: string | null
  /** 三个数字都已合法 */
  isValid: boolean
  /** 已选定的合法数字个数 */
  selectedCount: number
  /** 是否有取数器在滚动 */
  isRolling: boolean
  /** 提交（由上层统一处理校验、起卦与存档） */
  onSubmit: (event: FormEvent) => void
}

/* ---------------------------- 结果页 ---------------------------- */

export interface ResultAppearanceProps {
  /** 真实记录 */
  record: UserRecord
  /** 主卦 */
  main: Hexagram
  /** 变卦 */
  changed: Hexagram
  /** 动爻位置 */
  movingLine: 1 | 2 | 3 | 4 | 5 | 6
  /** 记录时间文案 */
  timestampText: string
  /** AI 解读正文（流式累积或缓存） */
  aiText: string | null
  /** AI 请求状态 */
  aiStatus: 'idle' | 'loading' | 'error'
  /** AI 错误文案 */
  aiError: string | null
  /** 记录里已有缓存解读 */
  hasCache: boolean
  /** 是否正在请求 */
  isLoading: boolean
  /** 是否出错 */
  isError: boolean
  /** 是否有可显示的解读正文 */
  hasText: boolean
  /** 轻提示文案 */
  toast: string | null
  /** 下载卦象卡进行中 */
  downloadBusy: boolean
  /** 发布社区进行中 */
  publishBusy: boolean
  /** 已发布到社区的记录 id */
  publishedId: string | null
  /** 已收藏到云端卦册的记录 id */
  savedCloudId: string | null
  /** 云端收藏进行中 */
  saveRecordBusy: boolean
  /** 传给卡片/社区的摘要 */
  aiSummarySource: string | undefined
  /** 请求 AI 解读 */
  onInterpret: () => void
  /** 下载卦象卡 PNG */
  onDownload: () => void
  /** 发布到社区卦册 */
  onShare: () => void
  /** 收藏到云端卦册 */
  onSaveToRecords: () => void
}
