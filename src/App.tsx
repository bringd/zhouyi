import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Lazy-load pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Codex = lazy(() => import('@/pages/Codex'))
const HexagramDetail = lazy(() => import('@/pages/HexagramDetail'))
const Divination = lazy(() => import('@/pages/Divination'))
const Result = lazy(() => import('@/pages/Result'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Records = lazy(() => import('@/pages/Records'))
const Settings = lazy(() => import('@/pages/Settings'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-rice">
      <div className="text-june-bronze font-display text-xl tracking-widest">载入中…</div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/codex" element={<Codex />} />
          <Route path="/hexagram/:id" element={<HexagramDetail />} />
          <Route path="/divination" element={<Divination />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/records" element={<Records />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
