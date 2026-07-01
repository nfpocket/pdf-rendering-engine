/**
 * The core's data contract. The fragmentation engine consumes a flat, ordered
 * list of *measured atoms* (heights already filled in by a browser binding, or
 * by a mock in a headless test) and emits *page layouts* made of *fragments*.
 *
 * Nothing in this file knows about Vue or the DOM. An "atom" is the smallest
 * unit the v1 engine reasons about; richer recursive box trees are a later
 * milestone (see docs/ARCHITECTURE.md), but the BreakToken model below is
 * deliberately shaped to grow into them.
 */

export type AtomKind = 'block' | 'table' | 'text'

interface AtomCommon {
  /** Stable id — MUST be derived from the document model, never DOM identity,
   *  so incremental re-pagination can compare tokens across edits. */
  id: string
  /** Force this atom to start a new page (Word-style manual break / section). */
  breakBefore?: boolean
  /** Keep this atom on the same page as the following atom (e.g. a heading with
   *  its first row, or a totals block with the end of the items table). */
  keepWithNext?: boolean
}

/** An unsplittable rectangle: render whole, or move it to the next page. */
export interface BlockAtom extends AtomCommon {
  kind: 'block'
  height: number
}

/** A table that may split between rows, repeating its header on each page. */
export interface TableAtom extends AtomCommon {
  kind: 'table'
  /** Height of the repeated <thead>. */
  headerHeight: number
  /** Height reserved for a <tfoot> on the LAST fragment (0 if none). */
  footerHeight: number
  rows: Array<{ id: string; height: number; keepWithNext?: boolean }>
}

/**
 * A run of flowing text that may split between line boxes. `lineTops` holds the
 * top offset of every line relative to the atom's top, plus a trailing sentinel
 * equal to the total height, so line i occupies [lineTops[i], lineTops[i+1]).
 */
export interface TextAtom extends AtomCommon {
  kind: 'text'
  lineTops: number[] // length === lineCount + 1
  orphans: number // min lines that must remain before a break
  widows: number // min lines that must carry to the next page
  /**
   * Index into `lineTops` of the first *real glyph line*. Normally 0, but the
   * measurer prepends a synthetic 0 entry when the first glyph line does not
   * start at the border-box top (top padding / border / half-leading) so the
   * first fragment's clip window includes that spacing. That leading entry is
   * NOT a text line, so orphan/widow counts must skip it — hence this offset.
   */
  glyphStart?: number
}

export type Atom = BlockAtom | TableAtom | TextAtom

// ---------------------------------------------------------------------------

export type Fragment =
  | { kind: 'block'; atomId: string }
  | {
      kind: 'table'
      atomId: string
      /** Repeat the <thead> at the top of this fragment. */
      repeatHeader: boolean
      /** Render rows [fromRow, toRow). */
      fromRow: number
      toRow: number
      /** True if more rows of this table continue on a later page. */
      continued: boolean
    }
  | {
      kind: 'text'
      atomId: string
      fromLine: number
      toLine: number
      /** Pixel slice into the measured galley element (for clip-window render). */
      clipTop: number
      clipHeight: number
      continued: boolean
    }

export interface PageLayout {
  index: number // 0-based
  fragments: Fragment[]
}

export interface PaginateResult {
  pages: PageLayout[]
  totalPages: number
  /** Non-fatal issues: oversized atoms placed-and-overflowed, relaxed keeps… */
  warnings: string[]
}

export interface PaginateOptions {
  /** Hard cap so a measurement bug can never infinite-loop. Defaults to
   *  (atom count + total rows) * 4 + a small slack. */
  maxPages?: number
  /** Throw in dev when a table's fragment rows don't sum to its source rows. */
  assertRowConservation?: boolean
}
