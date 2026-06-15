import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Share from '@/pages/Share'
import { encodeSharePayload, buildShareUrl } from '@/lib/share'
import type { SharePayload } from '@/lib/share'

// imageGen uses the browser's Image + canvas APIs. Stub them so JSDOM
// can complete the download path without throwing.
beforeEach(() => {
  // Mock URL.createObjectURL / revokeObjectURL
  ;(URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = vi.fn(
    () => 'blob:mock'
  )
  ;(URL as unknown as { revokeObjectURL: (s: string) => void }).revokeObjectURL = vi.fn()

  // Mock Image to immediately fire onload
  const OrigImage = window.Image
  class FakeImage extends OrigImage {
    constructor() {
      super()
      setTimeout(() => this.onload?.(new Event('load')), 0)
    }
  }
  window.Image = FakeImage as unknown as typeof Image

  // Mock canvas.toBlob
  HTMLCanvasElement.prototype.toBlob = function (
    cb: (b: Blob | null) => void
  ) {
    cb(new Blob(['mock-png'], { type: 'image/png' }))
  }
  // The prototype's `getContext` is overloaded across 2d/bitmaprenderer/
  // webgl/etc., so a narrow stub doesn't satisfy the union. Cast
  // through `any` to install a minimal 2d-context stub for the
  // download path.
  ;(HTMLCanvasElement.prototype as unknown as { getContext: () => unknown }).getContext =
    function () {
      return {
        drawImage: vi.fn(),
        fillStyle: '',
        fillRect: vi.fn(),
      }
    }
})

const wrap = (initial: string) => (
  <HelmetProvider>
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/share" element={<Share />} />
        <Route path="/share/:id" element={<Share />} />
      </Routes>
    </MemoryRouter>
  </HelmetProvider>
)

const sample: SharePayload = {
  v: 1,
  m: 1, // 乾为天
  c: 2, // 坤为地
  l: 3,
  q: '近期是否适合换工作？',
  a: '乾卦纯阳之象，象征刚健中正。当前你处于事业上升期，行动力强。',
  n: '把握当下，不负此卦。',
  t: 1_700_000_000_000,
}

describe('Share page', () => {
  it('renders the fallback when fragment is missing', () => {
    render(wrap('/share'))
    expect(screen.getByText('链接无效')).toBeInTheDocument()
    expect(screen.getByText('回到首页')).toBeInTheDocument()
  })

  it('renders the fallback when fragment d= is garbage', () => {
    render(wrap('/share#d=garbage!!!'))
    expect(screen.getByText('链接无效')).toBeInTheDocument()
  })

  it('renders the share card when fragment d= is valid', () => {
    const url = '/share#d=' + encodeSharePayload(sample)
    render(wrap(url))
    // Hero: 乾为天 appears in both the page logo and the hero h1.
    expect(screen.getAllByText('乾为天').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/第 1 卦/).length).toBeGreaterThan(0)
    // Moving line + changed
    expect(screen.getByText(/第 3 爻/)).toBeInTheDocument()
    expect(screen.getByText('坤为地')).toBeInTheDocument()
    // AI summary (truncated substring)
    expect(screen.getByText(/乾卦纯阳之象/)).toBeInTheDocument()
    // 感言
    expect(screen.getByText(/把握当下/)).toBeInTheDocument()
  })

  it('hides AI / 感言 sections when not in payload', () => {
    const minimal: SharePayload = { v: 1, m: 1, c: 2, l: 1, a: '', t: 1 }
    render(wrap('/share#d=' + encodeSharePayload(minimal)))
    expect(screen.getAllByText('乾为天').length).toBeGreaterThan(0)
    expect(screen.queryByText(/AI 解 读/)).not.toBeInTheDocument()
    expect(screen.queryByText(/感 言/)).not.toBeInTheDocument()
  })

  it('renders the timestamp from createdAt', () => {
    const { container } = render(wrap('/share#d=' + encodeSharePayload(sample)))
    // 1_700_000_000_000 = 2023-11-14 22:13:20 UTC. The displayed local
    // string depends on the host TZ (JSDOM is +08:00 in this project,
    // so this becomes 2023-11-15 06:13). We assert the year + month
    // to be timezone-agnostic.
    const text = container.textContent ?? ''
    expect(text).toMatch(/2023-11/)
  })

  it('renders the action buttons', () => {
    render(wrap('/share#d=' + encodeSharePayload(sample)))
    expect(screen.getByRole('button', { name: /保存为图片/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /复制分享链接/ })).toBeInTheDocument()
    expect(screen.getByText('查看完整卦象')).toBeInTheDocument()
    expect(screen.getByText('易象阁首页')).toBeInTheDocument()
  })

  it('"复制分享链接" copies the URL to clipboard', async () => {
    // Stub clipboard.writeText
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const fragment = encodeSharePayload(sample)
    render(wrap('/share#d=' + fragment))

    fireEvent.click(screen.getByRole('button', { name: /复制分享链接/ }))

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1)
    })
    const url = writeText.mock.calls[0][0] as string
    // URL should be a full absolute URL with the share fragment
    expect(url).toMatch(/^https?:\/\/[^/]+\/share#d=/)
    expect(url).toContain(fragment)
  })

  it('"保存为图片" triggers PNG download (no throw)', async () => {
    const createElementSpy = vi.spyOn(document, 'createElement')

    render(wrap('/share#d=' + encodeSharePayload(sample)))
    fireEvent.click(screen.getByRole('button', { name: /保存为图片/ }))

    // Wait for the SVG → Image → canvas → blob → download chain.
    await waitFor(
      () => {
        const anchors = createElementSpy.mock.results
          .map((r) => r.value)
          .filter((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement)
        expect(anchors.length).toBeGreaterThan(0)
        // Find the anchor that has a download attribute
        const downloadAnchor = anchors.find((a) => a.download)
        expect(downloadAnchor).toBeDefined()
        expect(downloadAnchor!.download).toMatch(/乾为天/)
        expect(downloadAnchor!.download).toMatch(/\.png$/)
      },
      { timeout: 3000 }
    )
  })

  it('renders the "link to /hexagram/:id" button', () => {
    render(wrap('/share#d=' + encodeSharePayload(sample)))
    const link = screen.getByText('查看完整卦象').closest('a')
    expect(link?.getAttribute('href')).toBe('/hexagram/1')
  })
})

describe('Share URL builder', () => {
  it('produces a URL whose fragment round-trips', () => {
    const url = buildShareUrl(sample, 'https://example.com')
    expect(url.startsWith('https://example.com/share#d=')).toBe(true)
  })
})
