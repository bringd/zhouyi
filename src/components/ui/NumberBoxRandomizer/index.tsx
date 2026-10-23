import { Button } from '@/components/ui/Button'
import { NumberBox } from '@/components/ui/NumberBox'
import { cn } from '@/utils/cn'
import { RandomizerReel } from './RandomizerReel'
import type { NumberFieldState } from './state'

export interface NumberBoxWithRandomizerProps {
  /**
   * 该位的完整状态（原始文本 / 合法值 / 取数器状态）。
   * 由稳定层持有，切换外观时不会丢。
   */
  field: NumberFieldState
  /** 输入文本变化 */
  onTextChange: (text: string) => void
  /** 开始随机取数 */
  onStart: () => void
  /** 停止随机取数 */
  onStop: () => void
  label: string
  description?: string
  className?: string
  randomButtonLabel?: string
  stopButtonLabel?: string
}

/**
 * 灵数输入框 + 随机取数器。
 *
 * 完全受控：文本、滚动值、滚动状态都由上层（稳定层）持有，
 * 这里只负责画出来并把事件回调上去。
 */
export function NumberBoxWithRandomizer({
  field,
  onTextChange,
  onStart,
  onStop,
  label,
  description,
  className,
  randomButtonLabel,
  stopButtonLabel,
}: NumberBoxWithRandomizerProps) {
  const { text, randomState, displayValue } = field
  const isRolling = randomState.kind === 'rolling'
  // 取数滚动时锁住输入，避免手输与滚动互相覆盖
  const inputDisabled = isRolling

  const handleRandomClick = () => {
    if (isRolling) {
      onStop()
      return
    }
    if (randomState.kind !== 'idle') return
    onStart()
  }

  return (
    <div
      className={cn(
        'number-randomizer flex flex-col items-center gap-2',
        className
      )}
      data-state={randomState.kind}
    >
      <div className="relative inline-block">
        <NumberBox
          text={text}
          onTextChange={onTextChange}
          label={label}
          description={description}
          disabled={inputDisabled}
        />
        <RandomizerReel displayValue={displayValue} rolling={isRolling} />
      </div>
      <Button
        type="button"
        variant={isRolling ? 'primary' : 'secondary'}
        size="sm"
        onClick={handleRandomClick}
        disabled={randomState.kind === 'locked'}
        aria-label={
          (isRolling ? stopButtonLabel : randomButtonLabel) ?? '随机生成灵数'
        }
        className="number-randomizer-button font-display tracking-widest"
      >
        {isRolling ? '停 止' : '天降灵数'}
      </Button>
    </div>
  )
}
