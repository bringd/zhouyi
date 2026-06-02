import { describe, it, expect } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import { SEO } from '@/lib/seo'

describe('SEO', () => {
  it('renders the site name when no title given', async () => {
    render(<HelmetProvider><SEO /></HelmetProvider>)
    // helmet-async sets title via document.title in jsdom
    await waitFor(() => {
      expect(document.title).toContain('易象阁')
    })
  })

  it('renders the page title when given', async () => {
    render(<HelmetProvider><SEO title="乾为天" /></HelmetProvider>)
    await waitFor(() => {
      expect(document.title).toContain('乾为天')
      expect(document.title).toContain('易象阁')
    })
  })

  it('includes description meta', async () => {
    render(<HelmetProvider><SEO description="自定义描述" /></HelmetProvider>)
    await waitFor(() => {
      const meta = document.querySelector('meta[name="description"]')
      expect(meta?.getAttribute('content')).toBe('自定义描述')
    })
  })

  it('includes canonical URL when given', async () => {
    render(<HelmetProvider><SEO url="https://zhouyi.app/hexagram/1" /></HelmetProvider>)
    await waitFor(() => {
      const link = document.querySelector('link[rel="canonical"]')
      expect(link?.getAttribute('href')).toBe('https://zhouyi.app/hexagram/1')
    })
  })

  it('includes og:title and og:description', async () => {
    render(<HelmetProvider><SEO title="测试" /></HelmetProvider>)
    await waitFor(() => {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content')
      expect(ogTitle).toContain('测试')
      expect(document.querySelector('meta[property="og:description"]')).toBeTruthy()
    })
  })

  it('includes twitter:card meta', async () => {
    render(<HelmetProvider><SEO /></HelmetProvider>)
    await waitFor(() => {
      expect(document.querySelector('meta[name="twitter:card"]')).toBeTruthy()
    })
  })
})
