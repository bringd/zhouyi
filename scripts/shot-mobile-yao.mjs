// Mobile scroll check — see yao section on mobile
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
await tab.setCacheEnabled(false)

await tab.goto('http://localhost:5180/hexagram/1?t=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))

// Scroll to yao section
await tab.evaluate(() => {
  // Find by text content
  const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [class*="section"]'))
  for (const h of allHeadings) {
    if (h.textContent.includes('六爻爻辞') || h.textContent.includes('六爻')) {
      h.scrollIntoView({ behavior: 'instant', block: 'start' })
      return
    }
  }
  // Fallback: scroll down 1500px
  window.scrollTo(0, 1500)
})
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/acceptance/03b-hex-1-mobile-yao.png', fullPage: false })
console.log('saved: 03b-hex-1-mobile-yao.png')

// Scroll to mid yao
await tab.evaluate(() => window.scrollBy(0, 600))
await new Promise((r) => setTimeout(r, 1200))
await tab.screenshot({ path: 'D:/eight/screenshots/acceptance/03c-hex-1-mobile-yao-mid.png', fullPage: false })
console.log('saved: 03c-hex-1-mobile-yao-mid.png')

await browser.close()
