/**
 * Generate README screenshots from the running dev server.
 *   npm run dev            # in one terminal (http://localhost:5173)
 *   node scripts/screenshots.mjs
 */
import puppeteer from 'puppeteer'
import { mkdirSync } from 'node:fs'

const URL = process.env.URL || 'http://localhost:5173'
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--force-color-profile=srgb'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 2 })
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.vplr-page', { timeout: 15000 })
  await wait(1200)

  // 1) Hero — the whole app
  await page.screenshot({ path: `${OUT}/hero.png` })
  console.log('✓ hero.png')

  // 2) A single clean A4 page
  await (await page.$('.vplr-page')).screenshot({ path: `${OUT}/page.png` })
  console.log('✓ page.png')

  // 3) The page-break boundary: repeated table header + footer page numbers
  await page.evaluate(() => {
    const m = document.querySelector('main')
    const second = document.querySelectorAll('.vplr-page')[1]
    if (second) {
      const mRect = m.getBoundingClientRect()
      const sRect = second.getBoundingClientRect()
      m.scrollTop += sRect.top - mRect.top - 170
    }
  })
  await wait(400)
  await (await page.$('main')).screenshot({ path: `${OUT}/page-break.png` })
  console.log('✓ page-break.png')

  // 4) Corporate identity: brand colour + uploaded-style letterhead
  await page.evaluate(() => {
    const set = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      ).set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
    const color = document.querySelector('input[type=color]')
    if (color) set(color, '#0d9488')
    const btn = [...document.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === 'Load sample',
    )
    if (btn) btn.click()
    document.querySelector('main').scrollTop = 0
  })
  await wait(1000)
  await (await page.$('.vplr-page')).screenshot({ path: `${OUT}/stationery.png` })
  console.log('✓ stationery.png')
} finally {
  await browser.close()
}
