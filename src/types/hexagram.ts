import type { TrigramId } from './trigram'

/**
 * 64 卦 (Sixty-Four Hexagrams) — 6-line compositions of two trigrams.
 * Identified by ID 1-64 (King Wen sequence).
 */

/** 卦辞 (judgement) — the main text for the whole hexagram */
export interface Judgement {
  /** 卦辞原文 */
  original: string
}

/** 彖传 (Commentary on the Judgement) */
export interface Tuanzhuan {
  /** 彖传原文 */
  original: string
}

/** 象传 (Commentary on the Image) */
export interface Xiangzhuan {
  /** 大象 (overall image) */
  daXiang: string

  /** 六爻小象 (line-by-line image commentary) */
  xiaoXiang: [string, string, string, string, string, string]
}

/** 单条爻 (a single line of a hexagram) */
export interface YaoLine {
  /** 爻位, 1-6 (1 = bottom) */
  position: 1 | 2 | 3 | 4 | 5 | 6

  /** 阴爻/阳爻 */
  type: 'yin' | 'yang'

  /** 爻辞原文 */
  originalText: string

  /** 简短解释, 30-50字 */
  explanation: string

  /** 现代意义, 80-120字 */
  modernMeaning: string
}

/** 京房八宫角色 (Eight Palaces role in the Jing Fang system) */
export type PalaceRole =
  | '本宫卦'
  | '一世'
  | '二世'
  | '三世'
  | '四世'
  | '五世'
  | '游魂'
  | '归魂'

/** 主题分类标签 (used by codex grouping) */
export type Theme = '人生总论' | '事业行动' | '关系情感' | '成长修养' | '困境抉择' | '顺遂归藏'

/** 卦象之间的关系 */
export interface HexagramRelations {
  /** 错卦 (opposite — all 6 lines flipped) — same hexagram OK */
  opposite: number

  /** 综卦 (inverse — flipped upside down) — same hexagram OK */
  inverse: number

  /** 互卦 (nuclear — derived from inner 4 lines) */
  nuclear: number
}

/** 64 卦主类型 */
export interface Hexagram {
  /** 1-64, unique identifier (King Wen sequence) */
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
    | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
    | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
    | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
    | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50
    | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60
    | 61 | 62 | 63 | 64

  /** 卦序数字 */
  number: number

  /** 全名, e.g. "乾为天" */
  name: string

  /** 简称, e.g. "乾" */
  shortName: string

  /** 上卦 ID (1-8) */
  upperTrigramId: TrigramId

  /** 下卦 ID (1-8) */
  lowerTrigramId: TrigramId

  /** 6位二进制代码, 自下而上: e.g. 乾="111111", 坤="000000" */
  binaryCode: string

  /** 京房八宫 (1-8) */
  palace: TrigramId

  /** 八宫角色 */
  palaceRole: PalaceRole

  /** 主题分类标签, 1-3 个 */
  theme: Theme[]

  /** 卦辞 */
  judgement: string

  /** 彖传 */
  tuanzhuan: string

  /** 象传 (含大象 + 六爻小象) */
  xiangzhuan: Xiangzhuan

  /** 6 条爻 */
  yaoLines: [YaoLine, YaoLine, YaoLine, YaoLine, YaoLine, YaoLine]

  /** 4-6 个关键词 */
  keywords: string[]

  /** 现代解读, 200-300字 */
  modernInterpretation: string

  /** 卦象之间的关系 */
  relations: HexagramRelations
}

/** Type alias for hexagram IDs */
export type HexagramId = Hexagram['id']
