import { PX_PER_MM } from './geometry'
import type { PageGeometry } from './geometry'

/**
 * ALTERNATIVE export strategy (not the prototype default).
 *
 * The default export (src/engine-vue/printExport.ts) serializes the rendered
 * pages one div per sheet with `@page { margin: 0 }` — highest fidelity, and it
 * sidesteps Chromium's lack of `@page` margin boxes / `counter(page)`.
 *
 * This helper supports the OTHER approach: keep the continuous galley DOM and
 * let Chromium re-fragment it natively. The key parity move: the boundaries we
 * COMPUTED in the
 * preview are re-emitted as real `break-before: page` so Chromium's own
 * fragmenter reproduces them under Puppeteer's printToPDF instead of re-deciding
 * (Chromium treats break-inside:avoid as a hint and is unreliable headless, so
 * we never trust it — our forced breaks are authoritative).
 *
 * The browser binding marks each element that should start a new printed page
 * with `data-vplr-break="page"`; this CSS turns that into a forced break.
 */
export function buildPageCss(geometry: PageGeometry): string {
  const { page, margins } = geometry
  const mm = (px: number) => `${(px / PX_PER_MM).toFixed(4)}mm`
  return [
    `@page {`,
    `  size: ${mm(page.width)} ${mm(page.height)};`,
    `  margin: ${mm(margins.top)} ${mm(margins.right)} ${mm(margins.bottom)} ${mm(margins.left)};`,
    `}`,
    `[data-vplr-break="page"] { break-before: page; }`,
    // Tables: let Chromium repeat header/footer per printed page natively.
    `table thead { display: table-header-group; }`,
    `table tfoot { display: table-footer-group; }`,
    // Neutralise screen-only layout that diverges in the paged context.
    `* { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
  ].join('\n')
}

/**
 * Recommended Puppeteer options for the /print endpoint, so the team's existing
 * service stays in charge but is configured for parity. Documented here as data
 * rather than executed (the core never touches a browser).
 */
export const RECOMMENDED_PRINT_OPTIONS = {
  emulateMediaType: 'print',
  pdf: {
    preferCSSPageSize: true,
    printBackground: true,
    // scale stays 1; margins come from @page, not from here.
  },
  launchFlags: [
    // Chrome's minimum font size silently enlarges tiny text and breaks parity.
    '--blink-settings=minimumFontSize=0',
  ],
} as const
