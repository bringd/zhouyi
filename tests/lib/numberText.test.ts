import { describe, it, expect } from 'vitest'
import {
  sanitizeNumberText,
  parseNumberText,
  numberToText,
  NUMBER_TEXT_MAX_DIGITS,
} from '@/lib/numberText'

describe('sanitizeNumberText', () => {
  it('去掉非数字字符', () => {
    expect(sanitizeNumberText('a1b2c3')).toBe('123')
  })

  it('最多保留三位', () => {
    expect(sanitizeNumberText('123456')).toBe('123')
    expect(NUMBER_TEXT_MAX_DIGITS).toBe(3)
  })

  it('空串保持为空', () => {
    expect(sanitizeNumberText('')).toBe('')
  })
})

describe('parseNumberText', () => {
  it('三位合法数字返回数值', () => {
    expect(parseNumberText('123')).toBe(123)
    expect(parseNumberText('999')).toBe(999)
    expect(parseNumberText('100')).toBe(100)
  })

  it('位数不足返回 null', () => {
    expect(parseNumberText('1')).toBeNull()
    expect(parseNumberText('12')).toBeNull()
  })

  it('越界数值返回 null', () => {
    expect(parseNumberText('099')).toBeNull()
    expect(parseNumberText('012')).toBeNull()
  })

  it('空串返回 null', () => {
    expect(parseNumberText('')).toBeNull()
  })

  it('非数字返回 null', () => {
    expect(parseNumberText('12a')).toBeNull()
  })
})

describe('numberToText', () => {
  it('数值转文本', () => {
    expect(numberToText(427)).toBe('427')
  })

  it('null 转空串', () => {
    expect(numberToText(null)).toBe('')
  })
})
