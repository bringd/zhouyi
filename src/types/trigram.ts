/**
 * 八卦 (Eight Trigrams) — fundamental 3-line symbols of the I Ching.
 * Each trigram has 3 lines (yin or yang) and is identified by an ID 1-8.
 *
 * ID mapping (per design spec 3.1):
 *   1=乾(天), 2=兑(泽), 3=离(火), 4=震(雷),
 *   5=巽(风), 6=坎(水), 7=艮(山), 8=坤(地)
 */
export interface Trigram {
  /** 1-8, unique identifier */
  id: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

  /** 卦名, e.g. "乾" */
  name: string

  /** 卦象符号, e.g. "☰" */
  symbol: '☰' | '☱' | '☲' | '☳' | '☴' | '☵' | '☶' | '☷'

  /** 自然之象, e.g. "天" */
  nature: string

  /** 卦德, e.g. "健" */
  attribute: string

  /** 五行, e.g. "金" */
  element: string

  /** 方位, e.g. "西北" */
  direction: string

  /** 六亲角色, e.g. "父" */
  familyRole: string

  /** 200字左右描述 */
  description: string
}

/** Type alias for the eight trigram IDs */
export type TrigramId = Trigram['id']
