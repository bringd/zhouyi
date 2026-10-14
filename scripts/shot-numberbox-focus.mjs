/**
 * Capture a screenshot of the NumberBox with the first input focused,
 * to show the focus ring.
 */
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})

try {
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  await tab.goto('http://localhost:4181/divination', { waitUntil: 'networkidle2', timeout: 30000 })
  await tab.waitForSelector('input[inputmode="numeric"]', { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 800))

  const inputs = await tab.$$('input[inputmode="numeric"]')
  // Fill all 3, then focus the middle one to show both focus and non-focus side-by-side
  await inputs[0].click()
  await inputs[0].type('368', { delay: 60 })
  await inputs[1].click()
  await inputs[1].type('492', { delay: 60 })
  await inputs[2].click()
  await inputs[2].type('157', { delay: 60 })
  // Re-focus the first so the focus state is captured
  await inputs[0].focus()
  await new Promise((r) => setTimeout(r, 400))

  await mkdir('D:/eight/screenshots', { recursive: true })
  const form = await tab.$('form')
  if (form) {
    const box = await form.boundingBox()
    const crop = {
      x: Math.max(0, box.x - 20),
      y: Math.max(0, box.y - 20),
      width: Math.min(1280, box.width + 40),
      height: Math.min(900, box.height + 40),
    }
    await tab.screenshot({ path: 'D:/eight/screenshots/numberbox-focus.png', clip: crop })
    console.log('saved: D:/eight/screenshots/numberbox-focus.png')
  }
} finally {
  await browser.close()
}
