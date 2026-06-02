import { Helmet } from 'react-helmet-async'

export interface SEOProps {
  /** Page title (gets suffixed with site name) */
  title?: string
  /** Page description (max 160 chars recommended) */
  description?: string
  /** Canonical URL (e.g. `https://zhouyi.app/hexagram/1`) */
  url?: string
  /** Open Graph image URL (absolute) */
  image?: string
  /** Page type for og:type */
  type?: 'website' | 'article'
  /** Site name (constant) */
  siteName?: string
  /** Twitter card type */
  twitterCard?: 'summary' | 'summary_large_image'
}

const DEFAULT_SITE_NAME = '易象阁'
const DEFAULT_DESCRIPTION = '以《周易》六十四卦为核心，工笔重彩视觉风格，今日卦境、三数起卦、AI 深度解读。'
const DEFAULT_IMAGE = '/favicon.svg'

/**
 * Page-level SEO component. Drop in any page to set per-page title/description/og.
 *
 * Usage:
 * ```tsx
 * <SEO title="乾为天" description="乾卦详解..." />
 * ```
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  url,
  image = DEFAULT_IMAGE,
  type = 'website',
  siteName = DEFAULT_SITE_NAME,
  twitterCard = 'summary_large_image',
}: SEOProps) {
  const fullTitle = title ? `${title} · ${siteName}` : `${siteName} · 64 卦周易研究`
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {url && <link rel="canonical" href={url} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      {url && <meta property="og:url" content={url} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {image && <meta name="twitter:image" content={image} />}

      {/* Charset / viewport (idempotent but harmless) */}
      <meta charSet="utf-8" />
    </Helmet>
  )
}
