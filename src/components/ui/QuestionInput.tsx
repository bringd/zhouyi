import { type TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export interface QuestionInputProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  /** Maximum character count (default 200) */
  maxLength?: number
  placeholder?: string
  className?: string
}

/**
 * Multi-line text input for the user's divination question.
 * Shows a character counter and enforces max length.
 */
export const QuestionInput = forwardRef<HTMLTextAreaElement, QuestionInputProps>(
  function QuestionInput(
    { value, onChange, maxLength = 200, placeholder = '请输入您想询问的问题（可选）', className, ...rest },
    ref
  ) {
    return (
      <div className={cn('w-full', className)}>
        <label className="block text-sm text-june-bronze font-display mb-2">所问之事</label>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (v.length <= maxLength) onChange(v)
          }}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-3 bg-rice border-2 border-june-bronze rounded-md font-body text-ink placeholder:text-ink-light/40 focus:outline-none focus:border-june-red transition-colors resize-none"
          {...rest}
        />
        <div className="flex justify-end mt-1 text-xs text-june-bronze/70 font-body">
          {value.length} / {maxLength}
        </div>
      </div>
    )
  }
)
