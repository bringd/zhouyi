// Take screenshots of PRODUCTION build (preview server on 4180) to verify
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })
await tab.setCacheEnabled(false)

const checks = [
  { url: 'http://localhost:4180/', name: 'prod-01-home' },
  { url: 'http://localhost:4180/codex', name: 'prod-02-codex' },
  { url: 'http://localhost:4180/hexagram/1', name: 'prod-03-hex-1' },
  { url: 'http://localhost:4180/hexagram/64', name: 'prod-04-hex-64' },
]

for (const c of checks) {
  await tab.goto(c.url, { waitUntil: 'networkidle2', timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1500))
  await tab.screenshot({ path: `D:/eight/screenshots/acceptance/${c.name}.png`, fullPage: false })
  console.log(`saved: ${c.name}.png`)
}

await browser.close()
