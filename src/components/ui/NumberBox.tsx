import { type InputHTMLAttributes, forwardRef, useEffect, useState } from 'react'
import { cn } from '@/utils/cn'

export interface NumberBoxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type' | 'maxLength'> {
  /** The number value (100-999). null = empty. */
  value: number | null
  /** Called with the parsed number, or null when input is empty/invalid */
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
 *
 * Internal state holds the raw user-typed string so the user can see partial
 * input. The parent only receives a parsed number (or null) once input is
 * complete. This fixes a bug where typing digit-by-digit would clear the
 * input on each keystroke because the parent's null state would override
 * the visible value.
 */
export const NumberBox = forwardRef<HTMLInputElement, NumberBoxProps>(function NumberBox(
  { value, onChange, label, description, className, ...rest },
  ref
) {
  const [text, setText] = useState(value === null ? '' : String(value))

  // Sync local text when parent resets the value (e.g., form reset)
  useEffect(() => {
    setText(value === null ? '' : String(value))
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 3)
    setText(next)
    if (next === '') {
      onChange(null)
      return
    }
    const num = parseInt(next, 10)
    // Only emit a number when the value is fully entered and in range.
    // Partial input (1-2 digits) keeps parent state unchanged, so the
    // user's typing stays visible locally without falsely enabling the form.
    if (num >= 100 && num <= 999) {
      onChange(num)
    } else {
      onChange(null)
    }
  }

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="bg-gradient-to-b from-june-bronze/40 to-june-clay/40 border border-june-bronze rounded-md p-3 w-32 shadow-inner">
        <div className="text-[11px] text-rice text-center font-display tracking-widest mb-1.5">{label}</div>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          maxLength={3}
          value={text}
          onChange={handleChange}
          placeholder="···"
          className={cn(
            'w-full bg-rice-dark/60 text-center text-3xl font-display font-semibold tracking-widest',
            'text-ink placeholder:text-ink-light/30 caret-june-red',
            'rounded-sm py-0.5',
            'focus:outline-none focus:bg-rice focus:shadow-[inset_0_0_0_2px_rgba(155,44,44,0.55),0_0_8px_rgba(200,158,58,0.35)]',
            'focus:placeholder:text-ink-light/15',
            'transition-[background-color,box-shadow] duration-200'
          )}
          {...rest}
        />
        {description && (
          <div className="text-[10px] text-rice/85 text-center font-body tracking-wider mt-1.5">{description}</div>
        )}
      </div>
    </div>
  )
})
