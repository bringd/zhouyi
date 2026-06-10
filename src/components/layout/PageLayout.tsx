import { type ReactNode } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { PageTransition } from '@/components/motion'
import { cn } from '@/utils/cn'

export interface PageLayoutProps {
  children: ReactNode
  /** Optional title for the page (used in document.title and breadcrumbs) */
  title?: string
  className?: string
}

/**
 * Page wrapper with Header, main content, Footer, and page transition.
 * Use at the top of every page component.
 */
export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-rice">
      <Header />
      <main className="flex-1">
        <PageTransition className={cn('max-w-6xl mx-auto p-4 md:p-8', className)}>
          {children}
        </PageTransition>
      </main>
      <Footer />
    </div>
  )
}
