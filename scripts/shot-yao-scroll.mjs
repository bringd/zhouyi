// Take screenshots of the new YaoLineScroll component on hexagram 1 (乾)
// Run: node scripts/shot-yao-scroll.mjs

import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })
await tab.goto('http://localhost:5180/hexagram/1', { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await mkdir('screenshots', { recursive: true })

// Scroll to the 6 yao section
await tab.evaluate(() => {
  const h = document.querySelector('h2')
  if (h) h.scrollIntoView({ behavior: 'instant', block: 'start' })
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/yao-scroll-乾-top.png', fullPage: false })
console.log('saved: screenshots/yao-scroll-乾-top.png')

// Scroll to mid
await tab.evaluate(() => window.scrollBy(0, 700))
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/yao-scroll-乾-mid.png', fullPage: false })
console.log('saved: screenshots/yao-scroll-乾-mid.png')

// Now hexagram 3 (屯 - no deep meaning, only 4 fields filled today)
await tab.goto('http://localhost:5180/hexagram/3', { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await tab.evaluate(() => {
  const h = document.querySelector('h2')
  if (h) h.scrollIntoView({ behavior: 'instant', block: 'start' })
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/yao-scroll-屯-top.png', fullPage: false })
console.log('saved: screenshots/yao-scroll-屯-top.png')

// Hexagram 19 (地泽临 - should show "（爻辞待补）" placeholders)
await tab.goto('http://localhost:5180/hexagram/19', { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await tab.evaluate(() => {
  const h = document.querySelector('h2')
  if (h) h.scrollIntoView({ behavior: 'instant', block: 'start' })
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/yao-scroll-临-placeholder.png', fullPage: false })
console.log('saved: screenshots/yao-scroll-临-placeholder.png')

await browser.close()
