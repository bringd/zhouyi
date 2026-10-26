import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronRight,
  Download,
  RotateCcw,
  Share2,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { YaoLineStack } from '@/components/hexagram/YaoLineStack'
import { InterpretationRenderer } from '@/components/sections/InterpretationRenderer'
import { Button } from '@/components/ui/Button'
import type { ResultAppearanceProps } from '@/components/appearances/shared/types'
import { hexagramLineStates, hexagramLineTypes } from '@/lib/hexagramLines'
import { ZhushaOverline } from './parts'
import '@/styles/appearance/zhusha.css'

/**
 * 朱砂档案 · 结果页。
 *
 * 版式对应设计稿 `.dg-theme-b` 的结果页：整页一个外框，左栏是书页（所问之事、
 * 本卦/变卦并排两栏、动爻、卦象详解），右栏是边栏（朱砂顶边的印版位置改成
 * 竖排边栏 + 印章），中间一条墨线分栏。
 *
 * 内容全部来自 props：真实记录、真实卦象、真实 AI 状态。
 * 本组件不取数、不发请求、不写存储、不做跳转（只提供链接）。
 */

/** 社区发布预览：把解读里的 Markdown 标记去掉，只留可读正文 */
function plainSummary(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\*\*/g, '')
    .trim()
}

export function ResultZhusha({
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
  const movingYao = main.yaoLines.find((line) => line.position === movingLine)
  const question = record.question?.trim()
    ? record.question
    : '本次未填写具体问题，静观卦象，照见当下。'
  const numbers = record.numbers
  const canRequest = aiStatus === 'idle' && !hasCache && !hasText

  return (
    <div className="zh-page zh-result">
      <div className="zh-container">
        <nav className="zh-breadcrumb" aria-label="面包屑">
          <Link to="/">首页</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <Link to="/divination">三数起卦</Link>
          <ChevronRight size={13} aria-hidden="true" />
          <span aria-current="page">卦象已成</span>
        </nav>

        <header className="zh-result__heading">
          <div>
            <ZhushaOverline>A NEW PERSPECTIVE</ZhushaOverline>
            <h1>这一页，写给此刻的你。</h1>
          </div>
          <span className="zh-result__tag">
            <Check size={14} aria-hidden="true" />
            卦象已成
          </span>
        </header>

        <section className="zh-banner" aria-label="所问之事">
          <span className="zh-banner__label">此刻所问</span>
          <p className="zh-banner__question">{question}</p>
          {numbers && (
            <small className="zh-banner__numbers">{numbers.join(' · ')}</small>
          )}
        </section>

        <div className="zh-result__layout">
          <div className="zh-result__main">
            <section className="zh-pair" aria-label="本卦与变卦">
              <article className="zh-pair__card">
                <div className="zh-pair__top">
                  <span>本卦</span>
                  <span>NO. {String(main.number).padStart(2, '0')}</span>
                </div>
                <div className="zh-pair__art">
                  <span className="zh-pair__watermark" aria-hidden="true">
                    {main.shortName}
                  </span>
                  <YaoLineStack
                    lines={hexagramLineTypes(main)}
                    highlightLine={movingLine}
                    width={74}
                    thickness={6}
                    lineGap={9}
                    label={`${main.name}卦象图，第 ${movingLine} 爻为动爻`}
                  />
                </div>
                <ZhushaOverline>THE PRESENT</ZhushaOverline>
                <h3>{main.name}</h3>
                <p>{main.judgement}</p>
                <Link className="zh-pair__link" to={`/hexagram/${main.id}`}>
                  读卦辞原文
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </article>

              <article className="zh-pair__card zh-pair__card--changed">
                <div className="zh-pair__top">
                  <span>变卦</span>
                  <span>NO. {String(changed.number).padStart(2, '0')}</span>
                </div>
                <div className="zh-pair__art">
                  <span className="zh-pair__watermark" aria-hidden="true">
                    {changed.shortName}
                  </span>
                  <YaoLineStack
                    lines={hexagramLineTypes(changed)}
                    states={hexagramLineStates(changed, {
                      movingLine,
                      changed: true,
                    })}
                    width={74}
                    thickness={6}
                    lineGap={9}
                    label={`${changed.name}卦象图，第 ${movingLine} 爻已变`}
                  />
                </div>
                <ZhushaOverline>THE POSSIBILITY</ZhushaOverline>
                <h3>{changed.name}</h3>
                <p>{changed.judgement}</p>
                <Link className="zh-pair__link" to={`/hexagram/${changed.id}`}>
                  读卦辞原文
                  <ArrowUpRight size={15} aria-hidden="true" />
                </Link>
              </article>
            </section>

            {movingYao && (
              <section className="zh-moving" aria-labelledby="zh-moving-title">
                <ZhushaOverline>
                  THE TURNING POINT / 第 {movingLine} 爻动
                </ZhushaOverline>
                <h3 id="zh-moving-title">{movingYao.originalText}</h3>
                <p>{movingYao.modernMeaning || movingYao.explanation}</p>
              </section>
            )}

            <section className="zh-ai" aria-labelledby="zh-ai-title">
              <div className="zh-ai__head">
                <div>
                  <ZhushaOverline icon={<Sparkles size={15} aria-hidden="true" />}>
                    ANOTHER PERSPECTIVE
                  </ZhushaOverline>
                  <h2 id="zh-ai-title">把卦象，读回生活。</h2>
                </div>
                {canRequest && (
                  <Button
                    size="sm"
                    className="zh-ai__action"
                    onClick={onInterpret}
                    leftIcon={<Sparkles size={14} aria-hidden="true" />}
                  >
                    请求解读
                  </Button>
                )}
                {isLoading && (
                  <Button size="sm" className="zh-ai__action" loading disabled>
                    解读中…
                  </Button>
                )}
                {isError && (
                  <Button
                    size="sm"
                    className="zh-ai__action"
                    onClick={onInterpret}
                    leftIcon={<RotateCcw size={13} aria-hidden="true" />}
                  >
                    重试
                  </Button>
                )}
                {hasCache && !isLoading && (
                  <span className="zh-ai__cache">
                    <Check size={12} aria-hidden="true" />
                    已保存的解读
                  </span>
                )}
              </div>

              <p className="zh-ai__intro">
                先读懂卦象的提醒，再回到你真正关心的问题。解读由 AI 依据本卦、动爻与变卦生成。
              </p>

              {!hasText && !isLoading && !isError && (
                <div className="zh-ai__box">
                  <b>从卦象中，读一份此刻的启示。</b>
                  <p>点击「请求解读」获取针对此次起卦的解读，内容会随本次卦象一并保存。</p>
                </div>
              )}

              {isLoading && (
                <div className="zh-ai__box" role="status" aria-live="polite">
                  {hasText
                    ? '解读仍在继续，请稍候…'
                    : '正在循着卦象，整理此刻的启示…'}
                </div>
              )}

              {isError && aiError && (
                <div className="zh-ai__box zh-ai__box--error" role="alert">
                  <b>本次解读未能完成</b>
                  <p>{aiError}</p>
                </div>
              )}

              {hasText && (
                <div className="zh-ai__content" aria-busy={isLoading}>
                  <InterpretationRenderer text={aiText ?? ''} />
                </div>
              )}

              {storageWarning && <p role="alert">{storageWarning}</p>}
              {hasCache && (
                <p className="zh-ai__cache">
                  <Check size={12} aria-hidden="true" />
                  解读已随本次卦象保存在本地，可在卦册中回看。
                </p>
              )}
            </section>
          </div>

          <aside className="zh-sidebar" aria-label="记录与阅读工具">
            <ZhushaOverline>TAKE IT WITH YOU</ZhushaOverline>
            <h2>
              让今天的领悟，
              <br />
              成为明天的线索。
            </h2>
            <p>答案的意义，不止于当下。给自己一点时间，看看变化如何发生。</p>

            <p className="zh-status-line">
              <Check size={12} aria-hidden="true" />
              {savedCloudId ? '本地与云端已存' : '本地已存'}
            </p>

            <div className="zh-actions">
              {savedCloudId ? (
                <Button
                  disabled
                  leftIcon={<Check size={16} aria-hidden="true" />}
                >
                  已收藏
                </Button>
              ) : (
                <Button
                  onClick={onSaveToRecords}
                  loading={saveRecordBusy}
                  leftIcon={<Bookmark size={16} aria-hidden="true" />}
                >
                  收藏到云端卦册
                </Button>
              )}
              <Button
                onClick={onDownload}
                variant="secondary"
                disabled={downloadBusy}
                leftIcon={<Download size={16} aria-hidden="true" />}
                title="下载卦象卡 (PNG)"
              >
                {downloadBusy ? '下载中…' : '下载卦象卡'}
              </Button>
              {publishedId ? (
                <Link className="zh-published" to="/feed">
                  <Check size={16} aria-hidden="true" />
                  已发布 · 查看
                  <ArrowUpRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <Button
                  onClick={onShare}
                  variant="secondary"
                  loading={publishBusy}
                  leftIcon={<Share2 size={16} aria-hidden="true" />}
                >
                  发布到社区
                </Button>
              )}
            </div>

            <p className="zh-share-note">
              发布后，问题、卦象与解读摘要将出现在社区卦册，请先确认问题适合公开。
            </p>

            <div className="zh-preview">
              <span>将发布的摘要</span>
              <p>
                {aiSummarySource
                  ? plainSummary(aiSummarySource)
                  : '本次未生成解读摘要，发布时只会带上问题与卦象。'}
              </p>
            </div>

            <div className="zh-restart">
              <Link className="zh-text-action" to="/divination">
                <RotateCcw size={13} aria-hidden="true" />
                再起一卦
              </Link>
              <Link to="/records">
                查看我的卦册
                <ArrowUpRight size={12} aria-hidden="true" />
              </Link>
            </div>

            <p className="zh-status-line">起卦于 {timestampText}</p>

            <div className="zh-seal" aria-hidden="true">
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
        <div className="zh-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}
