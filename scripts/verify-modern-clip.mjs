import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 800 })

// Pick a few hexagram IDs that were empty before
const ids = [5, 16, 30, 64]
for (const id of ids) {
  await page.goto(`http://localhost:4181/hexagram/${id}`, { waitUntil: 'networkidle2' })
  await new Promise(r => setTimeout(r, 1500))

  // Find the "现 代 解 读" section (heading has spaces between chars)
  const has = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'))
    const target = h2s.find(h => h.textContent.replace(/\s/g, '').includes('现代解读'))
    if (!target) return { hasSection: false }
    const block = target.parentElement
    const p = block.querySelector('p')
    return {
      hasSection: true,
      hasParagraph: !!p,
      text: p ? p.textContent.slice(0, 100) + '...' : null,
      textLength: p ? p.textContent.length : 0,
    }
  })
  console.log(`ID ${id}:`, JSON.stringify(has))
  await page.screenshot({
    path: `screenshots/modern-id-${id}.png`,
    fullPage: true
  })
  // Also a focused clip on the modern interpretation section
  const sectionY = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'))
    const target = h2s.find(h => h.textContent.replace(/\s/g, '').includes('现代解读'))
    return target ? target.getBoundingClientRect().top + window.scrollY : null
  })
  if (sectionY) {
    await page.screenshot({
      path: `screenshots/modern-section-${id}.png`,
      clip: { x: 0, y: Math.max(0, sectionY - 30), width: 1280, height: 500 }
    })
  }
}

await browser.close()
