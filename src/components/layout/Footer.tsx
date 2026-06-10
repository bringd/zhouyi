import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="bg-rice-dark border-t border-june-bronze/30 py-6 mt-12">
      <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-ink-light font-body">
        <div>© 2026 易象阁 · 周易文化研究</div>
        <div className="flex items-center gap-4">
          <Link to="/academy" className="hover:text-june-red">易学书院</Link>
          <Link to="/records" className="hover:text-june-red">我的卦册</Link>
          <a href="https://github.com" target="_blank" rel="noopener" className="hover:text-june-red">关于</a>
        </div>
      </div>
    </footer>
  )
}
