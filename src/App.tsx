import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AppearanceProvider } from '@/contexts/AppearanceContext'

// Lazy-load pages for code splitting
const Home = lazy(() => import('@/pages/Home'))
const Codex = lazy(() => import('@/pages/Codex'))
const HexagramDetail = lazy(() => import('@/pages/HexagramDetail'))
const Divination = lazy(() => import('@/pages/Divination'))
const Result = lazy(() => import('@/pages/Result'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Records = lazy(() => import('@/pages/Records'))
const Settings = lazy(() => import('@/pages/Settings'))
const Feed = lazy(() => import('@/pages/Feed'))
const YaoDesignCompare = lazy(() => import('@/pages/YaoDesignCompare'))
const DesignGallery = lazy(() => import('@/pages/DesignGallery'))

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-rice">
      <div className="text-june-bronze font-display text-xl tracking-widest">载入中…</div>
    </div>
  )
}

export default function App() {
  return (
    // reducedMotion="user"：用户开启"减少动态效果"后，全站的位移/缩放动画自动关闭
    <MotionConfig reducedMotion="user">
      {/* 外观上下文：只负责「当前外观 + 切换 + 持久化」，
          真正的皮肤切换靠根节点 data-appearance，不重新挂载页面。 */}
      <AppearanceProvider>
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
              <Route path="/feed" element={<Feed />} />
              <Route path="/yao-design-compare" element={<YaoDesignCompare />} />
              <Route path="/design-preview" element={<DesignGallery />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AppearanceProvider>
    </MotionConfig>
  )
}
