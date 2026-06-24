import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { Button } from '@/components/ui/Button'
import { HexagramCard } from '@/components/hexagram/HexagramCard'
import { SEO } from '@/lib/seo'
import { getHexagramById } from '@/lib/divination'
import { getNickname, isNicknameSet } from '@/lib/nickname'
import {
  listFeed,
  getPost,
  addReply,
  type SharedPost,
  type SharedReply,
  type FeedDetailResponse,
} from '@/lib/feed'

/**
 * Community feed — list + detail view of published divination
 * results. Replaces the old /share page (which encoded the data
 * into a URL hash; that approach was over-engineered and provided
 * no actual value).
 *
 * Layout: a single page that swaps between two views via local
 * state. List view shows newest first; detail view shows one post
 * and its replies, with an inline reply form.
 */
export default function Feed() {
  const [view, setView] = useState<'list' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <PageLayout>
      <SEO title="社区卦册" description="看看其他访客的起卦与感言。" />
      <div className="max-w-3xl mx-auto">
        {view === 'list' ? (
          <FeedList
            onSelect={(id) => {
              setSelectedId(id)
              setView('detail')
            }}
          />
        ) : (
          <FeedDetail
            postId={selectedId!}
            onBack={() => {
              setView('list')
              setSelectedId(null)
            }}
          />
        )}
      </div>
    </PageLayout>
  )
}

// ===================== List view =====================

function FeedList({ onSelect }: { onSelect: (id: string) => void }) {
  const [posts, setPosts] = useState<SharedPost[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listFeed()
      .then((res) => {
        if (!cancelled) setPosts(res.posts)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <>
      <PageTitle title="社 区 卦 册" subtitle="他人之卦 · 他人之感" />

      {error && (
        <div className="p-4 bg-june-red/5 border border-june-red/30 rounded-sm text-june-red text-sm font-body">
          加载失败：{error}
        </div>
      )}

      {!posts && !error && (
        <p className="text-center text-ink-light font-body py-8">载入中…</p>
      )}

      {posts && posts.length === 0 && (
        <div className="p-8 bg-rice-dark border border-june-bronze/30 rounded-md text-center">
          <p className="font-display text-base text-ink tracking-widest mb-2">卦 册 尚 空</p>
          <p className="font-body text-sm text-ink-light leading-relaxed">
            还没有人发布过卦象。<Link to="/divination" className="text-june-red underline">起一卦</Link>，
            然后在结果页点"发布"分享到社区。
          </p>
        </div>
      )}

      {posts && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((p) => (
            <FeedListItem key={p.id} post={p} onClick={() => onSelect(p.id)} />
          ))}
        </div>
      )}
    </>
  )
}

function FeedListItem({ post, onClick }: { post: SharedPost; onClick: () => void }) {
  const main = getHexagramById(post.mainHexagramId)
  const changed = getHexagramById(post.changedHexagramId)
  const authorName = post.authorNickname?.trim() || '访客'
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 bg-rice-dark border-l-[3px] border-june-bronze rounded-sm hover:bg-rice hover:border-june-gold transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-12 text-center">
          <div className="text-[10px] text-june-bronze font-display tracking-widest">
            {main?.shortName ?? '?'}
          </div>
          <div className="text-[10px] text-june-bronze/60 mt-0.5">
            动 {post.movingLine}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display text-base text-ink">
              {main?.name ?? `第 ${post.mainHexagramId} 卦`}
            </span>
            <span className="text-ink-light/60 text-xs">→</span>
            <span className="font-display text-sm text-ink-light">
              {changed?.name ?? `第 ${post.changedHexagramId} 卦`}
            </span>
          </div>
          {post.question && (
            <p className="font-body text-xs text-ink-light italic mb-1 truncate">
              「{post.question}」
            </p>
          )}
          {post.aiSummary && (
            <p className="font-body text-sm text-ink/80 leading-relaxed line-clamp-2 mb-2">
              {post.aiSummary}
            </p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-ink-light/70 font-body">
            <span>—— {authorName}</span>
            <span>·</span>
            <span>{formatDate(post.createdAt)}</span>
            {post.replyCount > 0 && (
              <>
                <span>·</span>
                <span className="text-june-red">{post.replyCount} 感言</span>
              </>
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

// ===================== Detail view =====================

function FeedDetail({ postId, onBack }: { postId: string; onBack: () => void }) {
  const [data, setData] = useState<FeedDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyDraft, setReplyDraft] = useState('')
  const [replyBusy, setReplyBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(() => {
    let cancelled = false
    getPost(postId)
      .then((res) => {
        if (!cancelled) setData(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [postId])

  useEffect(refresh, [refresh])

  const handleReply = async () => {
    if (replyDraft.trim().length === 0) return
    setReplyBusy(true)
    try {
      await addReply(postId, replyDraft.trim())
      setReplyDraft('')
      setToast('感言已发布')
      setTimeout(() => setToast(null), 1500)
      refresh()
    } catch (err) {
      setToast(err instanceof Error ? err.message : '发布失败')
      setTimeout(() => setToast(null), 1800)
    } finally {
      setReplyBusy(false)
    }
  }

  return (
    <>
      <div className="mb-4">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-june-bronze font-display tracking-widest hover:text-june-red"
        >
          ← 返回卦册
        </button>
      </div>

      {error && (
        <div className="p-4 bg-june-red/5 border border-june-red/30 rounded-sm text-june-red text-sm font-body">
          加载失败：{error}
        </div>
      )}

      {!data && !error && <p className="text-center text-ink-light font-body py-8">载入中…</p>}

      {data && (
        <PostDetail post={data.post} replies={data.replies} />
      )}

      {data && (
        <div className="mt-6 p-5 bg-rice-dark border-l-[3px] border-june-red rounded-sm">
          <div className="font-display text-xs text-june-red tracking-[0.3em] mb-2">
            留 感 言
          </div>
          <textarea
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder="说点什么…"
            maxLength={500}
            className="w-full min-h-[70px] p-3 font-body text-sm bg-rice border border-june-bronze/30 rounded-sm resize-y focus:outline-none focus:border-june-red"
          />
          <div className="flex items-center justify-between mt-2">
            <div className="text-[10px] text-ink-light/60 font-body">
              以 <span className="text-june-red font-bold">{getNickname()}</span> 之名发布
              {!isNicknameSet() && (
                <Link to="/settings" className="ml-2 text-june-bronze underline">
                  改名 →
                </Link>
              )}
            </div>
            <Button
              onClick={handleReply}
              disabled={replyDraft.trim().length === 0}
              loading={replyBusy}
              variant="primary"
              size="sm"
            >
              发布感言
            </Button>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  )
}

function PostDetail({
  post,
  replies,
}: {
  post: SharedPost
  replies: SharedReply[]
}) {
  const main = getHexagramById(post.mainHexagramId)
  const changed = getHexagramById(post.changedHexagramId)
  const authorName = post.authorNickname?.trim() || '访客'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* 卦象 + 信息 */}
      <div className="p-5 bg-rice-dark border-l-[3px] border-june-bronze rounded-md shadow-sm">
        <div className="flex items-start gap-4">
          {main && (
            <HexagramCard hexagram={main} size="sm" navigateOnClick={false} showStamp={false} />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl text-ink tracking-wider mb-1">
              {main?.name ?? `第 ${post.mainHexagramId} 卦`}
              {changed && (
                <span className="text-ink-light/60 text-base ml-2">→ {changed.name}</span>
              )}
            </h1>
            {post.question && (
              <p className="font-body text-sm text-ink-light italic mb-2">「{post.question}」</p>
            )}
            <p className="text-xs text-ink-light/70 font-body">
              动爻 · 第 {post.movingLine} 爻 · 来自 {authorName} · {formatDate(post.createdAt)}
            </p>
          </div>
        </div>
        {post.note && (
          <p className="mt-3 pt-3 border-t border-june-bronze/20 font-body text-sm text-ink leading-relaxed">
            {post.note}
          </p>
        )}
      </div>

      {/* AI 简易版 */}
      {post.aiSummary && (
        <div className="p-5 bg-rice-dark border-l-[3px] border-june-gold rounded-sm">
          <div className="font-display text-xs text-june-bronze tracking-[0.3em] mb-2">
            AI 解 读 · 简 易 版
          </div>
          <p className="font-body text-[15px] text-ink leading-[1.9] whitespace-pre-wrap">
            {post.aiSummary}
          </p>
        </div>
      )}

      {/* 感言列表 */}
      <div className="p-5 bg-rice-dark border-l-[3px] border-june-bronze rounded-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display text-xs text-june-bronze tracking-[0.3em]">
            感 言 · {replies.length}
          </div>
        </div>
        {replies.length === 0 ? (
          <p className="text-xs text-ink-light/60 font-body italic">
            尚无感言。下方留一条？
          </p>
        ) : (
          <div className="space-y-3">
            {replies.map((r) => (
              <div key={r.id} className="border-l-2 border-june-bronze/20 pl-3">
                <p className="font-body text-sm text-ink leading-relaxed">{r.content}</p>
                <p className="mt-1 text-[11px] text-ink-light/60 font-body">
                  —— {r.authorNickname?.trim() || '访客'} · {formatDate(r.createdAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ===================== Helpers =====================

function formatDate(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
