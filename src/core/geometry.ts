/**
 * Page geometry — the single source of truth for the printable box, shared by
 * the on-screen preview, the paginator, and the @page export CSS. Getting this
 * exactly right (and fractional) is what makes preview === printed PDF.
 *
 * The CSS reference pixel is defined as 1in = 96px = 25.4mm. This ratio is
 * fixed and identical in screen layout and in Chromium's print pipeline, so we
 * compute everything in fractional CSS px and only round at the very end.
 */

export const PX_PER_MM = 96 / 25.4 // 3.779527559...
export const PX_PER_IN = 96

/**
 * EPSILON guards the "does it fit?" comparison against sub-pixel layout, pixel
 * snapping and devicePixelRatio rounding — the classic source of an off-by-one
 * line spilling onto the next page. Compare fractional-to-fractional, then add
 * this slack. ~0.5–0.75px is the sweet spot found across implementations.
 */
export const EPSILON = 0.5

export const mm = (v: number): number => v * PX_PER_MM
export const inch = (v: number): number => v * PX_PER_IN

export interface Size {
  width: number
  height: number
}

export interface Margins {
  top: number
  right: number
  bottom: number
  left: number
}

/** Common paper sizes in fractional CSS px (portrait). */
export const PAPER = {
  A4: { width: mm(210), height: mm(297) }, // 793.7008 x 1122.5197
  Letter: { width: inch(8.5), height: inch(11) }, // 816 x 1056
  Legal: { width: inch(8.5), height: inch(14) },
} as const satisfies Record<string, Size>

export type PaperName = keyof typeof PAPER

export interface PageGeometry {
  /** Full sheet size in px. */
  page: Size
  margins: Margins
  /** Printable content box in px (page minus margins). */
  content: Size
}

export interface GeometryInput {
  paper?: PaperName | Size
  orientation?: 'portrait' | 'landscape'
  /** Margins in millimetres (the unit print users actually think in). */
  marginsMm?: Partial<{ top: number; right: number; bottom: number; left: number }>
}

const DEFAULT_MARGINS_MM = { top: 18, right: 18, bottom: 18, left: 18 }

export function makeGeometry(input: GeometryInput = {}): PageGeometry {
  const base =
    typeof input.paper === 'object' ? input.paper : PAPER[input.paper ?? 'A4']

  const page: Size =
    input.orientation === 'landscape'
      ? { width: base.height, height: base.width }
      : { width: base.width, height: base.height }

  const m = { ...DEFAULT_MARGINS_MM, ...input.marginsMm }
  const margins: Margins = {
    top: mm(m.top),
    right: mm(m.right),
    bottom: mm(m.bottom),
    left: mm(m.left),
  }

  return {
    page,
    margins,
    content: {
      width: page.width - margins.left - margins.right,
      height: page.height - margins.top - margins.bottom,
    },
  }
}
