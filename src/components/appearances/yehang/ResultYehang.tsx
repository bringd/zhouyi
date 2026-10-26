import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronRight,
  Compass,
  Download,
  Feather,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ResultHexagram } from '@/components/hexagram/ResultHexagram'
import { InterpretationRenderer } from '@/components/sections/InterpretationRenderer'
import '@/styles/appearance/yehang.css'
import type { ResultAppearanceProps } from '@/components/appearances/shared/types'

/**
 * 夜航观象 · 结果页。
 *
 * 只展示 props 里的真实记录与真实状态：
 * - 本卦 / 变卦 / 动爻
 * - AI 解读四态（未解读 / 加载中 / 错误重试 / 已有内容）
 * - 下载卦象卡、发布社区、收藏到云端卦册（含 busy 与已发布/已收藏状态）
 * - 本地 / 云端状态说明
 *
 * 视图自己不取数、不发请求、不写存储、不做命令式导航，
 * 所有动作都回抛给上层的回调。
 */
export function ResultYehang({
  record,
  main,
  changed,
  movingLine,
  timestampText,
  aiText,
  aiStatus,
  aiError,
  hasCache,
  storageWarning,
  isLoading,
  isError,
  hasText,
  toast,
  downloadBusy,
  publishBusy,
  publishedId,
  savedCloudId,
  saveRecordBusy,
  onInterpret,
  onDownload,
  onShare,
  onSaveToRecords,
}: ResultAppearanceProps) {
  const movingYao = main.yaoLines.find((line) => line.position === movingLine)
  const question = record.question?.trim()
    ? record.question
    : '本次未填写具体问题，静观卦象，照见当下。'

  return (
    <div className="yh-page yh-result">
      <nav className="yh-breadcrumb" aria-label="面包屑">
        <Link to="/">首页</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <Link to="/divination">三数起卦</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">卦象已成</span>
      </nav>

      <header className="yh-result__heading">
        <div>
          <span className="yh-overline">A NEW PERSPECTIVE</span>
          <h1>你的坐标，已在星图中点亮。</h1>
          <p className="yh-result__stamp">
            <CalendarDays size={12} aria-hidden="true" />
            <time dateTime={new Date(record.createdAt).toISOString()}>
              {timestampText}
            </time>
            <span aria-hidden="true">·</span>
            <span>{record.type === 'daily' ? '今日卦境' : '三数起卦'}</span>
          </p>
        </div>
        <span className="yh-result__tag">
          <Check size={14} aria-hidden="true" />
          卦象已成
        </span>
      </header>

      <div className="yh-question-banner">
        <span>此刻所问</span>
        <p>{question}</p>
        {record.numbers ? <small>{record.numbers.join(' · ')}</small> : null}
      </div>

      <div className="yh-result__layout">
        <div className="yh-result__main">
          <section className="yh-reading-pair" aria-label="本卦与变卦">
            <ResultHexagram
              hexagram={main}
              label="本卦"
              movingLine={movingLine}
            />
            <ResultHexagram
              hexagram={changed}
              label="变卦"
              movingLine={movingLine}
              isChanged
            />
          </section>

          {movingYao ? (
            <section className="yh-moving" aria-labelledby="yh-moving-title">
              <span className="yh-overline">
                THE TURNING POINT / 第 {movingLine} 爻动
              </span>
              <div className="yh-moving__title">
                <h2 id="yh-moving-title">{movingYao.originalText}</h2>
                <span className="yh-moving__type">
                  {movingYao.type === 'yang' ? '阳爻 · 九' : '阴爻 · 六'}
                </span>
              </div>
              <p>{movingYao.modernMeaning || movingYao.explanation}</p>
            </section>
          ) : null}

          <section
            className="yh-interpretation"
            data-ai-status={aiStatus}
            aria-labelledby="yh-interpretation-title"
          >
            <div className="yh-interpretation__head">
              <div>
                <span className="yh-overline">
                  <Sparkles size={14} aria-hidden="true" />
                  ANOTHER PERSPECTIVE
                </span>
                <h2 id="yh-interpretation-title">把卦象，读回生活。</h2>
                <p className="yh-interpretation__lede">
                  先读懂卦象的提醒，再回到你真正关心的问题。
                </p>
              </div>
              {hasCache && !isLoading ? (
                <span className="yh-interpretation__badge">
                  <Check size={12} aria-hidden="true" />
                  已保存的解读
                </span>
              ) : null}
            </div>

            {/* 状态一：未解读 */}
            {!hasText && !isLoading && !isError ? (
              <div className="yh-interpretation__state">
                <h3>从卦象中，读一份此刻的启示。</h3>
                <p>
                  结合本卦、动爻与变卦，回应你的所问之事。解读由 AI
                  生成，只在你主动请求时发起。
                </p>
                <p className="yh-interpretation__action">
                  <Button
                    onClick={onInterpret}
                    size="sm"
                    className="yh-interpret-button"
                    leftIcon={<Sparkles size={14} aria-hidden="true" />}
                  >
                    卦象详解
                  </Button>
                </p>
              </div>
            ) : null}

            {/* 状态二：加载中 */}
            {isLoading ? (
              <div
                className="yh-interpretation__state yh-interpretation__state--loading"
                role="status"
                aria-live="polite"
              >
                <h3>
                  {hasText
                    ? '解读仍在继续，请稍候…'
                    : '正在循着卦象，整理此刻的启示…'}
                </h3>
                <p>内容会随生成过程逐段出现，无需离开本页。</p>
              </div>
            ) : null}

            {/* 状态三：错误与重试 */}
            {isError ? (
              <div
                className="yh-interpretation__state yh-interpretation__state--error"
                role="alert"
              >
                <h3>本次解读未能完成。</h3>
                <p>{aiError || '解读请求没有完成，请稍后再试。'}</p>
                <p className="yh-interpretation__action">
                  <Button
                    onClick={onInterpret}
                    size="sm"
                    className="yh-interpret-button"
                    leftIcon={<RotateCcw size={13} aria-hidden="true" />}
                  >
                    重试
                  </Button>
                </p>
              </div>
            ) : null}

            {/* 状态四：已有内容（流式累积或缓存） */}
            {hasText ? (
              <div className="yh-interpretation__content" aria-busy={isLoading}>
                <InterpretationRenderer text={aiText ?? ''} />
              </div>
            ) : null}

            {storageWarning && <p role="alert">{storageWarning}</p>}
            {hasCache ? (
              <p className="yh-interpretation__saved">
                <Check size={12} aria-hidden="true" />
                解读已随本次卦象保存在本地，可在卦册中回看。
              </p>
            ) : null}
          </section>

          <p className="yh-reflection-note">
            本结果用于周易文化研究与自我反思，不作为现实决策的唯一依据。
          </p>
        </div>

        <aside className="yh-result__sidebar" aria-label="记录与阅读工具">
          <Compass size={27} strokeWidth={1.3} aria-hidden="true" />
          <span className="yh-overline">TAKE IT WITH YOU</span>
          <h2>
            让今天的领悟，
            <br />
            成为明天的线索。
          </h2>
          <p>答案的意义，不止于当下。给自己一点时间，看看变化如何发生。</p>

          <span className="yh-local-status">
            <Check size={12} aria-hidden="true" />
            {savedCloudId ? '本地与云端已存' : '本地已存'}
          </span>

          <div className="yh-actions">
            {savedCloudId ? (
              <Button
                disabled
                className="yh-action-button"
                leftIcon={<Check size={16} aria-hidden="true" />}
              >
                已收藏到云端卦册
              </Button>
            ) : (
              <Button
                onClick={onSaveToRecords}
                loading={saveRecordBusy}
                className="yh-action-button"
                leftIcon={
                  <Bookmark size={16} strokeWidth={1.5} aria-hidden="true" />
                }
              >
                收藏到云端卦册
              </Button>
            )}
            <Button
              onClick={onDownload}
              disabled={downloadBusy}
              className="yh-action-button"
              leftIcon={
                <Download size={16} strokeWidth={1.5} aria-hidden="true" />
              }
            >
              {downloadBusy ? '下载中…' : '下载卦象卡'}
            </Button>
            {publishedId ? (
              <Link to="/feed" className="yh-published-link">
                <Check size={16} aria-hidden="true" />
                已发布 · 查看社区
                <ArrowUpRight size={13} aria-hidden="true" />
              </Link>
            ) : (
              <Button
                onClick={onShare}
                loading={publishBusy}
                className="yh-action-button"
                leftIcon={
                  <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
                }
              >
                发布到社区
              </Button>
            )}
          </div>

          <p className="yh-share-note">
            发布后，问题、卦象与解读摘要将出现在社区卦册。
          </p>

          <Link to="/divination" className="yh-restart">
            <RotateCcw size={15} aria-hidden="true" />
            换一个问题，重新起卦
          </Link>
          <Link to="/records" className="yh-restart">
            <Feather size={15} aria-hidden="true" />
            查看我的卦册
          </Link>

          <div className="yh-seal" aria-hidden="true">
            易
            <span>
              一卦一境
              <br />
              一念一新
            </span>
          </div>
        </aside>
      </div>

      {toast ? (
        <div className="yh-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  )
}
