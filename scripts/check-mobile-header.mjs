import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
})
const page = await browser.newPage()
await page.setViewport({ width: 375, height: 100 })
await page.goto('http://localhost:4181/', { waitUntil: 'networkidle2' })
await new Promise(r => setTimeout(r, 1500))

await page.screenshot({ path: 'screenshots/header-01-home-mobile.png', clip: { x: 0, y: 0, width: 375, height: 100 } })
const result = await page.evaluate(() => {
  const header = document.querySelector('header')
  const seal = header.querySelector('svg[viewBox="0 0 100 100"]')
  return {
    sealRect: seal ? seal.getBoundingClientRect().toJSON() : null,
    sealText: seal ? seal.querySelector('text')?.textContent : null,
  }
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
