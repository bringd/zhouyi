import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

const routes = [
  { url: 'http://localhost:4181/codex', name: '02-codex' },
  { url: 'http://localhost:4181/hexagram/1', name: '03-hex-1' },
  { url: 'http://localhost:4181/hexagram/64', name: '03-hex-64' },
  { url: 'http://localhost:4181/records', name: '06-records' },
  { url: 'http://localhost:4181/settings', name: '07-settings' },
]

for (const r of routes) {
  await page.goto(r.url, { waitUntil: 'networkidle2' })
  await new Promise(res => setTimeout(res, 1500))
  await page.screenshot({ path: `screenshots/pagetitle-${r.name}.png`, clip: { x: 0, y: 0, width: 1280, height: 300 } })
  console.log(`✓ pagetitle-${r.name}.png`)
}

await browser.close()
