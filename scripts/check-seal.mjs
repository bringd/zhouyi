import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 1280, height: 200 })
await page.goto('http://localhost:4181/', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1500))

const result = await page.evaluate(() => {
  const header = document.querySelector('header')
  if (!header) return { error: 'no header' }
  const seal = header.querySelector('svg[viewBox="0 0 100 100"]')
  const allSvgs = header.querySelectorAll('svg').length
  const sealText = header.querySelector('text')
  return {
    hasSeal: !!seal,
    sealRect: seal ? seal.getBoundingClientRect().toJSON() : null,
    allSvgs,
    sealTextContent: sealText ? sealText.textContent : null,
  }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
