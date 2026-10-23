import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getAppearance, saveAppearance } from '@/lib/storage'
import {
  DEFAULT_APPEARANCE,
  APPEARANCE_PAGE_BG,
  normalizeAppearance,
  type AppearanceId,
} from '@/lib/appearance'

/**
 * 外观上下文。
 *
 * 外观是「展示变化」而不是「重新进入页面」：
 * - 真正的皮肤切换靠根节点上的 `data-appearance` 属性 + CSS 令牌层完成，
 *   不给页面加 key、不刷新、不重新导航，因此页面里的业务状态与进行中的
 *   请求都不会因为切换而中断。
 * - 这里只提供「当前外观 + 切换动作 + 持久化状态」，具体布局由各页面
 *   按 appearance 选择对应视图组件。
 */

/** 根节点上的属性名（CSS 令牌层与预绘制脚本都依赖它） */
export const APPEARANCE_ATTRIBUTE = 'data-appearance'

export interface AppearanceContextValue {
  /** 当前外观 */
  appearance: AppearanceId
  /** 立即切换外观（无需刷新、无需保存） */
  setAppearance: (appearance: AppearanceId) => void
  /** 偏好是否已成功写入本地存储；false 表示只能本次会话有效 */
  persisted: boolean
  /** 存储不可用时的非阻塞说明 */
  notice: string | null
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

/**
 * 没有 Provider 时的兜底（例如单元测试里单独渲染某个组件）。
 * 应用入口一定有 Provider，这里只是保证「缺 Provider 不会让整页崩掉」。
 */
const FALLBACK_CONTEXT: AppearanceContextValue = {
  appearance: DEFAULT_APPEARANCE,
  setAppearance: () => {},
  persisted: false,
  notice: null,
}

/** 把外观写到根节点（<html data-appearance="…">） */
function applyAppearance(appearance: AppearanceId) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute(APPEARANCE_ATTRIBUTE, appearance)
  // 预绘脚本给 <html> 留了一个内联底色（避免首帧闪色），这里同步更新，
  // 否则切换外观后 <html> 的底色还停在旧值。
  document.documentElement.style.backgroundColor = APPEARANCE_PAGE_BG[appearance]
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<AppearanceId>(() => {
    if (typeof window === 'undefined') return DEFAULT_APPEARANCE
    try {
      return getAppearance()
    } catch {
      return DEFAULT_APPEARANCE
    }
  })
  const [persisted, setPersisted] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  // 根节点属性：挂载即同步，保证 CSS 令牌层与 React 状态一致
  useEffect(() => {
    applyAppearance(appearance)
  }, [appearance])

  // 其它标签页改了偏好时跟随（同一浏览器多开窗口）
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'zhouyi:settings') return
      try {
        setAppearanceState(getAppearance())
      } catch {
        /* 存储读失败时保持当前外观 */
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setAppearance = useCallback((next: AppearanceId) => {
    const normalized = normalizeAppearance(next)
    setAppearanceState(normalized)
    applyAppearance(normalized)
    let ok = false
    try {
      ok = saveAppearance(normalized)
    } catch {
      ok = false
    }
    if (ok) {
      setPersisted(true)
      setNotice(null)
    } else {
      // 存储不可用（隐私模式 / 配额满）：仍可本次会话切换，只是记不住
      setPersisted(false)
      setNotice('浏览器存储不可用，外观选择只在本次会话中生效。')
    }
  }, [])

  const value = useMemo<AppearanceContextValue>(
    () => ({ appearance, setAppearance, persisted, notice }),
    [appearance, setAppearance, persisted, notice]
  )

  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}

/** 读取当前外观。应用入口有 AppearanceProvider 时使用它提供的状态。 */
export function useAppearance(): AppearanceContextValue {
  const context = useContext(AppearanceContext)
  return context ?? FALLBACK_CONTEXT
}
