import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { NumberBox } from '@/components/ui/NumberBox'
import { cn } from '@/utils/cn'
import { RandomizerReel } from './RandomizerReel'
import { useManualRandomizer } from './shared'

export interface NumberBoxWithRandomizerProps {
  value: number | null
  onChange: (v: number | null) => void
  label: string
  description?: string
  onRandomStart?: () => void
  onRandomEnd?: (finalValue: number) => void
  className?: string
}

export function NumberBoxWithRandomizer({
  value,
  onChange,
  label,
  description,
  onRandomStart,
  onRandomEnd,
  className,
}: NumberBoxWithRandomizerProps) {
  const [inputDisabled, setInputDisabled] = useState(false)

  const { state, displayValue, start, stop } = useManualRandomizer({
    onLock: (finalValue) => {
      setInputDisabled(false)
      onChange(finalValue)
      onRandomEnd?.(finalValue)
    },
  })

  const isRolling = state.kind === 'rolling'

  const handleRandomClick = () => {
    if (isRolling) {
      stop()
      return
    }
    if (state.kind !== 'idle') return
    setInputDisabled(true)
    onRandomStart?.()
    start()
  }

  return (
    <div className={cn('flex flex-col items-center gap-2', className)}>
      <div className="relative inline-block">
        <NumberBox
          value={value}
          onChange={onChange}
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
        disabled={state.kind === 'locked'}
        aria-label="随机生成灵数"
        className="font-display tracking-widest"
      >
        {isRolling ? '停 止' : '天降灵数'}
      </Button>
    </div>
  )
}