# vue-pdf-live-render — Architecture

A live-preview pagination engine for **Vue 3 + Tailwind** documents (invoices,
offers, delivery notes, purchase orders). It gives you Word-style multi-page
layout, running headers/footers, page numbers and an instant on-screen preview —
while the content stays **real Vue components styled with real Tailwind**, and
the **final PDF is still produced by your existing Puppeteer `/print` endpoint**
from the *same* DOM.

This document is the synthesized output of a multi-agent design pass (6 research
probes → 3 competing architectures → a 3-lens judge panel). The three
architectures converged ~90%; this is the reconciled design.

---

## 1. The core insight (why this is tractable at all)

Four findings decide everything:

1. **You cannot pour content into page boxes.** CSS Regions / named flows are
   dead in Chromium (removed 2014) and `element()` was never implemented. There
   is no declarative "flow this stream across N pages." **You must paginate by
   measurement + DOM splitting.** Every serious engine (paged.js, WeasyPrint,
   Prince) does this.

2. **`break-*` is inert on a normal screen.** `break-before/inside`, `orphans`,
   `widows` only take effect inside a *fragmentation container* (multicol or
   print). On a scrolling page they do nothing and can't be measured. So the
   preview can't lean on them — but **we can measure real geometry ourselves**
   and re-emit our decisions as forced breaks for print.

3. **`break-inside: avoid` is a hint, not a guarantee** (LayoutNG takes
   last-resort breaks and overflows monolithic content). So for the final PDF we
   **never trust Chromium's avoid logic** — our paginator resolves every
   keep/orphan/widow constraint and bakes the result into explicit
   `break-before: page` markers. Chromium only has to honor *forced* breaks,
   which it does reliably.

4. **Moving live DOM out from under Vue breaks it.** Vue patches elements in
   place (`n2.el = n1.el`) and relies on the mount-time parent/anchor. Raw
   `appendChild`/`removeChild` on Vue-owned nodes desyncs that bookkeeping and
   throws on the next structural patch. **So we never move component instances.**

The synthesis of (1)–(4): render the authored document **once** into a single
off-canvas **galley** at the exact printable content width; treat pagination as
a **pure function over the galley's measured geometry** that emits page-layout
*data*; render the visible pages as a **projection** of that data. The component
instances are never cloned or relocated, so reactivity, listeners and editing
survive by construction. A single component that spans pages is *windowed*, not
split — it stays one live instance.

---

## 2. Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│ L4  Print / Export      buildPrintHtml(): same galley DOM + forced     │
│     (browser binding)   break-before:page  →  Puppeteer /print  → PDF  │
├──────────────────────────────────────────────────────────────────────┤
│ L3  Editing / chrome    headers/footers, "Page X of Y", manual breaks, │
│     (Vue binding)       page setup — all OUTSIDE the model, view-only   │
├──────────────────────────────────────────────────────────────────────┤
│ L2  Vue binding         galley mount · measure adapter · usePagination │
│                         · PageFrame projection · FragmentView          │
├──────────────────────────────────────────────────────────────────────┤
│ L1  Measurement adapter DOM → MeasuredBox/Atom (the ONLY DOM-reading   │
│     (browser)           code: getBoundingClientRect, Range.getClientRects)│
├──────────────────────────────────────────────────────────────────────┤
│ L0  Pagination core     paginate(atoms, contentHeight) → PageLayout[]  │
│     (framework-agnostic)  pure data in / pure data out · NO Vue · NO DOM│
│                           headless-testable · OSS-extractable           │
└──────────────────────────────────────────────────────────────────────┘
        L0 is `src/core/`.  L1–L4 are `src/engine-vue/`.  Demo is `src/demo/`.
```

The boundary that matters: **L0 knows nothing about Vue or the DOM.** Its only
input is a list of measured atoms; its only output is page-layout data. That is
what makes it extractable as a standalone OSS package, and what makes it
testable with no browser at all.

> **Design verdict.** Of the three candidate architectures, **GFE** (cleanest
> core seam, smallest shippable v1, one projection mechanism) is the base. We
> graft in **GPF's** answer to the one thing pure clip-windowing can't do —
> *repeat a `<thead>` / carry a border across a cut* — by letting the projection
> layer render per-page continuation fragments (which is exactly what
> `FragmentView` + `ItemsTable(:items=slice)` does in this prototype). We adopt
> the cross-cutting agreements from all three: model = source of truth with
> chrome *outside* it; core's only browser coupling is measurement; row-count
> conservation asserts; multicol CI oracle; forced breaks authoritative.

---

## 3. The data contract (`src/core/types.ts`)

The core reasons about a flat, ordered list of **atoms** (the v1 granularity;
see §8 for the recursive box-tree evolution):

- **`BlockAtom`** — unsplittable rectangle. Render whole or move to next page.
- **`TableAtom`** — splits *between rows*; `headerHeight` is repeated on every
  fragment; `footerHeight` is reserved on the last fragment.
- **`TextAtom`** — splits *between line boxes*; carries `lineTops[]` (per-line
  geometry from `Range.getClientRects`) + `orphans`/`widows`.

A **break is a stable-id path + a typed offset** (`childIndex | rowIndex |
charIndex | lineIndex`) — modeled on Chromium's `NGBlockBreakToken` and
WeasyPrint's `resume_at`. The id must come from the **document model, never DOM
identity**, so incremental re-pagination (§8) can compare tokens across edits.

`paginate()` returns `PageLayout[]`, each a list of **fragments** describing what
to render on that page (a whole block; a table's `[fromRow,toRow)` with
`repeatHeader`; a text slice with `clipTop/clipHeight`).

---

## 4. The fragmentation algorithm (`src/core/fragment.ts`)

Greedy fill + backtrack, dispatched by atom kind. The properties that matter:

- **Block** — fits? place it. Doesn't fit on a non-empty page? flush and retry
  on a fresh page. Doesn't fit on an *empty* page? place it anyway and overflow
  (see minimum progress). `keepWithNext` flushes early if this block + the next
  atom's minimum height won't both fit.
- **Table** — reserve `headerHeight`, pack rows greedily, reserve `footerHeight`
  on the last fragment, set `repeatHeader: true` on **every** fragment so the
  header repeats. Split only *between* `<tr>`. (Rowspan handling, border-collapse
  → border-separate, and a row-count-conservation assert are in §6 / roadmap.)
- **Text** — pack whole **line boxes** using `lineTops` (never a glyph). Pull
  lines back to satisfy `widows`; push the run to the next page to satisfy
  `orphans`.

**Minimum-progress invariant (the bug paged.js gets wrong):** any atom / row /
line taller than an empty page is *placed and allowed to overflow*, then we
advance past it. Combined with a hard `maxPages` cap, the engine can never
deadlock or drop trailing content. This is the single most important correctness
property and it's a pure-function unit test.

---

## 5. The galley + projection (`src/engine-vue/`)

- **Galley** (`PaginatedDocument.vue`, `.vplr-galley`): the authored document
  rendered **once**, off-canvas (`left:-100000px`), at `geometry.content.width`,
  laid out (never `display:none`). This is the single live, reactive source DOM.
- **Measurement** (`measure.ts`): walks the galley, reads `data-atom-*`
  annotations, and produces `Atom[]`. `Range.getClientRects()` is the only
  primitive that yields per-line geometry — that's how text splits cleanly.
  Strictly read-only; the only module allowed to touch measurement APIs.
- **Scheduler** (`usePagination.ts`): gates the first pass on
  `document.fonts.ready`, rAF-batches, re-runs on a deep model watch
  (`flush:'post'`) and a `ResizeObserver`. Read phase (measure) then write phase
  (publish `pages`) — never interleaved, so no layout thrash. An `isPaginating`
  guard means a layout pass can never re-trigger itself.
- **Projection** (`PaginatedDocument.vue` `#page` slot + demo's `FragmentView`):
  each page is a real `.vplr-page` paper sheet (exact px) with an
  `overflow:hidden` body and absolutely-positioned header/footer chrome bands in
  the margins. For this prototype, fragments are rendered **declaratively** from
  the layout data (the table re-renders its repeated header + the page's row
  slice; text uses a `translateY` clip-window over the same paragraph). See §8
  for when this graduates to live-instance clip-window projection for editing.

### Measurement contract (v1 simplification)

v1 measures the **border-box** height (`getBoundingClientRect`). Vertical
margins *between* atoms are not counted, so **author inter-atom spacing as
padding inside the atom box** (the demo uses `pb-8` / `pt-6`). The same
components render in the galley and on the page, so heights match exactly.

---

## 6. Subsystems

**Running headers / footers — two renderers, one model.**
On screen they are absolutely-positioned overlay **bands** in the page margins
(`#header` / `#footer` slots), not `@page` margin boxes (which don't render on
screen) and not the `<thead>`/`<tfoot>` trick (which only repeats under *print*
media — on a live screen it renders once). For the **PDF**, we keep your proven
`<thead>`/`<tfoot>` mechanism and `@page` rules in the export DOM, where Chromium
repeats them natively. Both are generated from the same section metadata, so they
match.

**Headers, logos & stationery (CI).** The running header lives *in the top
margin*, so **the header band height === the top margin** — to fit a taller logo,
grow the top margin and the body reflows down automatically (no overlap). Slot
content is themed per tenant: `PaginatedDocument` accepts `themeVars`
(e.g. `{ '--brand': '#b91c1c' }`, applied to BOTH galley and pages so measurement
matches), and exposes `#header`/`#footer`/`#background` slots each scoped with
`{ pageNumber, totalPages, isFirstPage }` for first-page-different letterheads.
Two CI mechanisms:
- **Structured branding** — logo (`<img>`) + brand colour + address rendered from
  config. Stays sharp and themeable. Logos must be sized against a *definite*
  height (give the logo's flex parent `h-full`) or `max-height:%` silently
  resolves to `none` and the image overflows the band.
- **Full-page letterhead** — the customer's pre-printed paper as a `#background`
  layer (z-index below content), with margins set to clear its printed zones.
- **Uploads** are read as **data URIs** (`FileReader.readAsDataURL`), so they
  embed in the print DOM and Puppeteer prints them with no network fetch / CORS.
  A *PDF* letterhead must be rasterised server-side (pdfium / pdf.js / a Puppeteer
  render) to a per-page image first; store the image (or a CDN URL) in the
  tenant's stationery config.

**Page numbers — computed in JS.** `counter(page)`/`counter(pages)` resolve only
in paged media. On screen, `Y = pages.length`, `X = pageIndex + sectionOffset`,
written as **view-only DOM** in the footer band (never a model transaction — that
is the infinite-reflow defense). For the PDF, the export emits native
`counter(page) "of" counter(pages)` as well.

**Puppeteer path — "the preview IS the print" (`printExport.ts` +
`server/print.example.mjs`).** The prototype serializes the **already-rendered
pages** — each `.vplr-page` with its header/footer chrome and computed page
number — as **one `<div>` per sheet**, copies the compiled Tailwind styles, and
prints with `@page { margin: 0 }` so the page divs own their margins (the print
dialog's "Default" margin then means *zero printer margin*, so our layout fills
the sheet). Sheets are separated by a forced `break-after: page`. POST this HTML
to `/print`; Puppeteer runs `emulateMediaType('print')` +
`pdf({preferCSSPageSize:true, printBackground:true})`. There is no re-flow — the
PDF is a 1:1 serialization of what you saw, so headers/footers/page numbers and
margins are guaranteed identical.

> **Why not the other way?** A clean alternative (`core/export.ts`
> `buildPageCss`) keeps the *continuous galley* DOM and only injects
> `break-before:page` at the computed boundaries, letting Chromium re-fragment
> and repeat `<thead>`/`<tfoot>` natively. It's elegant, but headers/footers then
> have to be rebuilt as `@page` margin boxes — which **Chromium doesn't support**
> (nor `counter(page)`), which is exactly why CSS page numbers never worked
> headless and why your original code measured heights in a `beforeprint` hook.
> Serializing the rendered pages sidesteps all of that. Keep `buildPageCss` for
> the day you want native fragmentation; the per-page-div path is the default.

---

## 7. Preview === PDF parity (how we keep them identical)

1. Same `PageGeometry` drives the preview, the paginator, and the `@page` CSS.
2. Same compiled Tailwind build styles galley and export.
3. Our computed boundaries become real `break-before:page` — Chromium honors
   forced breaks reliably; we never rely on its `break-inside:avoid`.
4. Gate on `document.fonts.ready` + image decode before measuring/printing.
5. Disable Chrome's minimum font size (`--blink-settings=minimumFontSize=0`).
6. **CI parity gates** (roadmap): a hidden CSS-multicol container as an oracle to
   cross-check JS break points against Chromium's native fragmenter, plus a
   pixel-diff of preview vs an actual `printToPDF` run, failing on >1px drift.

---

## 8. Roadmap (milestone-based, smallest honest v1 first)

| Milestone | Goal | Status in this repo |
|---|---|---|
| **M1 — Walking skeleton** | Read-only paginated preview of an invoice: A4 geometry, block + table-row + text splitting, repeated table header, header/footer chrome, live "Page X of Y", reflow on data change, `/print` export. | ✅ **Done** (this prototype) |
| **M2 — Robust fragmentation** | Recursive box-tree (not flat atoms); nested splittable containers; rowspan-remaining map + border-separate + **row-count-conservation assert**; flex/grid keep-together; break-appeal (Knuth-Plass-style) scoring; `box-decoration-break` slice/clone fixups for bordered cards across a cut. | ⏳ Next |
| **M3 — Incremental reflow** | Per-page cache keyed on stable ids; dirty-from-page-k + downstream re-convergence early-out; per-box height memo by (content-hash + width); chunked full-pass fallback. Keeps 100+ page docs fast per keystroke. | ⏳ |
| **M4 — Live clip-window projection** | Replace declarative fragment rendering with true clip-window projection of the **single live galley** (instance preserved across pages); affine `framePoint + {0, sliceTop}` → `caretPositionFromPoint` hit-testing. | ⏳ |
| **M5 — Full WYSIWYG editing** | Document model as SSOT (ProseMirror/Tiptap for rich text via node-views hosting real Vue components; an overlay for drag/resize); manual breaks, keep-together, page setup as model metadata consumed as constraints; undo/redo/collab on the clean model. | ⏳ |
| **M6 — Parity CI + polish** | multicol oracle + printToPDF pixel-diff gates; footnotes / page floats; per-section page setup, odd/even & first-page-different headers. | ⏳ |

---

## 9. Open risks (carried forward)

- **Clip-vs-true-fragmentation parity** is the family's load-bearing premise —
  mitigated by forcing breaks + the CI oracle (M6). Treat any >1px drift as a
  build failure.
- **Tables with rowspan/colspan** are the historically worst case; a dropped
  invoice row is a *financial* bug. M2's row-count-conservation assert + golden
  invoice fixtures are non-negotiable.
- **`position: fixed/sticky`, transforms, filters** inside content must be
  treated as monolithic (move-whole / re-emit per page), never windowed-split.
- **Async height shifts** (late fonts/images) invalidate breaks → gate on
  `fonts.ready` + image decode; `ResizeObserver` feeds late changes as dirty.

---

## 10. Killer insights (the few non-obvious things)

1. **Measure, don't re-declare.** The reason this beats `@react-pdf` for
   fidelity is that the browser lays out the *real* Tailwind DOM and we only read
   geometry — there is no PDF style dialect to drift from CSS.
2. **Never move the instance; window it.** "One component across pages" stops
   being hard the moment you stop relocating DOM. Projection, not relocation.
3. **Own the breaks; force them for print.** Chromium's avoid/keep is a hint;
   your paginator is authoritative and bakes `break-before:page`.
4. **Chrome lives outside the model.** Page numbers/headers are view-only writes
   gated by `isPaginating` — the entire class of infinite-reflow bugs vanishes.
5. **Minimum progress is a correctness property, not an optimization.** It's the
   one thing paged.js gets wrong, and it's a five-line invariant + a unit test.
