import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`))
page.on('response', (res) => {
  if (res.status() >= 400 && res.url().includes('localhost')) {
    errors.push(`[HTTP ${res.status()}] ${res.url()}`)
  }
})

console.log('=== 1. Open /divination ===')
await page.goto('http://localhost:4181/divination', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1500))

console.log('=== 2. Fill 3 numbers (368, 492, 157) ===')
const inputs = await page.$$('input[inputmode="numeric"]')
console.log(`Found ${inputs.length} number inputs`)
for (let i = 0; i < inputs.length; i++) {
  const val = ['368', '492', '157'][i]
  await inputs[i].click({ clickCount: 3 })
  await inputs[i].type(val)
}

await page.screenshot({ path: 'screenshots/flow-1-form-filled.png' })

console.log('=== 3. Click 启卦 ===')
const buttons = await page.$$('button[type="submit"]')
console.log(`Found ${buttons.length} submit buttons`)
await buttons[0].click()

// Wait for navigation to /result/...
await page.waitForFunction(
  () => window.location.pathname.startsWith('/result/'),
  { timeout: 5000 }
)
await new Promise(r => setTimeout(r, 1500))
const resultUrl = page.url()
console.log(`On URL: ${resultUrl}`)
await page.screenshot({ path: 'screenshots/flow-2-result.png' })

console.log('=== 4. Check if Header/Footer are on result page ===')
const hasHeader = await page.evaluate(() => !!document.querySelector('header'))
const hasFooter = await page.evaluate(() => !!document.querySelector('footer'))
const hasNavItems = await page.evaluate(() => {
  const items = document.querySelectorAll('header nav a')
  return Array.from(items).map((a) => a.textContent.trim())
})
console.log(`Header present: ${hasHeader}`)
console.log(`Footer present: ${hasFooter}`)
console.log(`Nav items: ${JSON.stringify(hasNavItems)}`)

console.log('=== 5. Click 开始 AI 解读 ===')
const aiButton = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  return btns.find((b) => b.textContent.includes('开始 AI 解读'))
})
const aiBtnExists = await page.evaluate((b) => !!b, aiButton)
console.log(`AI button found: ${aiBtnExists}`)
if (aiBtnExists) {
  await aiButton.asElement().click()
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: 'screenshots/flow-3-ai-loading.png' })
  await new Promise(r => setTimeout(r, 10000))
  await page.screenshot({ path: 'screenshots/flow-4-ai-result.png' })
  const aiText = await page.evaluate(() => {
    const el = document.querySelector('.whitespace-pre-wrap')
    return el ? el.textContent.substring(0, 300) : null
  })
  console.log(`AI text length: ${aiText ? aiText.length : 0}`)
  if (aiText) console.log(`First 300 chars: ${aiText}`)
}

console.log('=== 6. Click 查看本卦详情 ===')
const detailButton = await page.evaluateHandle(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  return btns.find((b) => b.textContent.includes('查看本卦详情'))
})
const detailExists = await page.evaluate((b) => !!b, detailButton)
console.log(`Detail button found: ${detailExists}`)
if (detailExists) {
  await detailButton.asElement().click()
  await page.waitForFunction(
    () => window.location.pathname.startsWith('/hexagram/'),
    { timeout: 5000 }
  )
  await new Promise(r => setTimeout(r, 1500))
  const detailUrl = page.url()
  console.log(`Navigated to: ${detailUrl}`)
  await page.screenshot({ path: 'screenshots/flow-5-detail.png' })
}

console.log('\n=== Errors during flow ===')
errors.forEach((e) => console.log(e))

await browser.close()
