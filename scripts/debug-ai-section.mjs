// Minimal diagnostic: open result page, click AI, screenshot + dump
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1800 })

page.on('console', (msg) => {
  console.log(`[console:${msg.type()}]`, msg.text().slice(0, 200))
})
page.on('pageerror', (err) => console.log('[pageerror]', err.message))
page.on('response', (resp) => {
  const u = resp.url()
  if (u.includes('/api/ai/')) {
    console.log(`[response] ${resp.status()} ${u} (content-type: ${resp.headers()['content-type']})`)
  }
})

await page.goto('http://localhost:4181/divination', { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 600))

// Fill + submit
const inputs = await page.$$('input[inputmode="numeric"]')
for (let i = 0; i < 3; i++) {
  await inputs[i].click({ clickCount: 3 })
  await inputs[i].type(['358', '217', '496'][i], { delay: 30 })
  await new Promise((r) => setTimeout(r, 100))
}
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'))
  const b = buttons.find((b) => /启\s*卦/.test(b.textContent.replace(/\s/g, '')))
  if (b) b.click()
})
await new Promise((r) => setTimeout(r, 2000))
console.log('On result page:', page.url())

// Dump AI section BEFORE click
const beforeHTML = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('h3'))
  const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
  if (!aiHeader) return 'NO AI HEADER'
  // Walk up to the outer section (rice background)
  let section = aiHeader
  while (section && !section.className?.includes?.('bg-rice')) section = section.parentElement
  return section ? section.outerHTML : 'NO SECTION'
})
console.log('--- AI section HTML BEFORE click ---')
console.log(beforeHTML.slice(0, 3000))

// Click AI
console.log('\n--- Clicking AI button ---')
const clicked = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'))
  const b = buttons.find((x) => /开始.*AI.*解读/.test(x.textContent))
  if (b) { b.click(); return true }
  return false
})
console.log('Clicked:', clicked)

// Wait and poll
for (let i = 0; i < 12; i++) {
  await new Promise((r) => setTimeout(r, 5000))
  const status = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h3'))
    const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
    let section = aiHeader
    while (section && !section.className?.includes?.('bg-rice')) section = section.parentElement
    if (!section) return { error: 'NO SECTION' }
    const text = section.querySelector('.whitespace-pre-wrap')?.textContent || ''
    const button = Array.from(section.querySelectorAll('button')).map((b) => b.textContent.replace(/\s+/g, ''))
    const errorP = Array.from(section.querySelectorAll('p')).map((p) => p.textContent)
    return { textLen: text.length, text: text.slice(0, 80), buttons: button, errors: errorP }
  })
  console.log(`t=${(i+1)*5}s:`, JSON.stringify(status))
  if (status.textLen > 50) {
    await page.screenshot({ path: 'screenshots/debug-ai-success.png', fullPage: true })
    console.log('Saved debug-ai-success.png')
    break
  }
}

await page.screenshot({ path: 'screenshots/debug-ai-final.png', fullPage: true })
await browser.close()
