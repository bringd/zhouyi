/**
 * Take a closeup screenshot of the NumberBox area, fill in 3 numbers, and
 * dump the input's computed styles. Saves a before/after pair.
 *
 * Usage: node scripts/shot-numberbox.mjs before | after
 */

import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const PHASE = process.argv[2] ?? 'before'
const URL = 'http://localhost:4181/divination'
const OUT = `D:/eight/screenshots/numberbox-${PHASE}.png`

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})

try {
  const tab = await browser.newPage()
  await tab.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
  await tab.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 })
  await tab.waitForSelector('input[inputmode="numeric"]', { timeout: 8000 })
  await new Promise((r) => setTimeout(r, 1000))

  // Fill in three numbers: 3, 6, 8
  const inputs = await tab.$$('input[inputmode="numeric"]')
  console.log(`[${PHASE}] found ${inputs.length} number inputs`)
  await inputs[0].click({ clickCount: 3 })
  await inputs[0].type('368', { delay: 80 })

  // Snapshot the first NumberBox area to inspect computed styles
  const computed = await inputs[0].evaluate((el) => {
    const cs = window.getComputedStyle(el)
    const parent = el.parentElement
    const pcs = parent ? window.getComputedStyle(parent) : null
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      caretColor: cs.caretColor,
      textAlign: cs.textAlign,
      opacity: cs.opacity,
      parentBg: pcs?.backgroundColor,
      parentBgImage: pcs?.backgroundImage,
      parentColor: pcs?.color,
    }
  })
  console.log(`[${PHASE}] computed input style:`)
  console.log(JSON.stringify(computed, null, 2))

  // For after phase: blur so we capture the resting state (not the focus ring)
  if (PHASE === 'after') {
    await tab.evaluate(() => (document.activeElement instanceof HTMLElement) && document.activeElement.blur())
    await new Promise((r) => setTimeout(r, 400))
  } else {
    await new Promise((r) => setTimeout(r, 400))
  }

  await mkdir('D:/eight/screenshots', { recursive: true })
  await tab.screenshot({ path: OUT, fullPage: false })
  console.log(`[${PHASE}] saved ${OUT}`)

  // Also save a tight crop of the 3-box region by getting its bounding box
  const form = await tab.$('form')
  if (form) {
    const box = await form.boundingBox()
    if (box) {
      const crop = {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.min(1280, box.width + 40),
        height: Math.min(900, box.height + 40),
      }
      const cropPath = `D:/eight/screenshots/numberbox-${PHASE}-crop.png`
      await tab.screenshot({ path: cropPath, clip: crop })
      console.log(`[${PHASE}] saved ${cropPath}`)
    }
  }
} finally {
  await browser.close()
}
