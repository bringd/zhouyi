import { Link } from 'react-router-dom'

/** 全站页脚。外观由 `src/styles/studio.css` 的 `.site-footer__*` 负责。 */
export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <p className="site-footer__copyright">© 2026 易象阁 · 周易文化研究</p>
        <nav className="site-footer__nav" aria-label="页脚导航">
          <Link to="/codex" className="site-footer__link">
            易学书院
          </Link>
          <Link to="/records" className="site-footer__link">
            我的卦册
          </Link>
          <Link to="/settings" className="site-footer__link">
            偏好设置
          </Link>
        </nav>
      </div>
    </footer>
  )
}
