// Show user which page actually displays yao text
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})
const tab = await browser.newPage()
await tab.setViewport({ width: 1280, height: 1800, deviceScaleFactor: 1 })
await tab.setCacheEnabled(false)

const pages = [
  { url: 'http://localhost:5180/', name: '01-home' },
  { url: 'http://localhost:5180/codex', name: '02-codex' },
  { url: 'http://localhost:5180/hexagram/64', name: '03-hex-64-detail' },
  { url: 'http://localhost:5180/hexagram/49', name: '04-hex-49-detail' },
]

for (const p of pages) {
  await tab.goto(p.url + '?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 30000 })
  await new Promise((r) => setTimeout(r, 2000))

  // Check if yao text is present
  const hasYaoText = await tab.evaluate(() => {
    return document.body.innerText.includes('初六') || document.body.innerText.includes('九二')
  })
  console.log(`${p.name}: yao text visible = ${hasYaoText}`)

  await tab.screenshot({ path: `D:/eight/screenshots/check-${p.name}.png`, fullPage: false })
}

await browser.close()
console.log('done')
