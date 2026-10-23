import { useCallback, useState } from 'react'
import { numberToText, parseNumberText } from '@/lib/numberText'
import { useManualRandomizer, type RandomizerState } from './shared'

/** 三个灵数位 */
export type NumberPosition = 0 | 1 | 2

/** 单个灵数位的完整状态 */
export interface NumberFieldState {
  /** 用户敲下来的原始文本（可能是 '12'、'099' 这类中间态） */
  text: string
  /** 合法灵数（100–999）；空或越界为 null */
  value: number | null
  /** 取数器状态 */
  randomState: RandomizerState
  /** 滚动过程中显示的数字 */
  displayValue: number | null
}

export interface NumberBoxesState {
  /** 三个位的状态 */
  fields: readonly [NumberFieldState, NumberFieldState, NumberFieldState]
  /** 用户输入的原始文本变化 */
  setText: (position: NumberPosition, text: string) => void
  /** 开始随机取数 */
  start: (position: NumberPosition) => void
  /** 停止随机取数并定下当前数字 */
  stop: (position: NumberPosition) => void
}

function buildField(
  text: string,
  randomState: RandomizerState,
  displayValue: number | null
): NumberFieldState {
  return { text, value: parseNumberText(text), randomState, displayValue }
}

/**
 * 三个灵数位的稳定状态层。
 *
 * 为什么放在这里：起卦页会按外观切换视图组件（青岚 / 朱砂 / 夜航），
 * 换视图＝换组件类型＝整棵子树卸载重建。
 * 如果原始输入文本和取数滚动状态留在输入框内部，
 * 切一次外观就会丢掉「只输了两位」的内容，
 * 取数器也会被清空却仍然占着「取数中」的标记，导致启卦按钮再也点不动。
 *
 * 所以这两样状态都提到这一层：
 * - 原始文本：切换外观后输入框从上层拿回同样的文本；
 * - 取数控制器：定时器、滚动值、超时自动停止都活在稳定层，
 *   换外观不打断；新的外观里「停止」按钮照常可用。
 */
export function useNumberBoxesState(
  initialValues?: readonly (number | null)[]
): NumberBoxesState {
  const [texts, setTexts] = useState<[string, string, string]>(() => [
    numberToText(initialValues?.[0] ?? null),
    numberToText(initialValues?.[1] ?? null),
    numberToText(initialValues?.[2] ?? null),
  ])

  // 取数锁定时把原始文本也落定，文本与数值始终同源
  const lock = useCallback((position: NumberPosition, finalValue: number) => {
    setTexts((current) => {
      const next: [string, string, string] = [current[0], current[1], current[2]]
      next[position] = String(finalValue)
      return next
    })
  }, [])

  const first = useManualRandomizer({ onLock: (v) => lock(0, v) })
  const second = useManualRandomizer({ onLock: (v) => lock(1, v) })
  const third = useManualRandomizer({ onLock: (v) => lock(2, v) })

  const setText = useCallback((position: NumberPosition, text: string) => {
    setTexts((current) => {
      const next: [string, string, string] = [current[0], current[1], current[2]]
      next[position] = text
      return next
    })
  }, [])

  const start = (position: NumberPosition) => {
    if (position === 0) first.start()
    else if (position === 1) second.start()
    else third.start()
  }

  const stop = (position: NumberPosition) => {
    if (position === 0) first.stop()
    else if (position === 1) second.stop()
    else third.stop()
  }

  const fields: readonly [NumberFieldState, NumberFieldState, NumberFieldState] = [
    buildField(texts[0], first.state, first.displayValue),
    buildField(texts[1], second.state, second.displayValue),
    buildField(texts[2], third.state, third.displayValue),
  ]

  return { fields, setText, start, stop }
}
