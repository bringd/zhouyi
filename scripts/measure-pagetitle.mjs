import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

const routes = [
  { url: 'http://localhost:4181/codex', name: 'codex' },
  { url: 'http://localhost:4181/hexagram/1', name: 'hex1' },
]

for (const r of routes) {
  await page.goto(r.url, { waitUntil: 'networkidle2' })
  await new Promise(res => setTimeout(res, 1500))
  const result = await page.evaluate(() => {
    const h1 = document.querySelector('h1')
    if (!h1) return { error: 'no h1' }
    const r = h1.getBoundingClientRect()
    const cs = window.getComputedStyle(h1)
    const parent = h1.parentElement
    const pr = parent ? parent.getBoundingClientRect() : null
    return {
      title: h1.textContent,
      h1Rect: r.toJSON(),
      h1FontSize: cs.fontSize,
      h1LetterSpacing: cs.letterSpacing,
      parentRect: pr ? pr.toJSON() : null,
      h1ScrollWidth: h1.scrollWidth,
      h1ClientWidth: h1.clientWidth,
    }
  })
  console.log(r.name, JSON.stringify(result, null, 2))
}
await browser.close()
