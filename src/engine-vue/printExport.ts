import { PX_PER_MM, type PageGeometry } from '../core'

/**
 * Export strategy: "the preview IS the print".
 *
 * We serialize the already-rendered pages — each `.vplr-page` with its header
 * and footer chrome and its computed page number — as ONE div per sheet, and
 * print with `@page { margin: 0 }` so the page divs own their margins exactly as
 * on screen. No re-flow, no reliance on Chromium's `@page` margin boxes or
 * `counter(page)` (which Chromium does NOT support — that's why CSS page numbers
 * never worked headless). Each page is separated by a forced `break-after: page`.
 *
 * In production you POST `buildPrintHtml(...)` to your existing /print endpoint
 * (Puppeteer: emulateMediaType('print') + pdf({ preferCSSPageSize:true,
 * printBackground:true })). For the demo, `printViaBrowser` opens it and calls
 * window.print() — same engine, just keep the dialog's Margins on "Default"
 * (which, with @page margin:0, means zero printer margin so our layout fills the
 * sheet).
 */
export function buildPrintHtml(
  pagesEl: HTMLElement,
  geometry: PageGeometry,
): string {
  const clone = pagesEl.cloneNode(true) as HTMLElement
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    collectHeadStyles(),
    `<style>${buildPrintCss(geometry)}</style>`,
    '</head><body>',
    clone.outerHTML,
    '</body></html>',
  ].join('')
}

function buildPrintCss(geometry: PageGeometry): string {
  const wmm = (geometry.page.width / PX_PER_MM).toFixed(4)
  const hmm = (geometry.page.height / PX_PER_MM).toFixed(4)
  return [
    // Our page divs own the margins, so the sheet itself gets none.
    `@page { size: ${wmm}mm ${hmm}mm; margin: 0; }`,
    `html, body { margin: 0; padding: 0; background: #fff; }`,
    // Stack the sheets as plain blocks (kill the on-screen flex/centering/gap).
    `.vplr-pages { display: block !important; }`,
    `.vplr-page {`,
    `  margin: 0 !important;`,
    `  box-shadow: none !important;`,
    // 0.5px under the sheet height guards against sub-pixel spill → blank sheets.
    `  height: ${(geometry.page.height - 0.5).toFixed(3)}px !important;`,
    `  break-after: page;`,
    `  page-break-after: always;`,
    `}`,
    // No trailing blank sheet after the last page.
    `.vplr-page:last-child { break-after: auto; page-break-after: auto; }`,
    // Make backgrounds/borders print (Puppeteer also passes printBackground).
    `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
  ].join('\n')
}

export function printViaBrowser(html: string): void {
  const w = window.open('', '_blank')
  if (!w) {
    // eslint-disable-next-line no-console
    console.warn('Popup blocked — allow popups to preview the print output.')
    return
  }
  w.document.open()
  w.document.write(html)
  w.document.close()
  const go = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* user closed the window */
    }
  }
  w.onload = go
  // Fallback in case the load event already fired before the handler attached.
  setTimeout(go, 700)
}

/** Copy compiled <style>/<link rel=stylesheet> so the print DOM is styled. */
function collectHeadStyles(): string {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((n) => n.outerHTML)
    .join('\n')
}
