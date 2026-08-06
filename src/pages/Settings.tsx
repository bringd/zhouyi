import { useState } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { PageTitle } from '@/components/ui/PageTitle'
import { SEO } from '@/lib/seo'
import { Button } from '@/components/ui/Button'
import {
  getApiConfig,
  setApiConfig,
  clearApiConfig,
  describeApiKey,
  API_CONFIG_DEFAULTS,
} from '@/lib/apiConfig'
import {
  getNickname,
  isNicknameSet,
  setNickname as saveNickname,
  clearNickname,
  NICKNAME_DEFAULTS,
} from '@/lib/nickname'

export default function Settings() {
  const [stored, setStored] = useState(() => getApiConfig())
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({
    baseUrl: stored.baseUrl,
    apiKey: stored.apiKey,
    model: stored.model,
  })

  const [nickname, setNicknameState] = useState(() => getNickname())
  const [nickEditing, setNickEditing] = useState(false)
  const [nickDraft, setNickDraft] = useState(nickname)

  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1800)
  }

  const isConfigured = stored.apiKey.length > 0

  const handleSave = () => {
    if (draft.apiKey.trim().length === 0) {
      showToast('请填写 API Key')
      return
    }
    if (setApiConfig(draft)) {
      setStored(getApiConfig())
      setEditing(false)
      showToast('已保存')
    } else {
      showToast('保存失败')
    }
  }

  const handleClear = () => {
    if (clearApiConfig()) {
      const fresh = getApiConfig()
      setStored(fresh)
      setDraft({
        baseUrl: fresh.baseUrl,
        apiKey: fresh.apiKey,
        model: fresh.model,
      })
      setEditing(false)
      showToast('已清除 API Key')
    } else {
      showToast('清除失败')
    }
  }

  const handleSaveNickname = () => {
    if (saveNickname(nickDraft)) {
      setNicknameState(getNickname())
      setNickEditing(false)
      showToast('昵称已保存')
    } else {
      showToast('保存失败')
    }
  }

  const handleClearNickname = () => {
    if (clearNickname()) {
      setNicknameState(NICKNAME_DEFAULTS.default)
      setNickDraft(NICKNAME_DEFAULTS.default)
      setNickEditing(false)
      showToast('已恢复默认')
    } else {
      showToast('清除失败')
    }
  }

  const startEdit = () => {
    setDraft({
      baseUrl: stored.baseUrl,
      apiKey: stored.apiKey,
      model: stored.model,
    })
    setEditing(true)
  }

  return (
    <PageLayout>
      <SEO title="设置" description="应用设置。" />
      <PageTitle title="设置" />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* AI 解读 (BYOK) — Phase 1 hidden. Restore by removing {false && …} wrapper. */}
        {false && (
        <section className="p-6 bg-rice border-2 border-june-bronze rounded-md">
          <h2 className="font-display text-lg text-ink tracking-widest mb-1">
            AI 解 读
          </h2>
          <p className="font-body text-sm text-ink-light mb-4 leading-relaxed">
            本站为纯静态部署，卦象详解由浏览器直连{' '}
            <span className="font-mono text-[12px] bg-rice-dark px-1 rounded">Anthropic 兼容端点</span>。
            填入你自己的 Key + 端点 URL + 模型名，存于本机 localStorage，
            不上传任何服务器。
          </p>

          {/* 当前状态 */}
          {!isConfigured && !editing && (
            <div className="mb-4 p-4 bg-june-bronze/10 border border-june-bronze/40 rounded-sm">
              <div className="font-display text-xs text-june-bronze tracking-widest mb-1.5">
                免 费 体 验
              </div>
              <p className="text-[12px] text-ink-light font-body leading-relaxed">
                未配置 API Key — 现在用站内共享免费额度（每日 5 次），无需注册。
                想不限次数,可在下方填入你自己的 API Key（兼容 Anthropic 协议的 key 都行）。
              </p>
            </div>
          )}
          {isConfigured && !editing && (
            <div className="mb-4 p-4 bg-rice-dark border border-june-bronze/40 rounded-sm space-y-2">
              <div>
                <div className="font-display text-xs text-june-bronze tracking-widest mb-0.5">
                  已 配 置
                </div>
                <div className="font-mono text-sm text-ink break-all">
                  {describeApiKey(stored.apiKey)}
                </div>
              </div>
              <div className="text-xs font-mono text-ink-light">
                <div><span className="text-june-bronze">端点</span> · {stored.baseUrl}</div>
                <div><span className="text-june-bronze">模型</span> · {stored.model}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" onClick={startEdit}>
                  编辑
                </Button>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  清除
                </Button>
              </div>
            </div>
          )}

          {/* 编辑 / 首次输入 */}
          {(!isConfigured || editing) && (
            <div className="space-y-4">
              <label className="block">
                <span className="font-display text-xs text-june-bronze tracking-widest">
                  API Base URL
                </span>
                <input
                  type="url"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.baseUrl}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  placeholder={API_CONFIG_DEFAULTS.baseUrl}
                  className="mt-2 w-full px-3 py-2 font-mono text-xs bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red"
                />
                <span className="block mt-1 text-[11px] text-ink-light/70 font-body">
                  Anthropic 兼容端点。用 Anthropic 官方时留空；
                  用 3rd-party（如 MiniMax、自建代理）时填那个端点 URL。
                </span>
              </label>

              <label className="block">
                <span className="font-display text-xs text-june-bronze tracking-widest">
                  Model
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.model}
                  onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                  placeholder={API_CONFIG_DEFAULTS.model}
                  className="mt-2 w-full px-3 py-2 font-mono text-xs bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red"
                />
                <span className="block mt-1 text-[11px] text-ink-light/70 font-body">
                  端点支持的模型名。默认 minimax-m3。
                </span>
              </label>

              <label className="block">
                <span className="font-display text-xs text-june-bronze tracking-widest">
                  Anthropic API Key
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="sk-ant-..."
                  className="mt-2 w-full px-3 py-2 font-mono text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red"
                />
              </label>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={draft.apiKey.trim().length === 0}
                >
                  保存
                </Button>
                {editing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft({
                        baseUrl: stored.baseUrl,
                        apiKey: stored.apiKey,
                        model: stored.model,
                      })
                      setEditing(false)
                    }}
                  >
                    取消
                  </Button>
                )}
              </div>

              <p className="text-xs text-ink-light/70 font-body leading-relaxed">
                还没有 Key？去{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-june-red underline hover:no-underline"
                >
                  Anthropic 控制台
                </a>{' '}
                创建一个（仅需邮箱，绑定支付方式后按用量计费）。
              </p>
            </div>
          )}

          <details className="mt-4">
            <summary className="text-xs text-ink-light/70 font-body cursor-pointer hover:text-ink">
              隐私与安全说明
            </summary>
            <p className="mt-2 text-xs text-ink-light/70 font-body leading-relaxed">
              Key/端点/模型都只存在本浏览器 localStorage。任何加载到
              本网站的 JS 都能读到它们——这与本站其他第三方脚本的可见性
              相同。共享设备或公开场合请使用后清除。Anthropic 官方要求
              加上{' '}
              <code className="px-1 mx-1 bg-rice-dark rounded text-[11px] font-mono">
                anthropic-dangerous-direct-browser-access
              </code>{' '}
              头以启用浏览器 CORS；这意味着你的 Key 对端点来说与
              服务端使用无异。3rd-party 端点可能有自己的 CORS 设置，
              如遇错误请联系端点方。
            </p>
          </details>
        </section>
        )}

        {/* 社区昵称 — 出现在"社区卦册"的发帖和留言上 */}
        <section className="p-6 bg-rice border-2 border-june-bronze rounded-md">
          <h2 className="font-display text-lg text-ink tracking-widest mb-1">
            社 区 昵 称
          </h2>
          <p className="font-body text-sm text-ink-light mb-4 leading-relaxed">
            出现在你在"社区卦册"发布的卦象和感言上。
            留空则显示"访客"。
          </p>

          {!nickEditing && (
            <div className="p-4 bg-rice-dark border border-june-bronze/40 rounded-sm">
              <div className="font-display text-xs text-june-bronze tracking-widest mb-1">
                {isNicknameSet() ? '已 配 置' : '使用默认'}
              </div>
              <div className="font-display text-lg text-ink">{nickname}</div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setNickDraft(nickname)
                    setNickEditing(true)
                  }}
                >
                  {isNicknameSet() ? '改名' : '设置昵称'}
                </Button>
                {isNicknameSet() && (
                  <Button variant="ghost" size="sm" onClick={handleClearNickname}>
                    恢复默认
                  </Button>
                )}
              </div>
            </div>
          )}

          {nickEditing && (
            <div className="space-y-3">
              <label className="block">
                <span className="font-display text-xs text-june-bronze tracking-widest">
                  昵称
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  maxLength={NICKNAME_DEFAULTS.maxLength}
                  value={nickDraft}
                  onChange={(e) => setNickDraft(e.target.value)}
                  placeholder={NICKNAME_DEFAULTS.default}
                  className="mt-2 w-full px-3 py-2 font-body text-sm bg-white border border-june-bronze/40 rounded-sm focus:outline-none focus:border-june-red"
                />
                <span className="block mt-1 text-[11px] text-ink-light/70 font-body">
                  最多 {NICKNAME_DEFAULTS.maxLength} 字。空着 = 显示"{NICKNAME_DEFAULTS.default}"。
                </span>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveNickname}
                  disabled={nickDraft.trim().length === 0}
                >
                  保存
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNickDraft(nickname)
                    setNickEditing(false)
                  }}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 其他设置占位 */}
        <section className="p-6 bg-rice-dark border border-june-bronze/30 rounded-sm text-center">
          <p className="font-body text-sm text-ink-light">
            其他设置项筹备中。
          </p>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-ink text-rice rounded-md font-display text-sm tracking-widest shadow-lg z-50">
          {toast}
        </div>
      )}
    </PageLayout>
  )
}
