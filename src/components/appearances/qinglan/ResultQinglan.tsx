import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Download,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import { InterpretationRenderer } from '@/components/sections/InterpretationRenderer'
import { Button } from '@/components/ui/Button'
import { hexagramLineStates, hexagramLineTypes } from '@/lib/hexagramLines'
import type { ResultAppearanceProps } from '@/components/appearances/shared/types'
import '@/styles/appearance/qinglan-result.css'

/**
 * 青岚书院 · 起卦结果视图。
 *
 * 版式对应设计稿 `direction === "a"` 的结果页（浅纸底、左右分区）：
 *
 *   1. 面包屑 + 眉题 + 「万象流转，自有回响。」标题 + 「卦象已成」徽标；
 *   2. 「此刻所问」横幅：真实问题 + 本次起卦的三个灵数；
 *   3. 主栏：本卦/变卦对读卡（真实卦象图 + 卦名水印 + 卦辞 + 原文链接）、
 *      动爻（真实爻辞与今释）、把卦象读回生活（真实 AI 解读的四种状态）；
 *   4. 边栏：「TAKE IT WITH YOU」+ 真实操作（收藏、发布、下载、重新起卦）。
 *
 * 记录、AI 流式内容、保存/发布/下载状态与全部副作用都留在页面容器
 * （ResultDisplay）里；这里只把状态画出来，点击时回调给上层。不取数、
 * 不发请求、不写存储，也不渲染任何示例解读或演示交互。
 */

export function ResultQinglan({
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
  aiSummarySource,
  onInterpret,
  onDownload,
  onShare,
  onSaveToRecords,
}: ResultAppearanceProps) {
  const navigate = useNavigate()
  const movingYao = main.yaoLines.find((line) => line.position === movingLine)
  const question = record.question?.trim()
    ? record.question
    : '本次未填写具体问题，静观卦象，照见当下。'
  const numbers = record.numbers
  const canRequest = aiStatus === 'idle' && !hasCache && !hasText
  const readingType = record.type === 'daily' ? '今日卦境' : '三数起卦'

  return (
    <div className="ql-result">
      <div className="ql-result__wrap">
        <nav className="ql-result__breadcrumb" aria-label="面包屑">
          <Link to="/divination">三数起卦</Link>
          <ChevronRight size={12} aria-hidden="true" />
          <span aria-current="page">卦象已成</span>
        </nav>

        <header className="ql-result__heading">
          <div className="ql-result__heading-copy">
            <span className="ql-result__overline">A NEW PERSPECTIVE</span>
            <h1>万象流转，自有回响。</h1>
          </div>
          <span className="ql-result__tag">
            <Check size={14} aria-hidden="true" />
            <span>卦 象 已 成</span>
          </span>
        </header>

        <section className="ql-result__banner" aria-labelledby="ql-question-label">
          <span className="ql-result__banner-label" id="ql-question-label">
            此刻所问
          </span>
          <p className="ql-result__banner-question">{question}</p>
          {numbers && (
            <small className="ql-result__banner-numbers">
              {numbers.join(' · ')}
            </small>
          )}
        </section>

        <div className="ql-result__layout">
          <div className="ql-result__main">
            <section className="ql-result__pair" aria-label="本卦与变卦">
              {[
                {
                  hexagram: main,
                  label: '本卦',
                  overline: 'THE PRESENT',
                  isChanged: false,
                },
                {
                  hexagram: changed,
                  label: '变卦',
                  overline: 'THE POSSIBILITY',
                  isChanged: true,
                },
              ].map(({ hexagram, label, overline, isChanged }) => (
                <article
                  key={label}
                  className={
                    'ql-result-card' +
                    (isChanged ? ' ql-result-card--changed' : '')
                  }
                >
                  <div className="ql-result-card__top">
                    <span>{label}</span>
                    <span>NO. {String(hexagram.number).padStart(2, '0')}</span>
                  </div>
                  <div className="ql-result-card__art">
                    <span
                      className="ql-result-card__watermark"
                      aria-hidden="true"
                    >
                      {hexagram.shortName}
                    </span>
                    <YaoLineStack
                      className="ql-result__glyph"
                      lines={hexagramLineTypes(hexagram)}
                      states={hexagramLineStates(
                        hexagram,
                        isChanged ? { movingLine, changed: true } : {}
                      )}
                      highlightLine={isChanged ? undefined : movingLine}
                      width={74}
                      thickness={6}
                      lineGap={9}
                      label={`${hexagram.name}卦象图，第 ${movingLine} 爻${
                        isChanged ? '已变' : '为动爻'
                      }`}
                    />
                  </div>
                  <span className="ql-result__overline">{overline}</span>
                  <h2>{hexagram.name}</h2>
                  <p className="ql-result-card__judgement">
                    {hexagram.judgement}
                  </p>
                  <Link
                    className="ql-result-card__link"
                    to={`/hexagram/${hexagram.id}`}
                    aria-label={`读卦辞原文：${hexagram.name}`}
                  >
                    读卦辞原文
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              ))}
              <span className="ql-result__pair-arrow" aria-hidden="true">
                <ArrowRight size={19} strokeWidth={1.6} />
              </span>
            </section>

            {movingYao && (
              <section
                className="ql-result__moving"
                aria-labelledby="ql-moving-title"
              >
                <span className="ql-result__overline" id="ql-moving-title">
                  THE TURNING POINT / 第 {movingLine} 爻动
                </span>
                <blockquote className="ql-result__moving-quote">
                  {movingYao.originalText}
                </blockquote>
                <p className="ql-result__moving-meaning">
                  {movingYao.modernMeaning || movingYao.explanation}
                </p>
              </section>
            )}

            <section
              className="ql-result__interpretation"
              aria-labelledby="ql-interpretation-title"
            >
              <div className="ql-result__interpretation-head">
                <div>
                  <span className="ql-result__overline">
                    <Sparkles size={14} aria-hidden="true" />
                    ANOTHER PERSPECTIVE
                  </span>
                  <h2 id="ql-interpretation-title">把卦象，读回生活。</h2>
                </div>
                {canRequest && (
                  <Button
                    size="md"
                    className="ql-result__ai-button"
                    onClick={onInterpret}
                    leftIcon={<Sparkles size={15} aria-hidden="true" />}
                  >
                    卦象详解
                  </Button>
                )}
                {isLoading && (
                  <Button
                    size="md"
                    className="ql-result__ai-button"
                    loading
                    disabled
                  >
                    解读中…
                  </Button>
                )}
                {isError && (
                  <Button
                    size="md"
                    className="ql-result__ai-button"
                    onClick={onInterpret}
                    leftIcon={<RotateCcw size={14} aria-hidden="true" />}
                  >
                    重试
                  </Button>
                )}
                {hasCache && !isLoading && (
                  <span className="ql-result__cache">
                    <Check size={12} aria-hidden="true" />
                    已保存的解读
                  </span>
                )}
              </div>

              <p className="ql-result__lead">
                先读懂卦象的提醒，再回到你真正关心的问题。解读由 AI
                依据本卦、动爻与变卦生成。
              </p>

              {!hasText && !isLoading && !isError && (
                <div className="ql-result__ai-intro">
                  <b>从卦象中，读一份此刻的启示。</b>
                  <p>
                    点击「卦象详解」，获取针对此次起卦的解读；内容会随本次卦象保存在本地，可在卦册中回看。
                  </p>
                </div>
              )}

              {isLoading && (
                <p
                  className="ql-result__ai-status"
                  role="status"
                  aria-live="polite"
                >
                  {hasText
                    ? '解读仍在继续，请稍候…'
                    : '正在循着卦象，整理此刻的启示…'}
                </p>
              )}

              {isError && aiError && (
                <div className="ql-result__ai-error" role="alert">
                  <b>本次解读未能完成</b>
                  <p>{aiError}</p>
                </div>
              )}

              {hasText && (
                <div className="ql-result__ai-content" aria-busy={isLoading}>
                  <InterpretationRenderer text={aiText ?? ''} />
                </div>
              )}

              {storageWarning && <p role="alert">{storageWarning}</p>}
              {hasCache && (
                <p className="ql-result__ai-note">
                  <Check size={12} aria-hidden="true" />
                  解读已随本次卦象保存在本地，可在卦册中回看。
                </p>
              )}
            </section>
          </div>

          <aside className="ql-result__sidebar" aria-label="记录与阅读工具">
            <Compass
              className="ql-result__compass"
              size={27}
              strokeWidth={1.3}
              aria-hidden="true"
            />
            <span className="ql-result__overline">TAKE IT WITH YOU</span>
            <h2>
              让今天的领悟，
              <br />
              成为明天的线索。
            </h2>
            <p className="ql-result__sidebar-lead">
              答案的意义，不止于当下。给自己一点时间，看看变化如何发生。
            </p>

            <p className="ql-result__status">
              <Check size={12} aria-hidden="true" />
              {savedCloudId ? '本地与云端已存' : '本地已存'}
            </p>

            <div className="ql-result__actions">
              {savedCloudId ? (
                <Button
                  size="md"
                  disabled
                  className="ql-result__action"
                  leftIcon={<Check size={16} aria-hidden="true" />}
                >
                  已收藏
                </Button>
              ) : (
                <Button
                  size="md"
                  onClick={onSaveToRecords}
                  loading={saveRecordBusy}
                  className="ql-result__action"
                  leftIcon={
                    <Bookmark size={16} strokeWidth={1.5} aria-hidden="true" />
                  }
                >
                  收藏到卦册
                </Button>
              )}
              {publishedId ? (
                <Link className="ql-result__published" to="/feed">
                  <Check size={16} aria-hidden="true" />
                  已发布 · 查看
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <Button
                  size="md"
                  variant="secondary"
                  onClick={onShare}
                  loading={publishBusy}
                  className="ql-result__action"
                  leftIcon={
                    <Share2 size={16} strokeWidth={1.5} aria-hidden="true" />
                  }
                >
                  发布到社区
                </Button>
              )}
              <Button
                size="md"
                variant="secondary"
                onClick={onDownload}
                disabled={downloadBusy}
                className="ql-result__action"
                leftIcon={
                  <Download size={16} strokeWidth={1.5} aria-hidden="true" />
                }
                title="下载卦象卡 (PNG)"
              >
                {downloadBusy ? '下载中…' : '下载卦象卡'}
              </Button>
            </div>

            <p className="ql-result__share-note">
              {aiSummarySource
                ? '发布后，问题、卦象与已生成的解读摘要会出现在社区卦册；请先确认所问之事适合公开。'
                : '发布后，问题与卦象会出现在社区卦册。本次还没有解读摘要，发布前请确认所问之事适合公开。'}
            </p>

            <div className="ql-result__restart">
              <Button
                size="md"
                variant="ghost"
                className="ql-result__restart-button"
                onClick={() => navigate('/divination')}
                leftIcon={<RotateCcw size={13} aria-hidden="true" />}
              >
                再起一卦
              </Button>
              <span className="ql-result__restart-caption">
                换一个问题，重新起卦
              </span>
            </div>

            <div className="ql-result__links">
              <Link to="/records">
                查看我的卦册
                <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
              <Link to="/">
                返回首页
                <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            </div>

            <p className="ql-result__meta">
              {readingType} · 起卦于 {timestampText}
            </p>

            <div className="ql-result__seal" aria-hidden="true">
              易
              <span>
                一卦一境
                <br />
                一念一新
              </span>
            </div>
          </aside>
        </div>
      </div>

      {toast && (
        <div className="ql-result__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
