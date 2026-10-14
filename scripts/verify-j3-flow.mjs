// J3 verification: full end-to-end flow
// 1. /divination → fill 3 numbers → submit
// 2. Result page has new 动爻·爻辞 section with yao text rendered
// 3. AI 解读 button → wait for streamed response
// 4. Take screenshots proving both fixes work

import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SHOT_DIR = resolve(__dirname, '../screenshots')
if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true })

const FRONTEND = 'http://localhost:4181'
// Legacy Express backend port. Kept for reference; the legacy `server/`
// package was removed 2026-08-15. New flow uses Cloudflare Worker (:8787)
// + Pages Functions (:8788). See AGENTS.md / docs/deploy/cloudflare-pages.md.
const BACKEND = 'http://localhost:3001'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 900 })

// Surface console + network errors
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[browser:error]', msg.text())
  if (msg.type() === 'log' && msg.text().includes('AI')) console.log('[browser:log]', msg.text())
})
page.on('pageerror', (err) => console.log('[browser:pageerror]', err.message))
page.on('requestfailed', (req) =>
  console.log('[browser:requestfailed]', req.url(), req.failure()?.errorText)
)
page.on('response', (resp) => {
  const u = resp.url()
  if (u.includes('/api/ai/')) {
    console.log(`[browser:response] ${resp.status()} ${u}`)
  }
})

console.log('1. Navigate to /divination')
await page.goto(`${FRONTEND}/divination`, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 800))
await page.screenshot({ path: `${SHOT_DIR}/j3-1-divination-empty.png`, fullPage: true })

// Read the 3 NumberBox inputs (use the visible digits row)
console.log('2. Fill 3 numbers (must be 3-digit, 100-999 — form rejects partial input)')
const inputs = await page.$$('input[inputmode="numeric"]')
if (inputs.length < 3) throw new Error(`expected ≥3 number inputs, found ${inputs.length}`)
const digits = [358, 217, 496]
for (let i = 0; i < 3; i++) {
  await inputs[i].click({ clickCount: 3 })
  await inputs[i].type(String(digits[i]), { delay: 30 })
  await new Promise((r) => setTimeout(r, 100))
}
await page.screenshot({ path: `${SHOT_DIR}/j3-2-divination-filled.png`, fullPage: true })

// Find and click the "启 卦" button (any button that looks like submit)
console.log('3. Submit divination')
const submitted = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'))
  const submit = buttons.find((b) => {
    const t = b.textContent.replace(/\s/g, '').trim()
    return t.includes('启卦') || t.includes('起卦') || t.includes('提交')
  })
  if (submit) {
    submit.scrollIntoView({ block: 'center' })
    submit.click()
    return { ok: true, text: submit.textContent }
  }
  return { ok: false, texts: buttons.map(b => b.textContent.replace(/\s/g, '').trim()) }
})
if (!submitted.ok) throw new Error('could not find submit button. saw: ' + submitted.texts.join(' | '))
console.log('   clicked submit:', submitted.text)
await new Promise((r) => setTimeout(r, 1500))

// We should now be on /result/<id>
const currentUrl = page.url()
console.log('   current URL:', currentUrl)
if (!/\/result\//.test(currentUrl)) {
  await page.screenshot({ path: `${SHOT_DIR}/j3-3-divination-FAIL.png`, fullPage: true })
  throw new Error(`expected /result/ URL, got ${currentUrl}`)
}

await page.setViewport({ width: 1280, height: 1800 })
await new Promise((r) => setTimeout(r, 1000))
await page.screenshot({ path: `${SHOT_DIR}/j3-3-result-top.png`, fullPage: false })

// 4. Verify the new 动爻·爻辞 section exists and has the yao text
console.log('4. Verify 动爻·爻辞 section + AI interpretation present')
const sectionInfo = await page.evaluate(() => {
  const allH = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
  // The new section header: "动 爻 · 第 N 爻" (with spaces between chars)
  const movingHeader = allH.find((h) => /动\s*爻/.test(h.textContent))
  if (!movingHeader) return { hasSection: false }

  // Find the enclosing section
  const section = movingHeader.closest('section') || movingHeader.parentElement?.parentElement
  if (!section) return { hasSection: false, hasHeader: true }

  // Find the yao text container (the div with KaiTi font)
  const yaoTextEl = section.querySelector('div[style*="KaiTi"]')
  const yaoText = yaoTextEl ? yaoTextEl.textContent.trim() : null

  // 简释 should be GONE (K1 fix)
  const hasJianshi = section.textContent.includes('简 释') || section.textContent.includes('简释')
  const hasXiandai = section.textContent.includes('现 代 意 义') || section.textContent.includes('现代意义')

  // AI section
  const aiHeader = allH.find((h) => /AI/.test(h.textContent) && /深\s*度\s*解\s*读/.test(h.textContent))
  const aiSection = aiHeader?.closest('div')
  const aiButton = aiSection
    ? Array.from(aiSection.querySelectorAll('button')).find((b) => /AI\s*解读/.test(b.textContent) || /开始\s*AI/.test(b.textContent))
    : null

  return {
    hasSection: true,
    hasHeader: true,
    yaoText,
    yaoTextLength: yaoText?.length || 0,
    hasJianshi,
    hasXiandai,
    hasAI: !!aiHeader,
    hasAIButton: !!aiButton,
    sectionTextSample: section.textContent.replace(/\s+/g, ' ').slice(0, 250),
  }
})
console.log('   sectionInfo:', JSON.stringify(sectionInfo, null, 2))

if (!sectionInfo.hasSection) throw new Error('FAIL: 动爻·爻辞 section missing')
if (!sectionInfo.yaoText || sectionInfo.yaoTextLength < 4) {
  throw new Error('FAIL: yao text not rendered (length=' + sectionInfo.yaoTextLength + ')')
}
if (sectionInfo.hasJianshi) throw new Error('FAIL: 简释 block should be removed (K1)')
if (!sectionInfo.hasXiandai) throw new Error('FAIL: 现代意义 subtitle missing')

// Screenshot focused on the yao section
const yaoY = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('h3'))
  const target = headers.find((h) => /动\s*爻/.test(h.textContent))
  return target ? target.getBoundingClientRect().top + window.scrollY : null
})
if (yaoY) {
  await page.evaluate((y) => window.scrollTo(0, y - 40), yaoY)
  await new Promise((r) => setTimeout(r, 300))
  await page.screenshot({
    path: `${SHOT_DIR}/j3-4-yao-section.png`,
    clip: { x: 0, y: 0, width: 1280, height: 900 },
  })
}

// 5. Click AI 解读 button
console.log('5. Click AI 解读 button')
const aiClicked = await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button'))
  const b = buttons.find((x) => /开始\s*AI\s*解读/.test(x.textContent.replace(/\s+/g, ' ')) || /开始.*AI.*解读/.test(x.textContent))
  if (b) { b.scrollIntoView({ block: 'center' }); b.click(); return true }
  return false
})
if (!aiClicked) throw new Error('FAIL: could not find AI 解读 button')

// Stream — wait up to 90s for content (curl shows ~28s; give 3x headroom)
let aiText = ''
const start = Date.now()
let lastReport = 0
while (Date.now() - start < 90_000) {
  await new Promise((r) => setTimeout(r, 1500))
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  aiText = await page.evaluate(() => {
    // Find the AI section's content div
    const headers = Array.from(document.querySelectorAll('h3'))
    const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
    if (!aiHeader) return ''
    const section = aiHeader.closest('div')
    if (!section) return ''
    // Get the content paragraph (whitespace-pre-wrap div)
    const contentDiv = section.querySelector('.whitespace-pre-wrap')
    return contentDiv ? contentDiv.textContent : ''
  })
  // Check for error
  const err = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h3'))
    const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
    if (!aiHeader) return null
    const section = aiHeader.closest('div')
    if (!section) return null
    const errEl = Array.from(section.querySelectorAll('p')).find((p) => /网络错误|服务|超时|频繁|会话/.test(p.textContent))
    return errEl ? errEl.textContent : null
  })
  if (err) {
    console.log('   AI error after', elapsed, 's:', err)
    await page.screenshot({ path: `${SHOT_DIR}/j3-5-ai-FAIL.png`, fullPage: false })
    throw new Error('AI 解读 failed: ' + err)
  }
  if (aiText.length > 50) {
    console.log(`   AI text length ${aiText.length} at ${elapsed}s`)
    break
  }
  // Periodic progress
  if (Date.now() - lastReport > 5000) {
    console.log(`   ... ${elapsed}s elapsed, ${aiText.length} chars so far`)
    lastReport = Date.now()
  }
}
console.log('   AI text length:', aiText.length, 'chars (first 100):', aiText.slice(0, 100))

if (aiText.length < 50) {
  // Final screenshot to see what's actually on the page
  await page.screenshot({ path: `${SHOT_DIR}/j3-5-ai-FAIL.png`, fullPage: true })
  const debugHTML = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('h3'))
    const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
    if (!aiHeader) return 'NO AI HEADER FOUND'
    const section = aiHeader.closest('div')
    if (!section) return 'NO SECTION'
    return section.outerHTML.slice(0, 2000)
  })
  console.log('   AI section HTML:\n', debugHTML)
  throw new Error('FAIL: AI did not produce text within 90s')
}

const aiY = await page.evaluate(() => {
  const headers = Array.from(document.querySelectorAll('h3'))
  const aiHeader = headers.find((h) => /AI/.test(h.textContent) && /深.*度.*解.*读/.test(h.textContent))
  return aiHeader ? aiHeader.getBoundingClientRect().top + window.scrollY : null
})
if (aiY) {
  await page.evaluate((y) => window.scrollTo(0, y - 40), aiY)
  await new Promise((r) => setTimeout(r, 300))
  await page.screenshot({
    path: `${SHOT_DIR}/j3-5-ai-success.png`,
    clip: { x: 0, y: 0, width: 1280, height: 900 },
  })
}

// 6. Click "查看本卦六爻全部" link and verify it lands on the hexagram detail page
console.log('6. Click "查看本卦六爻全部" → verify navigation')
const navResult = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll('a'))
  const target = links.find((a) => /查看本卦六爻全部/.test(a.textContent))
  if (!target) return { found: false }
  target.click()
  return { found: true, href: target.href }
})
if (!navResult.found) throw new Error('FAIL: 跳转锚点 link not found')
console.log('   navigated to:', navResult.href)
await new Promise((r) => setTimeout(r, 1500))
const finalUrl = page.url()
console.log('   final URL:', finalUrl)
if (!/\/hexagram\/\d+/.test(finalUrl)) {
  throw new Error('FAIL: did not navigate to hexagram detail page')
}
await page.screenshot({ path: `${SHOT_DIR}/j3-6-hexagram-detail.png`, fullPage: true })

console.log('\n✅ All J3 checks passed.')
await browser.close()
