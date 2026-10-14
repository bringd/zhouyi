import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})

// Take screenshots for 3 different yao positions
for (const position of [1, 3, 6]) {
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 })
  await tab.goto('http://localhost:5180/yao-design-compare', { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2000))
  // Click the position button
  await tab.click(`button:nth-of-type(${position})`)
  await new Promise((r) => setTimeout(r, 800))
  await mkdir('screenshots', { recursive: true })
  await tab.screenshot({ path: `D:/eight/screenshots/yao-design-pos${position}.png`, fullPage: false })
  console.log(`saved: screenshots/yao-design-pos${position}.png`)
  await tab.close()
}

await browser.close()
