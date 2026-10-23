import { useId } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  Check,
  ChevronRight,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuestionInput } from '@/components/ui/QuestionInput'
import { NumberBoxWithRandomizer } from '@/components/ui/NumberBoxRandomizer'
import { CastFormShell } from '@/components/appearances/shared/CastFormShell'
import { YehangAtlas } from '@/components/appearances/yehang/YehangAtlas'
import type {
  CastAppearanceProps,
  NumberPosition,
} from '@/components/appearances/shared/types'
import '@/styles/appearance/yehang.css'

const NUMBER_FIELDS = [
  { position: 0, label: '第一灵数', description: '下卦' },
  { position: 1, label: '第二灵数', description: '上卦' },
  { position: 2, label: '第三灵数', description: '动爻' },
] as const satisfies ReadonlyArray<{
  position: NumberPosition
  label: string
  description: string
}>

/**
 * 夜航观象 · 三数起卦。
 *
 * 表单外壳用共用的 `CastFormShell`（入场动效与 prefers-reduced-motion 已处理），
 * 内部只负责展示与回传：所有状态都来自 props，提交只调用 props.onSubmit。
 */
export function CastYehang({
  question,
  onQuestionChange,
  questionPlaceholder,
  numberFields,
  onNumberTextChange,
  onRandomStart,
  onRandomStop,
  error,
  isValid,
  selectedCount,
  isRolling,
  onSubmit,
}: CastAppearanceProps) {
  const questionId = useId()
  const statusId = useId()

  const statusText = isRolling
    ? '灵数流转中，点「停止」定下此数。'
    : isValid
      ? '三数已定，可以启卦。'
      : '随心取数，静待卦成。'

  return (
    <div className="yh-page yh-cast">
      <nav className="yh-breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">三数起卦</span>
      </nav>

      <div className="yh-cast__layout">
        <aside className="yh-cast__intro">
          <span className="yh-overline">A MOMENT FOR YOURSELF</span>
          <h1>
            向内看，
            <br />
            然后<span>向前走。</span>
          </h1>
          <p>
            先留一刻空白。想一件真正关心的事，让三个随心而来的数字，为思考打开另一扇门。
          </p>
          <div className="yh-cast__atlas">
            <YehangAtlas variant="compact" />
          </div>
          <div className="yh-cast__caption">
            <span>01 静心</span>
            <span>02 问事</span>
            <span>03 取数</span>
          </div>
        </aside>

        <CastFormShell
          onSubmit={onSubmit}
          className="yh-form"
          label="三数起卦"
        >
          <div className="yh-form__title">
            <span className="yh-overline">THREE NUMBERS, ONE INSIGHT</span>
            <h2>三数起卦</h2>
            <p>问于心，发于数。</p>
          </div>

          <div className="yh-field">
            <div className="yh-field__title">
              <label htmlFor={questionId}>
                <span className="yh-field__index">01</span>
                此刻，你想问什么？
              </label>
              <small>选填</small>
            </div>
            <QuestionInput
              id={questionId}
              value={question}
              onChange={onQuestionChange}
              placeholder={questionPlaceholder}
              className="yh-question"
              aria-describedby={`${questionId}-note`}
            />
            {questionPlaceholder ? (
              <div className="yh-examples">
                <button
                  type="button"
                  aria-pressed={question === questionPlaceholder}
                  aria-controls={questionId}
                  onClick={() => onQuestionChange(questionPlaceholder)}
                >
                  用示例问题
                  <Plus size={11} aria-hidden="true" />
                </button>
              </div>
            ) : null}
            <p id={`${questionId}-note`} className="yh-form__note">
              问题可以留白，届时将采用输入框中的示例问题。
            </p>
          </div>

          <div className="yh-field">
            <div className="yh-field__title">
              <span className="yh-field__title-label">
                <span className="yh-field__index">02</span>
                随心，定下三个数字
              </span>
              <small>100—999</small>
            </div>
            <div className="yh-numbers">
              {NUMBER_FIELDS.map((field) => (
                <NumberBoxWithRandomizer
                  key={field.position}
                  field={numberFields[field.position]}
                  onTextChange={(text) =>
                    onNumberTextChange(field.position, text)
                  }
                  onStart={() => onRandomStart(field.position)}
                  onStop={() => onRandomStop(field.position)}
                  label={field.label}
                  description={field.description}
                  randomButtonLabel={`随机生成${field.label}`}
                  stopButtonLabel={`停止生成${field.label}`}
                />
              ))}
            </div>
            <p className="yh-form__note">
              {isRolling
                ? '正在滚动取数，点「停止」把这一数定下来。'
                : '不必寻找特别的数字，让此刻的直觉做选择。'}
            </p>
          </div>

          {error ? (
            <p className="yh-form__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="yh-form__footer">
            <div
              id={statusId}
              className={`yh-form__status${isValid ? ' is-ready' : ''}`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {isValid ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              <div>
                <span>{statusText}</span>
                <small>已选定 {selectedCount} / 3 个灵数</small>
              </div>
            </div>
            <Button
              type="submit"
              size="md"
              disabled={!isValid}
              aria-describedby={statusId}
              className="yh-form__submit"
              rightIcon={<ChevronRight size={17} aria-hidden="true" />}
            >
              启 卦
            </Button>
          </div>
        </CastFormShell>
      </div>
    </div>
  )
}
