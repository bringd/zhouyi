// Take screenshots of hexagram detail pages with new yao data filled in batches 7-8
// Run: node scripts/shot-yao-final.mjs

import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })

await mkdir('screenshots', { recursive: true })

const hexagrams = [
  { id: 1, name: '乾', desc: '元数据' },
  { id: 47, name: '困', desc: 'batch7' },
  { id: 49, name: '革', desc: 'batch7' },
  { id: 53, name: '渐', desc: 'batch7' },
  { id: 61, name: '中孚', desc: 'batch8' },
  { id: 63, name: '既济', desc: 'batch8' },
  { id: 64, name: '未济', desc: '末卦' },
]

for (const h of hexagrams) {
  await tab.goto(`http://localhost:5180/hexagram/${h.id}`, { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2500))

  // 6 yao section
  await tab.evaluate(() => {
    const headings = document.querySelectorAll('h2')
    for (const h of headings) {
      if (h.textContent.includes('六爻')) {
        h.scrollIntoView({ behavior: 'instant', block: 'start' })
        break
      }
    }
  })
  await new Promise((r) => setTimeout(r, 1200))
  await tab.screenshot({ path: `D:/eight/screenshots/final-${h.id}-${h.name}-top.png`, fullPage: false })
  console.log(`saved: final-${h.id}-${h.name}-top.png  (${h.desc})`)

  // scroll to mid (3rd/4th yao)
  await tab.evaluate(() => window.scrollBy(0, 700))
  await new Promise((r) => setTimeout(r, 1200))
  await tab.screenshot({ path: `D:/eight/screenshots/final-${h.id}-${h.name}-mid.png`, fullPage: false })
  console.log(`saved: final-${h.id}-${h.name}-mid.png`)

  // scroll to deep meaning section
  await tab.evaluate(() => window.scrollBy(0, 1500))
  await new Promise((r) => setTimeout(r, 1200))
  await tab.screenshot({ path: `D:/eight/screenshots/final-${h.id}-${h.name}-bottom.png`, fullPage: false })
  console.log(`saved: final-${h.id}-${h.name}-bottom.png`)
}

await browser.close()
console.log('done')
