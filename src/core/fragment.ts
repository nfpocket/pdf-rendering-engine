import { EPSILON } from './geometry'
import type {
  Atom,
  Fragment,
  PageLayout,
  PaginateOptions,
  PaginateResult,
  TableAtom,
  TextAtom,
} from './types'

/**
 * paginate() — the framework-agnostic fragmentation core.
 *
 * Input:  a flat ordered list of MEASURED atoms + the printable content height.
 * Output: PageLayout[] — which fragments land on which page.
 *
 * Design properties (the ones paged.js gets wrong are called out):
 *  - Greedy fill + backtrack for keep-with-next.
 *  - Tables split only BETWEEN rows and repeat their header on every fragment.
 *  - Text splits only at LINE-box boundaries (never mid-glyph).
 *  - MINIMUM PROGRESS: an atom/row/line taller than an empty page is placed and
 *    allowed to overflow, then we advance past it — the engine can never halt
 *    with content left over (paged.js's equal-break-token deadlock).
 *  - Pure: no DOM, no mutation of the input. Deterministic. Headless-testable.
 */
export function paginate(
  atoms: Atom[],
  contentHeight: number,
  opts: PaginateOptions = {},
): PaginateResult {
  const warnings: string[] = []
  const pages: PageLayout[] = []
  // The cap is a runaway-loop backstop, not a page limit. It must exceed the
  // most pages any *legitimate* document can need: since minimum-progress places
  // at least one block, table row, or text line per page, the true page count is
  // bounded by the total count of those splittable units. Count text LINES too
  // (not just 1 per text atom) — otherwise a long letter/contract authored as a
  // single flowing text atom trips the cap and throws despite real progress.
  const splittableUnits = atoms.reduce((n, a) => {
    if (a.kind === 'table') return n + a.rows.length
    if (a.kind === 'text') return n + Math.max(1, a.lineTops.length - 1)
    return n + 1
  }, 0)
  const maxPages = opts.maxPages ?? splittableUnits * 4 + 8

  let current: Fragment[] = []
  let used = 0 // px consumed on the current page

  const remaining = () => contentHeight - used
  const pageEmpty = () => current.length === 0

  const flush = () => {
    if (current.length === 0) return
    pages.push({ index: pages.length, fragments: current })
    current = []
    used = 0
    if (pages.length > maxPages) {
      throw new Error(
        `paginate: exceeded maxPages (${maxPages}). Likely a measurement bug ` +
          `or an atom that never makes progress.`,
      )
    }
  }

  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]

    if (atom.breakBefore && !pageEmpty()) flush()

    if (atom.kind === 'block') {
      // keep-with-next: a block flagged keepWithNext must not be the last thing
      // on a page if the next atom won't also (at least start to) fit.
      if (
        atom.keepWithNext &&
        !pageEmpty() &&
        i + 1 < atoms.length &&
        // If the next atom force-breaks to its own page, the two can never share
        // a page — flushing here would only strand this block on a lonely page.
        !atoms[i + 1].breakBefore &&
        atom.height + minHeightOf(atoms[i + 1]) > remaining() + EPSILON
      ) {
        flush()
      }

      if (atom.height <= remaining() + EPSILON) {
        current.push({ kind: 'block', atomId: atom.id })
        used += atom.height
      } else if (pageEmpty()) {
        // Taller than a whole page: place it and let it overflow (min progress).
        current.push({ kind: 'block', atomId: atom.id })
        used += atom.height
        warnings.push(
          `Block "${atom.id}" (${round(atom.height)}px) is taller than the ` +
            `content area (${round(contentHeight)}px); placed with overflow.`,
        )
        flush()
      } else {
        flush()
        i-- // retry this atom on the fresh page
      }
      continue
    }

    if (atom.kind === 'table') {
      layoutTable(atom)
      continue
    }

    // atom.kind === 'text'
    layoutText(atom)
  }

  flush()

  return { pages, totalPages: pages.length, warnings }

  // --- table ---------------------------------------------------------------
  function layoutTable(atom: TableAtom): void {
    const { rows, headerHeight, footerHeight } = atom

    // A table with no body rows still has a header (and maybe a footer) to
    // place — otherwise its chrome is silently dropped from the output.
    if (rows.length === 0) {
      if (!pageEmpty() && headerHeight + footerHeight > remaining() + EPSILON) {
        flush()
      }
      current.push({
        kind: 'table',
        atomId: atom.id,
        repeatHeader: true,
        fromRow: 0,
        toRow: 0,
        continued: false,
      })
      used += headerHeight + footerHeight
      return
    }

    let row = 0
    let placedRows = 0

    while (row < rows.length) {
      // If the header + first row can't fit on a non-empty page, break first.
      if (
        !pageEmpty() &&
        headerHeight + rows[row].height > remaining() + EPSILON
      ) {
        flush()
      }

      // Reserve header height for this fragment.
      let frag = remaining() - headerHeight
      const fromRow = row

      // Greedily pack rows. The LAST fragment must also fit the footer.
      while (row < rows.length) {
        const isLast = row === rows.length - 1
        const need = rows[row].height + (isLast ? footerHeight : 0)
        if (need <= frag + EPSILON) {
          frag -= rows[row].height
          row++
        } else {
          break
        }
      }

      if (row === fromRow) {
        // Not even one row fits beneath the header on this fragment.
        const isLastRow = fromRow === rows.length - 1
        const rowFits =
          rows[fromRow].height <= remaining() - headerHeight + EPSILON

        if (isLastRow && rowFits && !pageEmpty()) {
          // The final row fits under the header, but not together with the
          // footer. A fresh page may hold header + row + footer — move to one so
          // the footer is not overflowed onto this partially-filled page.
          flush()
          continue
        }
        if (pageEmpty()) {
          // Oversized on an EMPTY page (the row alone is taller than the content
          // box, or row + footer is and no page can hold both): place it, allow
          // it to overflow, and advance so the engine always makes progress.
          warnings.push(
            rowFits
              ? `Row "${rows[fromRow].id}" of table "${atom.id}" plus its ` +
                  `footer exceeds the page; placed with overflow.`
              : `Row "${rows[fromRow].id}" of table "${atom.id}" exceeds the ` +
                  `page; placed with overflow.`,
          )
          row++
        } else {
          flush()
          continue // try again on a fresh page
        }
      }

      const continued = row < rows.length
      current.push({
        kind: 'table',
        atomId: atom.id,
        repeatHeader: true,
        fromRow,
        toRow: row,
        continued,
      })
      // Reserve the footer on the LAST fragment so it is accounted for in `used`
      // — otherwise page height is undercounted and a trailing atom gets packed
      // into the footer's band.
      used +=
        headerHeight + sumRowHeights(atom, fromRow, row) + (continued ? 0 : footerHeight)
      placedRows += row - fromRow

      if (continued) flush()
    }

    if (opts.assertRowConservation && placedRows !== rows.length) {
      throw new Error(
        `Row conservation violated for table "${atom.id}": placed ` +
          `${placedRows} of ${rows.length} rows.`,
      )
    }
  }

  // --- text ----------------------------------------------------------------
  function layoutText(atom: TextAtom): void {
    const lineCount = atom.lineTops.length - 1
    const gs = atom.glyphStart ?? 0
    const top = (line: number) => atom.lineTops[line]
    const sliceHeight = (a: number, b: number) => top(b) - top(a)
    // Number of real glyph lines in the half-open range [from, to). A leading
    // [0, gs) slice is non-glyph spacing (top padding/border) and does not count
    // toward orphan/widow requirements. Tail lines are always glyph lines.
    const glyphSpan = (from: number, to: number) => to - Math.max(from, gs)

    let line = 0
    while (line < lineCount) {
      const fromLine = line
      // pack whole line boxes until the next one would overflow
      while (
        line < lineCount &&
        sliceHeight(fromLine, line + 1) <= remaining() + EPSILON
      ) {
        line++
      }

      if (line === fromLine) {
        if (pageEmpty()) {
          line++ // single oversized line — place and overflow
        } else {
          flush()
          continue
        }
      }

      // Widows: keep at least `widows` glyph lines in the tail, as long as
      // pulling lines back still leaves ≥1 glyph line on the current page.
      // (The old guard `line - fromLine > widows` no-op'd whenever the page held
      // ≤ widows lines — the exact case that produces a widow.)
      const tail = lineCount - line
      if (
        tail > 0 &&
        tail < atom.widows &&
        glyphSpan(fromLine, line) > atom.widows - tail
      ) {
        line -= atom.widows - tail
      }

      // Orphans: don't strand fewer than `orphans` glyph lines at the bottom of
      // a page that already has content — push the whole run to the next page.
      if (
        fromLine === 0 &&
        !pageEmpty() &&
        glyphSpan(fromLine, line) < atom.orphans &&
        line < lineCount
      ) {
        flush()
        line = fromLine
        continue
      }

      const continued = line < lineCount
      current.push({
        kind: 'text',
        atomId: atom.id,
        fromLine,
        toLine: line,
        clipTop: top(fromLine),
        clipHeight: sliceHeight(fromLine, line),
        continued,
      })
      used += sliceHeight(fromLine, line)

      if (continued) flush()
    }
  }
}

// --- helpers ---------------------------------------------------------------

function minHeightOf(atom: Atom): number {
  switch (atom.kind) {
    case 'block':
      return atom.height
    case 'table':
      return atom.headerHeight + (atom.rows[0]?.height ?? 0)
    case 'text':
      return atom.lineTops.length > 1 ? atom.lineTops[1] : 0
  }
}

function sumRowHeights(atom: TableAtom, from: number, to: number): number {
  let h = 0
  for (let r = from; r < to; r++) h += atom.rows[r].height
  return h
}

const round = (n: number) => Math.round(n * 100) / 100
