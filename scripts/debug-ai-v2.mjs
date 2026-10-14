// Minimal AI debug: go to result, click AI, log everything
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 1200 })

// Log ALL console messages
page.on('console', (msg) => {
  console.log(`[${msg.type()}]`, msg.text().slice(0, 300))
})
page.on('pageerror', (err) => console.log('[PAGE ERROR]', err.message))
page.on('response', (resp) => {
  const u = resp.url()
  if (u.includes('/api/')) {
    console.log(`[NET ${resp.status()}] ${resp.request().method()} ${u}`)
  }
})

// Navigate to divination, fill, submit
await page.goto('http://localhost:4181/divination', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 800))

const inputs = await page.$$('input[inputmode="numeric"]')
for (let i = 0; i < 3; i++) {
  await inputs[i].click({ clickCount: 3 })
  await inputs[i].type(['456', '289', '371'][i], { delay: 30 })
  await new Promise(r => setTimeout(r, 100))
}

await page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(b =>
    /启/.test(b.textContent) && /卦/.test(b.textContent)
  )
  if (b) b.click()
})
await new Promise(r => setTimeout(r, 2000))
console.log('URL:', page.url())

// Dump full AI section
const dumpSection = async (label) => {
  const html = await page.evaluate(() => {
    const h3s = Array.from(document.querySelectorAll('h3'))
    const ai = h3s.find(h => /AI/.test(h.textContent))
    if (!ai) return 'NO H3 AI'
    let el = ai
    while (el && !el.className?.includes?.('bg-rice')) el = el.parentElement
    return el ? el.outerHTML.slice(0, 2000) : 'NO BG-RICE SECTION'
  })
  console.log(`\n--- ${label} ---\n${html}`)
}

await dumpSection('BEFORE click')

// Click AI
const aiBtn = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'))
  const b = buttons.find(x => /开始.*AI/.test(x.textContent))
  if (!b) return null
  b.click()
  return b.textContent
})
console.log('\nClicked AI button:', aiBtn)

// Poll state
for (let idx = 1; idx <= 30; idx++) {
  await new Promise(r => setTimeout(r, 2000))
  const state = await page.evaluate((t) => {
    const h3s = Array.from(document.querySelectorAll('h3'))
    const ai = h3s.find(h => /AI/.test(h.textContent))
    if (!ai) return 'NO AI H3'
    let section = ai
    while (section && !section.className?.includes?.('bg-rice')) section = section.parentElement
    const btns = section ? Array.from(section.querySelectorAll('button')).map(b => b.textContent.trim()) : []
    const preWrap = section?.querySelector?.('.whitespace-pre-wrap')
    const text = preWrap ? preWrap.textContent.slice(0, 100) : ''
    const errP = section ? Array.from(section.querySelectorAll('p')).filter(p => /网络|错误|超时|Session|频繁/.test(p.textContent)).map(p => p.textContent) : []
    return { t: t * 2, btns, textLen: text.length, text: text.slice(0, 60), errs: errP }
  }, idx)
  console.log(`t=${idx*2}s:`, JSON.stringify(state))
  if (state !== 'NO AI H3' && (state.textLen > 50 || state.errs.length > 0)) break
}

await page.screenshot({ path: 'screenshots/debug-ai-v2-final.png', fullPage: true })
await browser.close()
console.log('\nDone. Screenshot saved.')
