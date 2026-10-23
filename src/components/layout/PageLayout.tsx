import { type ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { PageTransition } from '@/components/motion'
import { cn } from '@/utils/cn'
import '@/styles/studio.css'

export interface PageLayoutProps {
  children: ReactNode
  /** Optional title for the page (used in document.title and breadcrumbs) */
  title?: string
  className?: string
  /** Extra class on the page shell — e.g. "studio-page" for the new visual pages. */
  rootClassName?: string
}

/**
 * Page wrapper with Header, main content, Footer, and page transition.
 * Use at the top of every page component.
 *
 * The shell/container styling lives in `src/styles/studio.css`
 * (`.site-shell` / `.site-main__inner`) so the framework has a single owner.
 */
export function PageLayout({
  children,
  className,
  rootClassName,
}: PageLayoutProps) {
  return (
    <div className={cn('site-shell', rootClassName)}>
      <Header />
      <main className="site-main">
        <PageTransition className={cn('site-main__inner', className)}>
          {children}
        </PageTransition>
      </main>
      <Footer />
    </div>
  )
}
