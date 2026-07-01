import { describe, it, expect } from 'vitest'
import { paginate } from './fragment'
import type { BlockAtom, TableAtom, TextAtom } from './types'

// --- tiny atom builders ------------------------------------------------------

const block = (id: string, height: number, extra: Partial<BlockAtom> = {}): BlockAtom => ({
  id,
  kind: 'block',
  height,
  ...extra,
})

const table = (
  id: string,
  headerHeight: number,
  footerHeight: number,
  rowHeights: number[],
  extra: Partial<TableAtom> = {},
): TableAtom => ({
  id,
  kind: 'table',
  headerHeight,
  footerHeight,
  rows: rowHeights.map((h, i) => ({ id: `${id}-r${i}`, height: h })),
  ...extra,
})

/** lineTops for `count` uniform lines of `h` px (plus the trailing sentinel). */
const linesOf = (count: number, h: number): number[] =>
  Array.from({ length: count + 1 }, (_, i) => i * h)

const text = (
  id: string,
  lineTops: number[],
  extra: Partial<TextAtom> = {},
): TextAtom => ({
  id,
  kind: 'text',
  lineTops,
  orphans: 2,
  widows: 2,
  ...extra,
})

// -----------------------------------------------------------------------------

describe('maxPages cap scales with splittable units (was: threw on long text)', () => {
  it('paginates a long single text atom without throwing', () => {
    // 100 lines of 20px, 100px content → 5 lines/page → 20 pages.
    // Old cap = (1 atom)*4 + 8 = 12 → threw "exceeded maxPages (12)" at page 13.
    const long = text('body', linesOf(100, 20), { orphans: 1, widows: 1 })
    let result!: ReturnType<typeof paginate>
    expect(() => (result = paginate([long], 100))).not.toThrow()
    expect(result.totalPages).toBe(20)
    // conservation: every line placed, none duplicated
    const covered = result.pages.flatMap((p) =>
      p.fragments.flatMap((f) => (f.kind === 'text' ? [f.fromLine, f.toLine] : [])),
    )
    expect(covered[0]).toBe(0)
    expect(covered[covered.length - 1]).toBe(100)
  })

  it('still throws when a genuine runaway blows an explicit cap', () => {
    const long = text('body', linesOf(100, 20), { orphans: 1, widows: 1 })
    expect(() => paginate([long], 100, { maxPages: 5 })).toThrow(/maxPages/)
  })
})

describe('table footer is reserved on the last fragment', () => {
  it('does not pack a trailing atom into the last fragment’s footer band', () => {
    // rows [50,50] under a 10px header with a 30px footer, 100px content.
    // Last fragment is header(10)+row(50)+footer(30)=90 → only 10px free.
    // A 20px trailing block must move to its own page, not sit in the footer.
    const atoms = [table('items', 10, 30, [50, 50]), block('totals-after', 20)]
    const { pages, totalPages } = paginate(atoms, 100)
    expect(totalPages).toBe(3)
    const last = pages[2].fragments
    expect(last).toHaveLength(1)
    expect(last[0]).toMatchObject({ kind: 'block', atomId: 'totals-after' })
  })

  it('accounts for an unavoidable single-row footer overflow and warns', () => {
    // header(10)+row(80)=90 fits, but +footer(30)=120 cannot fit any page.
    // The footer must still be counted so the trailing block is pushed off-page.
    const atoms = [table('t', 10, 30, [80]), block('after', 10)]
    const { totalPages, warnings } = paginate(atoms, 100)
    expect(totalPages).toBe(2)
    expect(warnings.some((w) => /footer/.test(w))).toBe(true)
  })
})

describe('header-only (zero-row) table is not dropped', () => {
  it('emits a header/footer fragment for an empty table', () => {
    const { pages, totalPages } = paginate([table('empty', 20, 10, [])], 100)
    expect(totalPages).toBe(1)
    expect(pages[0].fragments[0]).toMatchObject({
      kind: 'table',
      atomId: 'empty',
      fromRow: 0,
      toRow: 0,
    })
  })
})

describe('widows minimum is honored (was: off-by-one no-op)', () => {
  it('pulls a line back so the tail keeps `widows` lines', () => {
    // 5 lines of 10px, 30px content, widows 3. Greedy fills 3 lines then strands
    // 2 → old guard (line-fromLine > widows) was false, so no pull-back.
    const atoms = [text('p', linesOf(5, 10), { orphans: 1, widows: 3 })]
    const { pages } = paginate(atoms, 30)
    const first = pages[0].fragments[0]
    const last = pages[pages.length - 1].fragments[0]
    expect(first).toMatchObject({ kind: 'text', fromLine: 0, toLine: 2 })
    expect(last).toMatchObject({ kind: 'text', fromLine: 2, toLine: 5 }) // tail = 3
  })
})

describe('orphan/widow counts ignore a synthetic top-padding line (glyphStart)', () => {
  it('does not count the padding slice as a real line when applying orphans', () => {
    // 3 glyph lines with 24px top padding → lineTops [0,24,40,56,72], glyphStart 1.
    // After a 52px block only 48px remain: the first slice would hold the padding
    // + 1 glyph line. That is a single ORPHAN glyph line (orphans=2) → the whole
    // paragraph must move to the next page. Without glyphStart the padding band
    // counted as a line and the orphan rule silently no-op'd.
    const atoms = [
      block('lead', 52),
      text('p', [0, 24, 40, 56, 72], { orphans: 2, widows: 1, glyphStart: 1 }),
    ]
    const { pages, totalPages } = paginate(atoms, 100)
    expect(totalPages).toBe(2)
    expect(pages[0].fragments.every((f) => f.kind !== 'text')).toBe(true)
    expect(pages[1].fragments[0]).toMatchObject({ kind: 'text', fromLine: 0, toLine: 4 })
  })
})

describe('keepWithNext does not strand a block before a forced break', () => {
  it('keeps the block on the current page when the next atom force-breaks', () => {
    // filler(60) fills most of a 100px page; A(30) keepWithNext fits in the
    // remaining 40; B has breakBefore so it can never share A's page anyway.
    // Old code flushed A to a lonely page (3 pages); now it stays (2 pages).
    const atoms = [
      block('filler', 60),
      block('A', 30, { keepWithNext: true }),
      block('B', 30, { breakBefore: true }),
    ]
    const { pages, totalPages } = paginate(atoms, 100)
    expect(totalPages).toBe(2)
    expect(pages[0].fragments.map((f) => f.atomId)).toEqual(['filler', 'A'])
    expect(pages[1].fragments.map((f) => f.atomId)).toEqual(['B'])
  })
})

describe('smoke: a mixed invoice-shaped document paginates cleanly', () => {
  it('places every atom and never throws', () => {
    const atoms = [
      block('meta', 120),
      table('items', 24, 40, Array.from({ length: 40 }, () => 22)),
      block('totals', 90, { keepWithNext: true }),
      block('terms-h', 20, { keepWithNext: true }),
      text('terms', linesOf(12, 16), { orphans: 2, widows: 2 }),
    ]
    const contentHeight = 297 * (96 / 25.4) - 2 * 18 * (96 / 25.4) // A4 minus 18mm margins
    const { pages, warnings } = paginate(atoms, contentHeight)
    expect(pages.length).toBeGreaterThan(1)
    // all 40 rows accounted for across the table's fragments
    const rowsPlaced = pages
      .flatMap((p) => p.fragments)
      .filter((f) => f.kind === 'table')
      .reduce((n, f) => n + (f.kind === 'table' ? f.toRow - f.fromRow : 0), 0)
    expect(rowsPlaced).toBe(40)
    expect(warnings).toEqual([])
  })
})
