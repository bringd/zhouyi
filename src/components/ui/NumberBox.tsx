import { type InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface NumberBoxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'maxLength'> {
  /** The number value (100-999) */
  value: number | null
  /** Called when value changes */
  onChange: (value: number | null) => void
  /** Index label, e.g. "第一灵数" */
  label: string
  /** What this number represents, e.g. "下卦" */
  description?: string
  className?: string
}

/**
 * A 3-digit number input for divination.
 * Accepts values 100-999 (inclusive).
 */
export const NumberBox = forwardRef<HTMLInputElement, NumberBoxProps>(function NumberBox(
  { value, onChange, label, description, className, ...rest },
  ref
) {
  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="bg-gradient-to-b from-june-bronze/30 to-june-clay/30 border border-june-bronze rounded-md p-3 w-32">
        <div className="text-xs text-rice/80 text-center font-display mb-1">{label}</div>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={3}
          value={value === null ? '' : String(value)}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 3)
            if (v === '') {
              onChange(null)
              return
            }
            const num = parseInt(v, 10)
            if (num >= 100 && num <= 999) {
              onChange(num)
            } else {
              onChange(null) // Don't accept out-of-range yet
            }
          }}
          placeholder="___"
          className="w-full bg-transparent text-center text-2xl font-display text-rice placeholder:text-rice/30 focus:outline-none"
        />
        {description && (
          <div className="text-[10px] text-rice/60 text-center font-body mt-1">{description}</div>
        )}
      </div>
    </div>
  )
})
