// Take a single fresh screenshot of hex 64 to verify
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

// Force cache bypass
await tab.setCacheEnabled(false)
await tab.goto('http://localhost:5180/hexagram/64?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 3000))

// Inspect the DOM
const yaoCount = await tab.evaluate(() => {
  const cards = document.querySelectorAll('h3, h2, h1, [class*="yao"], article, section')
  return document.body.innerText.length
})
console.log('Page text length:', yaoCount)

// Get the actual yao content visible on the page
const yaoTexts = await tab.evaluate(() => {
  const headings = Array.from(document.querySelectorAll('h2, h3'))
  return headings.map(h => h.textContent.trim()).slice(0, 30)
})
console.log('Headings on page:')
yaoTexts.forEach(t => console.log('  -', t))

// Scroll to yao section and screenshot
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
await tab.screenshot({ path: 'D:/eight/screenshots/debug-64-yao.png', fullPage: false })
console.log('saved: debug-64-yao.png')

await browser.close()
