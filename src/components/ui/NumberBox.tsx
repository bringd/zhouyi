import {
  type InputHTMLAttributes,
  forwardRef,
  useId,
} from 'react'
import { parseNumberText, sanitizeNumberText } from '@/lib/numberText'
import { cn } from '@/utils/cn'

export interface NumberBoxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'onChange' | 'value' | 'type' | 'maxLength'
> {
  /**
   * 原始输入文本（由上层持有）。
   * 允许是 '1'、'12'、'099' 这类还没输完或不合法的中间态。
   */
  text: string
  /** 文本变化回调（上层收到的已经是过滤过的纯数字、最多三位） */
  onTextChange: (text: string) => void
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
 * 输入框是完全受控的：原始文本由上层（稳定层）持有。
 * 之前文本存在组件内部，换外观时整棵输入子树被卸载重建，
 * 未输完的输入（'12'）与取数滚动状态会一起丢失；
 * 现在文本上移，切换外观只是换视图，输入原样还在。
 */
export const NumberBox = forwardRef<HTMLInputElement, NumberBoxProps>(
  function NumberBox(
    { text, onTextChange, label, description, className, id, ...rest },
    ref
  ) {
    const generatedId = useId()
    const inputId = id ?? generatedId
    const value = parseNumberText(text)

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onTextChange(sanitizeNumberText(e.target.value))
    }

    return (
      <div
        className={cn('number-box flex flex-col items-center', className)}
        data-filled={value !== null}
      >
        <div className="number-box-surface">
          <label htmlFor={inputId} className="number-box-label">
            {label}
          </label>
          <input
            id={inputId}
            ref={ref}
            type="text"
            inputMode="numeric"
            maxLength={3}
            value={text}
            onChange={handleChange}
            placeholder="···"
            aria-describedby={
              description ? `${inputId}-description` : undefined
            }
            aria-invalid={text.length === 3 && value === null ? true : undefined}
            className="number-box-input"
            {...rest}
          />
          {description && (
            <div id={`${inputId}-description`} className="number-box-description">
              {description}
            </div>
          )}
        </div>
      </div>
    )
  }
)
