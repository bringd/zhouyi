import { describe, it, expectTypeOf } from 'vitest'
import type { Trigram, TrigramId } from '@/types/trigram'
import type { Hexagram, HexagramId, YaoLine } from '@/types/hexagram'
import type { UserRecord, UserSettings } from '@/types/record'

describe('Type definitions', () => {
  it('TrigramId is union of 1-8', () => {
    expectTypeOf<TrigramId>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8>()
  })

  it('HexagramId is union of 1-64', () => {
    expectTypeOf<HexagramId>().toEqualTypeOf<
      | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
      | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
      | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30
      | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40
      | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50
      | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60
      | 61 | 62 | 63 | 64
    >()
  })

  it('Trigram has all required fields', () => {
    expectTypeOf<Trigram>().toHaveProperty('id')
    expectTypeOf<Trigram>().toHaveProperty('name')
    expectTypeOf<Trigram>().toHaveProperty('symbol')
    expectTypeOf<Trigram>().toHaveProperty('nature')
    expectTypeOf<Trigram>().toHaveProperty('attribute')
    expectTypeOf<Trigram>().toHaveProperty('element')
    expectTypeOf<Trigram>().toHaveProperty('direction')
    expectTypeOf<Trigram>().toHaveProperty('familyRole')
    expectTypeOf<Trigram>().toHaveProperty('description')
  })

  it('Hexagram has all required fields', () => {
    expectTypeOf<Hexagram>().toHaveProperty('id')
    expectTypeOf<Hexagram>().toHaveProperty('name')
    expectTypeOf<Hexagram>().toHaveProperty('yaoLines')
    expectTypeOf<Hexagram>().toHaveProperty('judgement')
    expectTypeOf<Hexagram>().toHaveProperty('tuanzhuan')
    expectTypeOf<Hexagram>().toHaveProperty('xiangzhuan')
    expectTypeOf<Hexagram>().toHaveProperty('modernInterpretation')
  })

  it('YaoLine is tuple of 6', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    type YL = YaoLine['position']
    expectTypeOf<YL>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6>()
  })

  it('UserRecord has all required fields', () => {
    expectTypeOf<UserRecord>().toHaveProperty('id')
    expectTypeOf<UserRecord>().toHaveProperty('type')
    expectTypeOf<UserRecord>().toHaveProperty('mainHexagramId')
    expectTypeOf<UserRecord>().toHaveProperty('movingLine')
  })

  it('UserSettings has expected theme literal', () => {
    expectTypeOf<UserSettings['theme']>().toEqualTypeOf<'light'>()
  })
})
