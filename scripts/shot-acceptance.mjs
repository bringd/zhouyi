// Comprehensive local acceptance test — all pages, all viewports
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})

const viewports = [
  { name: 'desktop', w: 1280, h: 1800 },
  { name: 'tablet', w: 768, h: 1024 },
  { name: 'mobile', w: 375, h: 812 },
]

const pages = [
  { path: '/', name: '01-home' },
  { path: '/codex', name: '02-codex' },
  { path: '/hexagram/1', name: '03-hex-1-qian' },
  { path: '/hexagram/64', name: '04-hex-64-weiji' },
  { path: '/divination', name: '05-divination' },
  { path: '/records', name: '06-records' },
  { path: '/settings', name: '07-settings' },
  { path: '/yao-design-compare', name: '08-yao-compare' },
]

await mkdir('screenshots/acceptance', { recursive: true })

const issues = []

for (const vp of viewports) {
  console.log(`\n=== ${vp.name} (${vp.w}x${vp.h}) ===`)
  const tab = await browser.newPage()
  await tab.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 })
  await tab.setCacheEnabled(false)

  for (const p of pages) {
    try {
      await tab.goto('http://localhost:5180' + p.path + '?cb=' + Date.now(), {
        waitUntil: 'networkidle2',
        timeout: 20000,
      })
      await new Promise((r) => setTimeout(r, 1200))
      const file = `screenshots/acceptance/${p.name}-${vp.name}.png`
      await tab.screenshot({ path: file, fullPage: false })
      console.log(`  ✓ ${p.name}`)
    } catch (e) {
      issues.push({ vp: vp.name, page: p.name, error: String(e).slice(0, 100) })
      console.log(`  ✗ ${p.name}: ${String(e).slice(0, 80)}`)
    }
  }
  await tab.close()
}

await browser.close()

console.log('\n=== Issues ===')
if (issues.length === 0) {
  console.log('No issues found')
} else {
  issues.forEach((i) => console.log(`  ${i.vp} / ${i.page}: ${i.error}`))
}
