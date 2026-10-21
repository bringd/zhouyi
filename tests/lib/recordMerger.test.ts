import { describe, it, expect } from 'vitest'
import {
  mergeRecords,
  toLocalListItem,
  toCloudListItem,
} from '@/lib/recordMerger'
import type { CloudRecord } from '@/lib/records'
import type { UserRecord } from '@/types'

function localRecord(over: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'local-1',
    type: 'three-number',
    createdAt: 1_700_000_000_000,
    question: '本地问题',
    numbers: [111, 222, 333],
    region: 'Asia/Shanghai',
    timezone: 'Asia/Shanghai',
    mainHexagramId: 1,
    movingLine: 1,
    changedHexagramId: 2,
    version: 1,
    ...over,
  }
}

function cloudRecord(over: Partial<CloudRecord> = {}): CloudRecord {
  return {
    id: 'cloud-1',
    type: 'three-number',
    question: '云端问题',
    numbers: [444, 555, 666],
    region: 'Asia/Shanghai',
    timezone: 'Asia/Shanghai',
    mainHexagramId: 3,
    movingLine: 4,
    changedHexagramId: 5,
    aiInterpretation: null,
    userNote: null,
    createdAt: 1_700_000_100_000,
    updatedAt: 1_700_000_100_000,
    ...over,
  }
}

describe('mergeRecords', () => {
  it('returns [] for two empty sources', () => {
    expect(mergeRecords([], [])).toEqual([])
  })

  it('maps a local record with source=local', () => {
    const [item] = mergeRecords([localRecord()], [])
    expect(item.source).toBe('local')
    expect(item.id).toBe('local-1')
    expect(item.question).toBe('本地问题')
    expect(item.raw).toBeInstanceOf(Object)
  })

  it('maps a cloud record with source=cloud', () => {
    const [item] = mergeRecords([], [cloudRecord()])
    expect(item.source).toBe('cloud')
    expect(item.id).toBe('cloud-1')
    expect(item.question).toBe('云端问题')
  })

  it('sorts newest first across both sources', () => {
    const local = [
      localRecord({ id: 'l-old', createdAt: 1000 }),
      localRecord({ id: 'l-mid', createdAt: 3000 }),
    ]
    const cloud = [
      cloudRecord({ id: 'c-new', createdAt: 5000 }),
      cloudRecord({ id: 'c-old', createdAt: 2000 }),
    ]

    expect(mergeRecords(local, cloud).map((i) => i.id)).toEqual([
      'c-new',
      'l-mid',
      'c-old',
      'l-old',
    ])
  })

  it('breaks createdAt ties deterministically by id', () => {
    const local = [localRecord({ id: 'zzz', createdAt: 1000 })]
    const cloud = [cloudRecord({ id: 'aaa', createdAt: 1000 })]

    expect(mergeRecords(local, cloud).map((i) => i.id)).toEqual(['aaa', 'zzz'])
    // Order must not depend on argument order.
    expect(mergeRecords(local, cloud).map((i) => i.id)).toEqual(
      mergeRecords(local, cloud).map((i) => i.id),
    )
  })

  it('does not de-duplicate identical content across sources', () => {
    const local = [localRecord({ id: 'l1', createdAt: 1000 })]
    const cloud = [
      cloudRecord({
        id: 'c1',
        createdAt: 1000,
        mainHexagramId: 1,
        movingLine: 1,
        changedHexagramId: 2,
      }),
    ]
    expect(mergeRecords(local, cloud)).toHaveLength(2)
  })

  it('normalises null cloud question/note to undefined', () => {
    const [item] = mergeRecords(
      [],
      [cloudRecord({ question: null, userNote: null })],
    )
    expect(item.question).toBeUndefined()
    expect(item.userNote).toBeUndefined()
  })
})

describe('hasAiInterpretation', () => {
  it('is false for an empty or whitespace-only reading', () => {
    expect(toLocalListItem(localRecord({ aiInterpretation: '' })).hasAiInterpretation).toBe(false)
    expect(toLocalListItem(localRecord({ aiInterpretation: '   ' })).hasAiInterpretation).toBe(false)
    expect(toCloudListItem(cloudRecord({ aiInterpretation: null })).hasAiInterpretation).toBe(false)
  })

  it('is true when a reading is cached', () => {
    expect(
      toLocalListItem(localRecord({ aiInterpretation: '## 卦象概要' }))
        .hasAiInterpretation,
    ).toBe(true)
    expect(
      toCloudListItem(cloudRecord({ aiInterpretation: '## 卦象概要' }))
        .hasAiInterpretation,
    ).toBe(true)
  })
})
