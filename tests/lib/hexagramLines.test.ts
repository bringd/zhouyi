import { describe, it, expect } from 'vitest'
import {
  hexagramLineStates,
  hexagramLineTypes,
} from '@/lib/hexagramLines'
import { getHexagramById } from '@/lib/divination'
import type { Hexagram } from '@/types'

const qian = getHexagramById(1) // 乾为天：六爻皆阳
const kun = getHexagramById(2) // 坤为地：六爻皆阴

describe('hexagramLineTypes', () => {
  it('returns the six line types bottom-to-top', () => {
    const lines = hexagramLineTypes(qian)
    expect(lines).toHaveLength(6)
    expect(lines.every((type) => type === 'yang')).toBe(true)
  })

  it('returns all yin for an all-yin hexagram', () => {
    const lines = hexagramLineTypes(kun)
    expect(lines.every((type) => type === 'yin')).toBe(true)
  })

  it('keeps the order of yaoLines (index 0 = position 1 = bottom)', () => {
    const types = hexagramLineTypes(kun)
    const expected = kun.yaoLines.map((line) => line.type)
    expect(types).toEqual(expected)
  })

  it('阴阳混合卦同样自下而上（地天泰：下乾上坤）', () => {
    const tai = getHexagramById(11)
    const types = hexagramLineTypes(tai)
    expect(types).toHaveLength(6)
    expect(types).toContain('yin')
    expect(types).toContain('yang')
    expect(types).toEqual(tai.yaoLines.map((line) => line.type))
  })
})

describe('hexagramLineStates', () => {
  it('marks every line as normal by default', () => {
    const states = hexagramLineStates(kun)
    expect(states.every((state) => state === 'normal')).toBe(true)
  })

  it('marks the moving line as changed when the hexagram is the changed one', () => {
    const states = hexagramLineStates(kun, { movingLine: 2, changed: true })
    expect(states[1]).toBe('changed')
    expect(states.filter((state) => state === 'changed')).toHaveLength(1)
  })

  it('does not mark anything when the hexagram is the main one', () => {
    const states = hexagramLineStates(kun, { movingLine: 2, changed: false })
    expect(states.every((state) => state === 'normal')).toBe(true)
  })

  it('ignores an out-of-range moving line', () => {
    const states = hexagramLineStates(kun, { movingLine: 9, changed: true })
    expect(states.every((state) => state === 'normal')).toBe(true)
  })
})

// 类型层面的约束：helper 必须接受只带 yaoLines 的最小结构
const minimal: Pick<Hexagram, 'yaoLines'> = kun
describe('helper input shape', () => {
  it('accepts a hexagram-like object with only yaoLines', () => {
    expect(hexagramLineTypes(minimal)).toHaveLength(6)
    expect(hexagramLineStates(minimal)).toHaveLength(6)
  })
})
