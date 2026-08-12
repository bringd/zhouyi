import { useEffect, useReducer, useRef, useState } from 'react'

/** 随机 100-999 */
export function rollFinal(): number {
  return Math.floor(100 + Math.random() * 900)
}

export type RandomizerState =
  | { kind: 'idle' }
  | { kind: 'rolling' }
  | { kind: 'locked'; finalValue: number }

export type RandomizerAction =
  | { type: 'START' }
  | { type: 'LOCK'; finalValue: number }
  | { type: 'RESET' }

export function randomizerReducer(
  _state: RandomizerState,
  action: RandomizerAction
): RandomizerState {
  switch (action.type) {
    case 'START':
      return { kind: 'rolling' }
    case 'LOCK':
      return { kind: 'locked', finalValue: action.finalValue }
    case 'RESET':
      return { kind: 'idle' }
  }
}

interface UseManualRandomizerOpts {
  /** 用户锁定后的回调 */
  onLock: (finalValue: number) => void
  /** 数字翻滚一帧间隔（默认 60ms，高速翻滚） */
  tickMs?: number
  /** 超时自动锁定（默认 10000ms） */
  timeoutMs?: number
}

export function useManualRandomizer(opts: UseManualRandomizerOpts): {
  state: RandomizerState
  /** rolling 期间当前显示的数字 */
  displayValue: number | null
  /** 开始滚动 */
  start: () => void
  /** 用户手动停止（锁定当前显示值） */
  stop: () => void
} {
  const { tickMs = 60, timeoutMs = 10000 } = opts
  const [state, dispatch] = useReducer(randomizerReducer, { kind: 'idle' })
  const [displayValue, setDisplayValue] = useState<number | null>(null)

  // 保存最新 displayValue 供 stop/timeout 闭包读取
  const displayRef = useRef<number | null>(null)
  displayRef.current = displayValue

  // onLock 用 ref 保持最新（避免父组件 re-render 时 effect 重排）
  const onLockRef = useRef(opts.onLock)
  useEffect(() => {
    onLockRef.current = opts.onLock
  }, [opts.onLock])

  // rolling 期间按帧生成一个新数字
  useEffect(() => {
    if (state.kind !== 'rolling') return
    setDisplayValue(rollFinal()) // 立即出第一个
    const interval = setInterval(() => {
      setDisplayValue(rollFinal())
    }, tickMs)
    return () => clearInterval(interval)
  }, [state.kind, tickMs])

  // 超时自动锁定
  useEffect(() => {
    if (state.kind !== 'rolling') return
    const timeout = setTimeout(() => {
      const final = displayRef.current ?? rollFinal()
      dispatch({ type: 'LOCK', finalValue: final })
      onLockRef.current(final)
    }, timeoutMs)
    return () => clearTimeout(timeout)
  }, [state.kind, timeoutMs])

  const start = () => {
    if (state.kind !== 'idle') return
    dispatch({ type: 'START' })
  }

  const stop = () => {
    if (state.kind !== 'rolling') return
    const final = displayRef.current ?? rollFinal()
    dispatch({ type: 'LOCK', finalValue: final })
    onLockRef.current(final)
  }

  return { state, displayValue, start, stop }
}