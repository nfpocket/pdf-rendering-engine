/**
 * Example /print endpoint — the Puppeteer side of the pipeline.
 *
 * The browser sends the self-contained HTML produced by `buildPrintHtml()`
 * (src/engine-vue/printExport.ts): the SAME galley DOM that drove the preview,
 * with our computed page boundaries already marked as `break-before: page` and
 * the compiled Tailwind styles + @page rules inlined. Puppeteer just has to
 * honor the forced breaks and emit the PDF — it never re-decides pagination.
 *
 * This mirrors the existing endpoint the team already runs; the only changes
 * vs. a naive setup are the parity flags called out below.
 *
 *   npm i express puppeteer        # (in your server project)
 *   node server/print.example.mjs
 *   POST http://localhost:8787/print   body: { html: "<!doctype html>..." }
 */
import express from 'express'
import puppeteer from 'puppeteer'

const app = express()
app.use(express.json({ limit: '32mb' }))

let browserPromise = null
const getBrowser = () => {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      args: [
        // Chrome's minimum font size silently enlarges tiny text → breaks parity.
        '--blink-settings=minimumFontSize=0',
        '--font-render-hinting=none',
      ],
    })
  }
  return browserPromise
}

app.post('/print', async (req, res) => {
  const { html } = req.body
  if (!html) return res.status(400).json({ error: 'missing html' })

  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    // print media so @media print + @page apply exactly as in the preview
    await page.emulateMediaType('print')
    await page.setContent(html, { waitUntil: 'networkidle0' })
    // don't print against half-loaded fonts/images — that drifts page breaks
    await page.evaluateHandle('document.fonts.ready')

    const pdf = await page.pdf({
      preferCSSPageSize: true, // honor our @page size/margins, not pdf() opts
      printBackground: true,
      // scale stays 1; margins come from @page.
    })

    res.setHeader('Content-Type', 'application/pdf')
    res.send(Buffer.from(pdf))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: String(err) })
  } finally {
    await page.close()
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => console.log(`/print listening on :${PORT}`))
