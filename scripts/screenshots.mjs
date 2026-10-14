/**
 * Screenshot the 4 core pages of the Zhouyi frontend.
 *
 * Usage: node scripts/screenshots.mjs
 *
 * Requires:
 *   - Frontend dev server running on http://localhost:5173
 *   - Backend dev server running on http://localhost:3001 (legacy Express
 *     port; the `server/` package was removed 2026-08-15 — for current
 *     /api/* routing see Vite proxy config in `vite.config.ts`, which points
 *     to Worker :8787 / Pages Functions :8788)
 *   - Edge browser installed (msedge.exe)
 *
 * Outputs:
 *   screenshots/01-home-desktop.png
 *   screenshots/02-codex-desktop.png
 *   screenshots/03-hexagram-1-desktop.png
 *   screenshots/04-divination-desktop.png
 *   + mobile variants (375x812)
 */

import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const SHOT_DIR = resolve(ROOT, 'screenshots')
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const PAGES = [
  { name: '01-home', url: 'http://localhost:5180/', waitFor: 'h1' },
  { name: '02-codex', url: 'http://localhost:5180/codex', waitFor: 'h1' },
  { name: '03-hexagram-1', url: 'http://localhost:5180/hexagram/1', waitFor: 'h1' },
  { name: '04-hexagram-2', url: 'http://localhost:5180/hexagram/2', waitFor: 'h1' },
  { name: '05-hexagram-3', url: 'http://localhost:5180/hexagram/3', waitFor: 'h1' },
  { name: '06-divination', url: 'http://localhost:5180/divination', waitFor: 'h1' },
]

const DEVICES = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'mobile', width: 375, height: 812 },
]

async function main() {
  await mkdir(SHOT_DIR, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
    ],
  })

  try {
    for (const device of DEVICES) {
      for (const page of PAGES) {
        const tab = await browser.newPage()
        await tab.setViewport({ width: device.width, height: device.height, deviceScaleFactor: 1 })
        console.log(`[${device.name}] ${page.name} → ${page.url}`)

        try {
          await tab.goto(page.url, { waitUntil: 'networkidle2', timeout: 30000 })
        } catch (e) {
          console.warn(`  goto warn: ${e.message}, continuing`)
        }
        // Wait for the page's main heading to appear
        try {
          await tab.waitForSelector(page.waitFor, { timeout: 8000 })
        } catch (e) {
          console.warn(`  selector wait warn: ${e.message}, continuing`)
        }
        // Small extra delay for animations to settle
        await new Promise((r) => setTimeout(r, 1500))

        const filePath = resolve(SHOT_DIR, `${page.name}-${device.name}.png`)
        await tab.screenshot({ path: filePath, fullPage: false })
        console.log(`  ✓ ${filePath}`)
        await tab.close()
      }
    }
  } finally {
    await browser.close()
  }
  console.log('Done.')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
