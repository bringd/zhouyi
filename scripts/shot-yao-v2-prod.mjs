// Take production screenshots of /hexagram/1 with the new V2 design
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })
await tab.setCacheEnabled(false)
await mkdir('screenshots', { recursive: true })

await tab.goto('http://localhost:5180/hexagram/1?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))

// Scroll to yao section
await tab.evaluate(() => {
  const headings = document.querySelectorAll('h2')
  for (const h of headings) {
    if (h.textContent.includes('六爻')) {
      h.scrollIntoView({ behavior: 'instant', block: 'start' })
      break
    }
  }
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-prod-1-yao-top.png', fullPage: false })
console.log('saved: v2-prod-1-yao-top.png')

await tab.evaluate(() => window.scrollBy(0, 800))
await new Promise((r) => setTimeout(r, 1200))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-prod-1-yao-mid.png', fullPage: false })
console.log('saved: v2-prod-1-yao-mid.png')

// Hex 47 (困 - new data)
await tab.goto('http://localhost:5180/hexagram/47?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await tab.evaluate(() => {
  const headings = document.querySelectorAll('h2')
  for (const h of headings) {
    if (h.textContent.includes('六爻')) {
      h.scrollIntoView({ behavior: 'instant', block: 'start' })
      break
    }
  }
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-prod-47-yao.png', fullPage: false })
console.log('saved: v2-prod-47-yao.png')

// Hex 64 (未济)
await tab.goto('http://localhost:5180/hexagram/64?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await tab.evaluate(() => {
  const headings = document.querySelectorAll('h2')
  for (const h of headings) {
    if (h.textContent.includes('六爻')) {
      h.scrollIntoView({ behavior: 'instant', block: 'start' })
      break
    }
  }
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-prod-64-yao.png', fullPage: false })
console.log('saved: v2-prod-64-yao.png')

await browser.close()
console.log('done')
