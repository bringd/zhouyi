import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  APPEARANCE_IDS,
  APPEARANCE_OPTIONS,
  DEFAULT_APPEARANCE,
  getAppearanceOption,
  isAppearanceId,
  normalizeAppearance,
} from '@/lib/appearance'
import {
  DEFAULT_SETTINGS,
  getAppearance,
  getSettings,
  saveAppearance,
  saveSettings,
} from '@/lib/storage'

describe('appearance 纯函数', () => {
  it('白名单只认三个稳定值', () => {
    expect([...APPEARANCE_IDS]).toEqual(['qinglan', 'zhusha', 'yehang'])
    expect(isAppearanceId('qinglan')).toBe(true)
    expect(isAppearanceId('zhusha')).toBe(true)
    expect(isAppearanceId('yehang')).toBe(true)
  })

  it('非法值一律拒绝并回落到默认外观', () => {
    for (const bad of ['a', 'B', 'qinglan ', '', 'night', null, undefined, 3, {}]) {
      expect(isAppearanceId(bad)).toBe(false)
      expect(normalizeAppearance(bad)).toBe(DEFAULT_APPEARANCE)
    }
  })

  it('默认外观是青岚书院', () => {
    expect(DEFAULT_APPEARANCE).toBe('qinglan')
    expect(getAppearanceOption('qinglan').name).toBe('青岚书院')
  })

  it('三套外观都有名称与说明（设置页卡片用）', () => {
    expect(APPEARANCE_OPTIONS).toHaveLength(3)
    for (const option of APPEARANCE_OPTIONS) {
      expect(option.name.length).toBeGreaterThan(0)
      expect(option.description.length).toBeGreaterThan(0)
      expect(option.swatch.paper).toMatch(/^#/)
    }
  })
})

describe('外观偏好存储', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('没有偏好时默认青岚书院', () => {
    expect(getAppearance()).toBe('qinglan')
    expect(getSettings().appearance).toBe('qinglan')
  })

  it('选择后写入存储并能读回', () => {
    expect(saveAppearance('zhusha')).toBe(true)
    expect(getAppearance()).toBe('zhusha')
    expect(saveAppearance('yehang')).toBe(true)
    expect(getAppearance()).toBe('yehang')
  })

  it('存储里的非法值回落到默认外观', () => {
    localStorage.setItem(
      'zhouyi:settings',
      JSON.stringify({ preferredLocale: 'zh-CN', theme: 'light', appearance: 'neon' })
    )
    expect(getAppearance()).toBe('qinglan')
    expect(getSettings().appearance).toBe('qinglan')
  })

  it('旧版本设置（没有 appearance 字段）仍可用，其它设置不丢', () => {
    localStorage.setItem(
      'zhouyi:settings',
      JSON.stringify({ preferredLocale: 'zh-CN', theme: 'light' })
    )
    const settings = getSettings()
    expect(settings.appearance).toBe('qinglan')
    expect(settings.preferredLocale).toBe('zh-CN')
    expect(settings.theme).toBe('light')
  })

  it('写入外观时保留其它设置', () => {
    saveSettings({ apiKey: 'sk-test' })
    saveAppearance('zhusha')
    const settings = getSettings()
    expect(settings.appearance).toBe('zhusha')
    expect(settings.apiKey).toBe('sk-test')
  })

  it('存储不可用时写入失败但不抛错（调用方据此提示）', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
    expect(saveAppearance('zhusha')).toBe(false)
    setItem.mockRestore()
  })

  it('存储内容损坏时也能回落，不抛错', () => {
    localStorage.setItem('zhouyi:settings', '{ broken json')
    expect(getAppearance()).toBe('qinglan')
    expect(getSettings().appearance).toBe('qinglan')
  })

  it('默认设置里带上默认外观', () => {
    expect(DEFAULT_SETTINGS.appearance).toBe('qinglan')
  })
})
