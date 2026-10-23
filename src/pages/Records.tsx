import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/Button'
import { EmptyScroll } from '@/components/ui/EmptyScroll'
import { SEO } from '@/lib/seo'
import { cn } from '@/utils/cn'
import { getAllRecords, updateRecordNote, deleteRecord } from '@/lib/storage'
import {
  listCloudRecords,
  updateCloudRecordNote,
  deleteCloudRecord,
} from '@/lib/records'
import type { CloudRecord, RecordSource } from '@/lib/records'
import { mergeRecords } from '@/lib/recordMerger'
import type { RecordListItem } from '@/lib/recordMerger'
import { getHexagramById } from '@/lib/divination'
import type { HexagramId, UserRecord } from '@/types'

/**
 * 我的卦册 — the divination history page.
 *
 * Two data sources are shown side by side:
 *   - 云端卦册: `GET /api/records` (Worker + D1, guest session)
 *   - 本地卦册: `localStorage` via `src/lib/storage.ts`
 *
 * They are concatenated (newest first) rather than de-duplicated —
 * the two id spaces are unrelated, so edit/delete are routed by
 * `item.source`. A failed cloud fetch never breaks the page: the local
 * half still renders, with a banner explaining the degradation.
 *
 * Deliberately NOT covered here (backlog): auto-save on the result
 * page, `favorite_hexagrams`, and daily-hexagram records. The explicit
 * "收藏到卦册" action lives on the result page.
 */
export default function Records() {
  const [localRecords, setLocalRecords] = useState<UserRecord[]>(() =>
    getAllRecords(),
  )
  const [cloudRecords, setCloudRecords] = useState<CloudRecord[]>([])
  const [cloudState, setCloudState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  )
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [selected, setSelected] = useState<{
    source: RecordSource
    id: string
  } | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 1800)
  }

  useEffect(() => {
    let cancelled = false
    listCloudRecords()
      .then((rows) => {
        if (cancelled) return
        setCloudRecords(rows)
        setCloudState('ready')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setCloudError(err instanceof Error ? err.message : '云端卦册暂时无法加载')
        setCloudState('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const items = useMemo(
    () => mergeRecords(localRecords, cloudRecords),
    [localRecords, cloudRecords],
  )

  const activeItem = selected
    ? (items.find(
        (item) => item.source === selected.source && item.id === selected.id,
      ) ?? null)
    : null

  const refreshLocal = () => setLocalRecords(getAllRecords())

  const handleSaveNote = async (item: RecordListItem, note: string) => {
    if (item.source === 'local') {
      if (!updateRecordNote(item.id, note)) {
        throw new Error('本地备注保存失败')
      }
      refreshLocal()
      return
    }
    const updated = await updateCloudRecordNote(item.id, note)
    setCloudRecords((prev) =>
      prev.map((record) => (record.id === updated.id ? updated : record)),
    )
  }

  const handleDelete = async (item: RecordListItem) => {
    if (item.source === 'local') {
      if (!deleteRecord(item.id)) {
        throw new Error('本地记录删除失败')
      }
      refreshLocal()
    } else {
      await deleteCloudRecord(item.id)
      setCloudRecords((prev) => prev.filter((record) => record.id !== item.id))
    }
    setSelected(null)
  }

  const cloudItems = items.filter((item) => item.source === 'cloud')
  const localItems = items.filter((item) => item.source === 'local')

  return (
    <PageLayout>
      <SEO title="我的卦册" description="查看云端与本地的历史起卦记录。" />
      <PageTitle title="我的卦册" subtitle="云端 · 本地" />

      <div className="max-w-3xl mx-auto">
        {activeItem ? (
          <RecordDetail
            item={activeItem}
            onBack={() => setSelected(null)}
            onSaveNote={handleSaveNote}
            onDelete={handleDelete}
            showToast={showToast}
          />
        ) : (
          <>
            {cloudState === 'error' && (
              <div
                role="alert"
                className="mb-4 p-4 bg-june-red/5 border border-june-red/30 rounded-sm text-june-red text-sm font-body"
              >
                云端卦册加载失败：{cloudError}
                <span className="block mt-1 text-[12px] text-ink-light/70">
                  本地卦册不受影响，仍可在下方查看。
                </span>
              </div>
            )}

            {cloudState === 'loading' && items.length === 0 && (
              <p className="text-center text-ink-light font-body py-8">载入中…</p>
            )}

            {cloudState !== 'loading' && items.length === 0 && (
              <EmptyScroll
                message="卦册尚无记录。"
                hint="在「三数起卦」问一卦，结果页点「收藏到卦册」即可收录于此。"
                cta={{ to: '/divination', label: '前往起卦' }}
              />
            )}

            {items.length > 0 && (
              <div className="space-y-8">
                <RecordSection
                  title="云 端 卦 册"
                  hint="随会话保存在云端"
                  items={cloudItems}
                  emptyText={
                    cloudState === 'error'
                      ? '云端暂不可用'
                      : '尚无云端记录 — 可在结果页点「收藏到卦册」'
                  }
                  onSelect={setSelected}
                />
                <RecordSection
                  title="本 地 卦 册"
                  hint="仅存于此浏览器，不上传服务器"
                  items={localItems}
                  emptyText="本浏览器尚无历史记录"
                  onSelect={setSelected}
                />
              </div>
            )}

            {items.length > 0 && (
              <div className="text-center mt-10">
                <Link
                  to="/divination"
                  className="text-xs text-june-bronze font-display tracking-widest hover:text-june-red min-h-6 inline-flex items-center justify-center"
                >
                  再起一卦 →
                </Link>
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
          {toast}
        </div>
      )}
    </PageLayout>
  )
}

// ===================== List =====================

function RecordSection({
  title,
  hint,
  items,
  emptyText,
  onSelect,
}: {
  title: string
  hint: string
  items: RecordListItem[]
  emptyText: string
  onSelect: (value: { source: RecordSource; id: string }) => void
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display text-base text-ink tracking-[0.3em]">
          {title}
        </h2>
        <span className="text-[12px] text-june-bronze font-body">
          {items.length} 条
        </span>
      </div>
      <p className="text-[12px] text-ink-light/70 font-body mb-3">{hint}</p>

      {items.length === 0 ? (
        <p className="p-4 bg-rice-dark border border-dashed border-june-bronze/30 rounded-sm text-xs text-ink-light/70 font-body">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <RecordRow
              key={`${item.source}:${item.id}`}
              item={item}
              onClick={() => onSelect({ source: item.source, id: item.id })}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function RecordRow({
  item,
  onClick,
}: {
  item: RecordListItem
  onClick: () => void
}) {
  const main = hexagramById(item.mainHexagramId)
  const changed = hexagramById(item.changedHexagramId)

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 bg-rice-dark border-l-[3px] border-june-bronze rounded-sm hover:bg-rice hover:border-june-gold transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 text-center">
          <div className="text-[12px] text-june-bronze font-display tracking-widest">
            {main?.shortName ?? '卦'}
          </div>
          <div className="text-[12px] text-june-bronze/60 mt-0.5">
            动 {item.movingLine}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-base text-ink">
              {main?.name ?? `第 ${item.mainHexagramId} 卦`}
            </span>
            <span className="text-ink-light/60 text-xs">→</span>
            <span className="font-display text-sm text-ink-light">
              {changed?.name ?? `第 ${item.changedHexagramId} 卦`}
            </span>
          </div>
          {item.question && (
            <p className="font-body text-xs text-ink-light italic mb-1 truncate">
              「{item.question}」
            </p>
          )}
          {item.userNote && (
            <p className="font-body text-sm text-ink/80 leading-relaxed line-clamp-2 mb-2">
              {item.userNote}
            </p>
          )}
          <div className="flex items-center gap-2 text-[12px] text-ink-light/70 font-body">
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-sm',
                item.source === 'cloud'
                  ? 'bg-june-gold/20 text-june-bronze'
                  : 'bg-june-bronze/10 text-june-bronze',
              )}
            >
              {item.source === 'cloud' ? '云端' : '本地'}
            </span>
            <span>{formatDate(item.createdAt)}</span>
            {item.hasAiInterpretation && (
              <>
                <span>·</span>
                <span>含 AI 解读</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ===================== Detail =====================

function RecordDetail({
  item,
  onBack,
  onSaveNote,
  onDelete,
  showToast,
}: {
  item: RecordListItem
  onBack: () => void
  onSaveNote: (item: RecordListItem, note: string) => Promise<void>
  onDelete: (item: RecordListItem) => Promise<void>
  showToast: (message: string) => void
}) {
  const [noteDraft, setNoteDraft] = useState(item.userNote ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const main = hexagramById(item.mainHexagramId)
  const changed = hexagramById(item.changedHexagramId)
  const aiText = item.raw.aiInterpretation ?? ''

  const handleSaveNote = async () => {
    setBusy(true)
    try {
      await onSaveNote(item, noteDraft.trim())
      showToast('备注已保存')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '备注保存失败')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setBusy(true)
    try {
      await onDelete(item)
      showToast('记录已删除')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '删除失败')
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-june-bronze font-display tracking-widest hover:text-june-red"
        >
          ← 返回卦册
        </button>
        <span
          className={cn(
            'px-2 py-0.5 rounded-sm text-[12px] font-body',
            item.source === 'cloud'
              ? 'bg-june-gold/20 text-june-bronze'
              : 'bg-june-bronze/10 text-june-bronze',
          )}
        >
          {item.source === 'cloud' ? '云端记录' : '本地记录'}
        </span>
      </div>

      <div className="p-5 bg-rice-dark border-l-[3px] border-june-bronze rounded-md">
        <h1 className="font-display text-2xl text-ink tracking-wider mb-1">
          {main?.name ?? `第 ${item.mainHexagramId} 卦`}
          <span className="text-ink-light/60 text-base ml-2">
            → {changed?.name ?? `第 ${item.changedHexagramId} 卦`}
          </span>
        </h1>
        {item.question && (
          <p className="font-body text-sm text-ink-light italic mb-2">
            「{item.question}」
          </p>
        )}
        <p className="text-xs text-ink-light/70 font-body">
          动爻 · 第 {item.movingLine} 爻 · {formatDate(item.createdAt)}
        </p>
        {main && (
          <p className="mt-3 pt-3 border-t border-june-bronze/20 font-body text-sm text-ink leading-relaxed">
            卦辞：{main.judgement}
          </p>
        )}
      </div>

      {aiText.trim() !== '' && (
        <div className="p-5 bg-rice-dark border-l-[3px] border-june-gold rounded-sm">
          <div className="font-display text-xs text-june-bronze tracking-[0.3em] mb-2">
            AI 解 读
          </div>
          <p className="font-body text-[15px] text-ink leading-[1.9] whitespace-pre-wrap">
            {aiText}
          </p>
        </div>
      )}

      <div className="p-5 bg-rice-dark border-l-[3px] border-june-bronze rounded-sm">
        <label
          className="font-display text-xs text-june-bronze tracking-[0.3em] block mb-2"
          htmlFor="record-note"
        >
          我 的 备 注
        </label>
        <textarea
          id="record-note"
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          maxLength={2000}
          placeholder="记下当时的处境与后来的印证…"
          className="w-full min-h-[80px] p-3 font-body text-sm bg-rice border border-june-bronze/30 rounded-sm resize-y focus:outline-none focus:border-june-red"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[12px] text-ink-light/60 font-body">
            {noteDraft.length}/2000
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSaveNote}
            loading={busy}
            disabled={busy}
          >
            保存备注
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant={confirmingDelete ? 'primary' : 'ghost'}
          size="sm"
          onClick={handleDelete}
          disabled={busy}
        >
          {confirmingDelete ? '确认删除？' : '删除记录'}
        </Button>
        {confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-xs text-ink-light font-body hover:text-ink"
          >
            取消
          </button>
        )}
      </div>
    </div>
  )
}

// ===================== Helpers =====================

/** Safe hexagram lookup — cloud rows could theoretically carry a bad id. */
function hexagramById(id: number) {
  try {
    return getHexagramById(id as HexagramId)
  } catch {
    return null
  }
}

function formatDate(ts: number): string {
  if (!ts) return ''
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
