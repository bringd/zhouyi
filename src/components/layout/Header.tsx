import { Link, useLocation } from 'react-router-dom'
import { Seal } from '@/components/ui/Seal'
import { AppearanceSwitcher } from '@/components/layout/AppearanceSwitcher'
import { cn } from '@/utils/cn'

const NAV_ITEMS = [
  { path: '/', label: '今日卦境' },
  { path: '/codex', label: '64 卦图鉴' },
  { path: '/divination', label: '三数起卦' },
  { path: '/feed', label: '社区卦册' },
  { path: '/records', label: '我的卦册' },
] as const

export interface HeaderProps {
  className?: string
}

function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

/**
 * 全站顶栏。
 *
 * 外观完全由 `src/styles/studio.css` 的 `.site-header__*` 负责——这里只输出
 * 语义 class，不依赖 DOM 层级选择器，也不把可访问名（aria-label）当样式钩子。
 * 当前激活项用 `aria-current="page"` 表达，CSS 只对这一个状态做样式。
 */
export function Header({ className }: HeaderProps) {
  const location = useLocation()
  // 读卦结果页属于「三数起卦」流程，导航高亮回到起卦入口
  const activePath = location.pathname.startsWith('/result/')
    ? '/divination'
    : location.pathname

  const isActive = (path: string) =>
    activePath === path || (path !== '/' && activePath.startsWith(path))

  return (
    <header className={cn('site-header', className)}>
      <div className="site-header__inner">
        <Link to="/" className="site-header__brand" aria-label="易象阁 首页">
          <Seal text="易象" size={36} />
          <span className="site-header__titles">
            <span className="site-header__wordmark">易象阁</span>
            <span className="site-header__tagline">YI · XIANG · GE</span>
          </span>
        </Link>

        <nav className="site-header__nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={isActive(item.path) ? 'page' : undefined}
              className="site-header__nav-link"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 外观快捷入口：与设置页共用同一状态，点击即生效 */}
        <AppearanceSwitcher className="site-header__appearance" />

        {/* 桌面端设置入口；移动端在同一条栏位里另有一个（见下） */}
        <Link to="/settings" className="site-header__settings" aria-label="设置">
          <SettingsIcon />
        </Link>
        <Link
          to="/settings"
          className="site-header__settings site-header__settings--mobile"
          aria-label="设置"
        >
          <SettingsIcon />
        </Link>
      </div>

      {/* 移动端导航栏（窄屏固定在顶栏下方，5 项平分） */}
      <nav className="site-header__mobile-nav" aria-label="移动端主导航">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive(item.path) ? 'page' : undefined}
            className="site-header__mobile-link"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}
