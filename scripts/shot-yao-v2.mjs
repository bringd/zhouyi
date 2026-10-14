// Take screenshot of V2 design compare page
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })
await tab.setCacheEnabled(false)
await mkdir('screenshots', { recursive: true })

await tab.goto('http://localhost:5180/yao-design-compare?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
await new Promise((r) => setTimeout(r, 2500))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-compare-pos3.png', fullPage: false })
console.log('saved: v2-compare-pos3.png')

// Test with position 6 (top)
const buttons = await tab.$$('button')
for (const btn of buttons) {
  const text = await tab.evaluate(b => b.textContent, btn)
  if (text.includes('上九')) {
    await btn.click()
    break
  }
}
await new Promise((r) => setTimeout(r, 1500))
await tab.screenshot({ path: 'D:/eight/screenshots/v2-compare-pos6.png', fullPage: false })
console.log('saved: v2-compare-pos6.png')

await browser.close()
