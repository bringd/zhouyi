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
import { QuestionInput } from '@/components/ui/QuestionInput'
import { QUESTION_POOL } from '@/lib/sampleQuestions'
import '@/styles/appearance/qinglan-cast.css'

/**
 * 青岚书院 · 三数起卦。
 *
 * 版式对应 A 提案的起卦页（`src/pages/DesignGallery.tsx` 的 direction=a / screen=cast）：
 * 左栏是「把心事放下，让答案浮现」的引导 + 拱形山水 + 三枚步骤，
 * 右栏是表单（标题区 / 问事 / 取数 / 状态 / 启卦）。
 *
 * 真实业务能力全部在稳定层（`DivinationForm`）持有，这里只负责画与回调：
 * - 问题文本、三个灵数的原始文本与取数滚动状态都不在视图里；
 * - 校验、起卦、存档与跳转统一走 props.onSubmit；
 * - 本组件不取数、不请求、不写存储。
 *
 * 提案里那枚一次摇三个数的演示按钮不实现：
 * 三个灵数各自带「天降灵数 / 停止」，走的是正式取数逻辑。
 */

/** 三个灵数：位次、字段名与含义（与正式起卦算法一致） */
const NUMBER_FIELDS = [
  {
    position: 0 as NumberPosition,
    label: '第一灵数',
    description: '下卦 · 内在',
  },
  {
    position: 1 as NumberPosition,
    label: '第二灵数',
    description: '上卦 · 外在',
  },
  {
    position: 2 as NumberPosition,
    label: '第三灵数',
    description: '动爻 · 变化',
  },
]

/**
 * 示例问题：取自站点自己的预置问询池（`src/lib/sampleQuestions.ts`），
 * 不是演示用的假数据——点一下就把这条真实问句填进输入框，之后仍可继续编辑。
 */
const QUESTION_CHIPS = [
  { label: '事业方向', index: 1 },
  { label: '关系相处', index: 2 },
  { label: '自我成长', index: 5 },
]

/** 取预置问询池里的第 n 条；取不到时退回当前输入框的示例问题 */
function sampleQuestion(index: number, fallback: string): string {
  const text = QUESTION_POOL[index]
  return text && text.trim().length > 0 ? text : fallback
}

export function CastQinglan({
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
    <div className="ql-cast">
      <nav className="ql-cast__breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">三数起卦</span>
      </nav>

      <div className="ql-cast__layout">
        <aside className="ql-cast__intro">
          <span className="ql-cast__overline">A MOMENT FOR YOURSELF</span>
          <h1>
            把心事放下，
            <br />
            让答案<em>浮现。</em>
          </h1>
          <p>
            先留一刻空白。想一件真正关心的事，让三个随心而来的数字，为思考打开另一扇门。
          </p>

          <div className="ql-cast__scene" aria-hidden="true">
            <img
              src="/images/home-landscape.svg"
              alt=""
              width="1000"
              height="660"
            />
            <span className="ql-cast__poem">
              山静日长
              <br />
              万物有时
            </span>
          </div>

          <div className="ql-cast__caption">
            <span>01 静心</span>
            <span>02 问事</span>
            <span>03 取数</span>
          </div>
        </aside>

        <CastFormShell
          onSubmit={onSubmit}
          className="ql-cast__form"
          label="三数起卦"
        >
          <div className="ql-cast__form-title">
            <span className="ql-cast__overline">THREE NUMBERS, ONE INSIGHT</span>
            <h2>三 数 起 卦</h2>
            <p>问于心，发于数，止于卦</p>
          </div>

          <div className="ql-cast__field">
            <div className="ql-cast__field-title">
              <span>
                <b>01</b> 此刻，你想问什么？
              </span>
              <small>选填</small>
            </div>
            <QuestionInput
              id={questionId}
              value={question}
              onChange={onQuestionChange}
              placeholder={questionPlaceholder}
              className="ql-cast__question"
              aria-describedby={`${questionId}-note`}
            />
            <div className="ql-cast__chips">
              {QUESTION_CHIPS.map((chip) => {
                const text = sampleQuestion(chip.index, questionPlaceholder)
                return (
                  <button
                    type="button"
                    key={chip.label}
                    aria-pressed={question === text}
                    aria-controls={questionId}
                    onClick={() => onQuestionChange(text)}
                  >
                    {chip.label}
                    <Plus size={11} aria-hidden="true" />
                  </button>
                )
              })}
            </div>
            <p id={`${questionId}-note`} className="ql-cast__note">
              问题可以留白，届时将采用输入框中的示例问题。
            </p>
          </div>

          <div className="ql-cast__field">
            <div className="ql-cast__field-title">
              <span>
                <b>02</b> 随心，定下三个数字
              </span>
              <small>100—999</small>
            </div>
            <div className="ql-cast__numbers">
              {NUMBER_FIELDS.map((field) => {
                const rolling =
                  numberFields[field.position].randomState.kind === 'rolling'
                return (
                  <div
                    className="ql-cast__number"
                    key={field.position}
                    data-rolling={rolling ? 'true' : 'false'}
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
                    <span className="ql-cast__number-hint">
                      {rolling ? '取数中…' : '可手动输入'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="ql-cast__error" role="alert">
              {error}
            </p>
          )}

          <div className="ql-cast__submit-row">
            <div
              id={statusId}
              className="ql-cast__status"
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
              className="ql-cast__submit"
              rightIcon={<ArrowRight size={18} aria-hidden="true" />}
            >
              启 卦
            </Button>
          </div>

          <p className="ql-cast__disclaimer">
            本结果用于周易文化研究与自我反思，不作为现实决策的唯一依据。
          </p>
        </CastFormShell>
      </div>
    </div>
  )
}
