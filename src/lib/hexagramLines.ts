import type { Hexagram, LineState, LineType } from '@/types'

/** 六爻的阴阳类型，自下而上（索引 0 = 第 1 爻 = 最下） */
export type HexagramLineTypes = [
  LineType,
  LineType,
  LineType,
  LineType,
  LineType,
  LineType,
]

/** 六爻的显示状态，自下而上 */
export type HexagramLineStates = [
  LineState,
  LineState,
  LineState,
  LineState,
  LineState,
  LineState,
]

/**
 * 取卦象的六爻阴阳类型。
 *
 * 组件层此前散落着 `yaoLines.map(l => l.type) as YaoLineStackProps['lines']`
 * 这类强制断言，抽到这里后调用点不再需要 cast。
 */
export function hexagramLineTypes(
  hexagram: Pick<Hexagram, 'yaoLines'>
): HexagramLineTypes {
  const [l1, l2, l3, l4, l5, l6] = hexagram.yaoLines
  return [l1.type, l2.type, l3.type, l4.type, l5.type, l6.type]
}

/**
 * 取卦象的六爻显示状态。
 *
 * - `movingLine`: 动爻位置（1-6）
 * - `changed`: 是否为变卦（变卦里动爻标记为 'changed'，本卦由组件高亮）
 */
export function hexagramLineStates(
  hexagram: Pick<Hexagram, 'yaoLines'>,
  options: { movingLine?: number; changed?: boolean } = {}
): HexagramLineStates {
  const { movingLine, changed = false } = options
  const stateOf = (position: number): LineState =>
    changed && movingLine === position ? 'changed' : 'normal'

  const [l1, l2, l3, l4, l5, l6] = hexagram.yaoLines
  return [
    stateOf(l1.position),
    stateOf(l2.position),
    stateOf(l3.position),
    stateOf(l4.position),
    stateOf(l5.position),
    stateOf(l6.position),
  ]
}
