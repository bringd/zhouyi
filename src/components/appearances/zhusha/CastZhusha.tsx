import { useId } from 'react'
import { ArrowRight, Check, ChevronRight, Plus, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CastFormShell } from '@/components/appearances/shared/CastFormShell'
import type {
  CastAppearanceProps,
  NumberPosition,
} from '@/components/appearances/shared/types'
import { Button } from '@/components/ui/Button'
import { NumberBoxWithRandomizer } from '@/components/ui/NumberBoxRandomizer'
import { QUESTION_POOL } from '@/lib/sampleQuestions'
import { ZhushaOverline, ZhushaPlate } from './parts'
import '@/styles/appearance/zhusha.css'

/** 三个灵数：位置、字段名与含义（与正式起卦算法一致） */
const NUMBER_FIELDS = [
  { position: 0 as NumberPosition, label: '第一灵数', description: '下卦' },
  { position: 1 as NumberPosition, label: '第二灵数', description: '上卦' },
  { position: 2 as NumberPosition, label: '第三灵数', description: '动爻' },
]

/**
 * 示例问题：取自站点自己的预置问询池（`src/lib/sampleQuestions.ts`），
 * 不是演示用的假数据——点一下就把这条真实问句填进输入框。
 */
const SAMPLE_CHIPS = [
  { label: '事业', index: 1 },
  { label: '关系', index: 2 },
  { label: '成长', index: 5 },
]

/** 取预置问询池里的第 n 条；取不到时退回当前输入框的示例问题 */
function sampleQuestion(index: number, fallback: string): string {
  const text = QUESTION_POOL[index]
  return text && text.trim().length > 0 ? text : fallback
}

/**
 * 朱砂档案 · 三数起卦。
 *
 * 版式对应设计稿 `.dg-theme-b` 的起卦页：整页一个外框，左栏是「有问，便有新的开始」
 * 的引导 + 一块小印版，右栏是表单（书页），两栏之间一条墨线。
 *
 * 表单外壳用共用组件 `CastFormShell`（入场动画与 reduced-motion 已在其中处理），
 * 提交只调用 props.onSubmit——校验、存档与跳转都在上层统一处理。
 */
export function CastZhusha({
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
    <div className="zh-page zh-cast">
      <div className="zh-container">
        <nav className="zh-breadcrumb" aria-label="面包屑">
          <Link to="/">首页</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span aria-current="page">三数起卦</span>
        </nav>

        <div className="zh-cast__layout">
          <aside className="zh-cast__intro">
            <ZhushaOverline>A MOMENT FOR YOURSELF</ZhushaOverline>
            <h1>
              有问，
              <br />
              便有<em>新的开始。</em>
            </h1>
            <p>
              先留一刻空白。想一件真正关心的事，让三个随心而来的数字，为思考打开另一扇门。
            </p>
            <ZhushaPlate variant="compact" />
            <div className="zh-cast__caption">
              <span>01 静心</span>
              <span>02 问事</span>
              <span>03 取数</span>
            </div>
          </aside>

          <CastFormShell
            onSubmit={onSubmit}
            className="zh-cast__form"
            label="三数起卦"
          >
            <div className="zh-form__title">
              <ZhushaOverline>THREE NUMBERS, ONE INSIGHT</ZhushaOverline>
              <h2>三数起卦</h2>
              <p>问于心，发于数。</p>
            </div>

            <div className="zh-field__title">
              <label htmlFor={questionId}>
                <span>01</span>
                此刻，你想问什么？
              </label>
              <small>选填</small>
            </div>
            <textarea
              id={questionId}
              className="zh-textarea"
              value={question}
              maxLength={200}
              rows={3}
              placeholder={questionPlaceholder}
              onChange={(event) => onQuestionChange(event.target.value)}
            />
            <div className="zh-question__helpers">
              <div>
                {SAMPLE_CHIPS.map((chip) => {
                  const text = sampleQuestion(chip.index, questionPlaceholder)
                  return (
                    <button
                      type="button"
                      key={chip.label}
                      aria-pressed={question === text}
                      onClick={() => onQuestionChange(text)}
                    >
                      {chip.label}
                      <Plus size={11} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
              <span>{question.length}/200</span>
            </div>

            <div className="zh-field__title">
              <span>
                <b>02</b>
                随心，定下三个数字
              </span>
              <small>100—999</small>
            </div>
            <div className="zh-numbers">
              {NUMBER_FIELDS.map((field) => (
                <div
                  className="zh-number"
                  key={field.position}
                  data-rolling={
                    numberFields[field.position].randomState.kind === 'rolling'
                      ? 'true'
                      : 'false'
                  }
                >
                  <NumberBoxWithRandomizer
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
                  <span className="zh-number__hint">
                    {numberFields[field.position].randomState.kind === 'rolling'
                      ? '取数中…'
                      : '可手动输入'}
                  </span>
                </div>
              ))}
            </div>

            {error && (
              <p className="zh-form__error" role="alert">
                {error}
              </p>
            )}

            <div className="zh-form__submit">
              <div
                id={statusId}
                className="zh-status"
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
                  <b>{statusText}</b>
                  <small>已选定 {selectedCount} / 3 个灵数</small>
                </div>
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={!isValid}
                aria-describedby={statusId}
                className="zh-submit"
                rightIcon={<ArrowRight size={18} aria-hidden="true" />}
              >
                启 卦
              </Button>
            </div>

            <p className="zh-form__note">
              本结果用于周易文化研究与自我反思，不作为现实决策的唯一依据。
            </p>
          </CastFormShell>
        </div>
      </div>
    </div>
  )
}
