import type { Atom, TextAtom } from '../core'

/**
 * The browser binding's single job: walk the live galley and produce the
 * core's MeasuredBox/Atom list. This is the ONLY module allowed to touch DOM
 * measurement APIs. It is strictly read-only — it never mutates the galley.
 *
 * The galley content is annotated by the author with data attributes:
 *   data-atom-id      stable id (from the document model, NOT DOM identity)
 *   data-atom-kind    "block" | "table" | "text"
 *   data-break-before forces a page break before this atom
 *   data-keep-with-next  keep on the same page as the next atom
 * Tables additionally mark:  [data-thead], [data-tfoot] (optional), [data-row-id]
 * Text atoms must contain a single run of inline text (e.g. a <p>).
 *
 * v1 measures the BORDER-BOX height via getBoundingClientRect. Vertical margins
 * BETWEEN atoms are not counted, so author inter-atom spacing as padding inside
 * the atom box (see docs/ARCHITECTURE.md "Measurement contract").
 */
export function measureGalley(galley: HTMLElement): Atom[] {
  const els = Array.from(
    galley.querySelectorAll<HTMLElement>('[data-atom-id]'),
  ).filter((el) => nearestAtomAncestor(el, galley) === null)

  return els.map((el) => measureAtom(el))
}

function nearestAtomAncestor(
  el: HTMLElement,
  stopAt: HTMLElement,
): HTMLElement | null {
  let p = el.parentElement
  while (p && p !== stopAt) {
    if (p.hasAttribute('data-atom-id')) return p
    p = p.parentElement
  }
  return null
}

function measureAtom(el: HTMLElement): Atom {
  const id = el.dataset.atomId as string
  const kind = (el.dataset.atomKind ?? 'block') as Atom['kind']
  const breakBefore = el.hasAttribute('data-break-before')
  const keepWithNext = el.hasAttribute('data-keep-with-next')
  const rect = el.getBoundingClientRect()

  if (kind === 'table') {
    const head = el.querySelector<HTMLElement>('[data-thead]')
    const foot = el.querySelector<HTMLElement>('[data-tfoot]')
    const rowEls = Array.from(
      el.querySelectorAll<HTMLElement>('[data-row-id]'),
    )
    return {
      id,
      kind: 'table',
      breakBefore,
      keepWithNext,
      headerHeight: head ? head.getBoundingClientRect().height : 0,
      footerHeight: foot ? foot.getBoundingClientRect().height : 0,
      rows: rowEls.map((r) => ({
        id: r.dataset.rowId as string,
        height: r.getBoundingClientRect().height,
      })),
    }
  }

  if (kind === 'text') {
    return {
      id,
      kind: 'text',
      breakBefore,
      keepWithNext,
      orphans: numAttr(el, 'data-orphans', 2),
      widows: numAttr(el, 'data-widows', 2),
      lineTops: measureLineTops(el, rect.top, rect.height),
    } satisfies TextAtom
  }

  return { id, kind: 'block', breakBefore, keepWithNext, height: rect.height }
}

/**
 * Per-line geometry. Range.getClientRects() is the ONLY standard primitive that
 * yields one rect per rendered line box — exactly what we need to split text at
 * a line boundary and never through a glyph. We collect distinct line tops
 * (multiple inline fragments can share a line) and append the total height as a
 * trailing sentinel so line i occupies [lineTops[i], lineTops[i+1]).
 */
function measureLineTops(
  el: HTMLElement,
  elTop: number,
  elHeight: number,
): number[] {
  const range = document.createRange()
  range.selectNodeContents(el)
  const rects = Array.from(range.getClientRects())

  const tops: number[] = []
  let last = -Infinity
  for (const r of rects) {
    const top = r.top - elTop
    if (top - last > 1) {
      tops.push(top)
      last = top
    }
  }
  if (tops.length === 0) tops.push(0)
  if (tops[0] > 0.5) tops.unshift(0)
  tops.push(elHeight) // sentinel
  return tops
}

function numAttr(el: HTMLElement, name: string, fallback: number): number {
  const raw = el.getAttribute(name)
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}
