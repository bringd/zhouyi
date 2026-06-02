// scripts/generate-sitemap.mjs
// Run with: node scripts/generate-sitemap.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SITE_URL = process.env.SITE_URL ?? 'https://zhouyi.app'
const TODAY = new Date().toISOString().slice(0, 10)

// Read hexagrams
const hexagrams = JSON.parse(
  readFileSync(join(ROOT, 'src/data/hexagrams.json'), 'utf-8')
)

const urls = [
  { loc: '/', priority: '1.0', changefreq: 'daily' },
  { loc: '/codex', priority: '0.9', changefreq: 'weekly' },
  { loc: '/divination', priority: '0.8', changefreq: 'monthly' },
  { loc: '/records', priority: '0.5', changefreq: 'never' },
  { loc: '/settings', priority: '0.3', changefreq: 'monthly' },
]

// Add each hexagram
for (const h of hexagrams) {
  urls.push({
    loc: `/hexagram/${h.id}`,
    priority: '0.7',
    changefreq: 'monthly',
  })
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE_URL}${u.loc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

const outPath = join(ROOT, 'public/sitemap.xml')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, xml, 'utf-8')
console.log(`✓ sitemap.xml written: ${urls.length} URLs`)
