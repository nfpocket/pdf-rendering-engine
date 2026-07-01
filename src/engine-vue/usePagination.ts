import {
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
  type Ref,
} from 'vue'
import { paginate, type PageGeometry, type PageLayout } from '../core'
import { measureGalley } from './measure'

export interface UsePaginationArgs {
  /** The off-canvas galley element to measure. */
  galley: Ref<HTMLElement | null>
  /** Reactive page geometry. */
  geometry: Ref<PageGeometry>
  /** A getter over the reactive model; deep-watched to trigger re-pagination. */
  model: () => unknown
}

export function usePagination(args: UsePaginationArgs) {
  const pages = shallowRef<PageLayout[]>([])
  const warnings = ref<string[]>([])
  const isPaginating = ref(false)

  let frame = 0
  let resizeObserver: ResizeObserver | null = null

  function run() {
    const el = args.galley.value
    if (!el) return
    isPaginating.value = true
    try {
      // READ phase: measure everything before any write.
      const atoms = measureGalley(el)
      const result = paginate(atoms, args.geometry.value.content.height, {
        assertRowConservation: import.meta.env.DEV,
      })
      // WRITE phase: publish reactive layout. Header/footer/page-number text is
      // written by the view from this data — never back into the model — so a
      // layout pass can never re-trigger itself (the infinite-reflow defense).
      pages.value = result.pages
      warnings.value = result.warnings
    } catch (err) {
      // A throw here (e.g. a row-conservation assert in dev) must not wedge the
      // engine — surface it and keep the last good layout.
      console.error('[vplr] pagination failed:', err)
    } finally {
      isPaginating.value = false
    }
  }

  function schedule() {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      run()
    })
  }

  onMounted(async () => {
    // Don't paginate against half-loaded fonts/images — that causes page drift.
    // fonts.ready alone is not enough: an <img> that hasn't decoded yet reports
    // ~0 height, so the first pass would mis-measure and the exported PDF could
    // diverge from the eventual on-screen layout. Gate on both.
    if (document.fonts?.ready) await document.fonts.ready
    await decodeImages(args.galley.value)
    schedule()

    resizeObserver = new ResizeObserver(() => schedule())
    if (args.galley.value) resizeObserver.observe(args.galley.value)
  })

  // Re-measure after Vue has patched the galley (flush:'post') for any model or
  // geometry change. The rAF inside schedule() then waits for layout.
  watch([args.model, args.geometry], schedule, { deep: true, flush: 'post' })

  onBeforeUnmount(() => {
    if (frame) cancelAnimationFrame(frame)
    resizeObserver?.disconnect()
  })

  return { pages, warnings, isPaginating, repaginate: schedule }
}

/**
 * Resolve once every <img> in the galley has decoded (or failed). img.decode()
 * is the reliable signal that the element has its intrinsic size and will lay
 * out at its final height; without it a height:auto image measures as ~0px on
 * the first pass. Failures resolve too — a broken image must not wedge the
 * engine. Already-complete images resolve immediately.
 */
async function decodeImages(galley: HTMLElement | null): Promise<void> {
  if (!galley) return
  const imgs = Array.from(galley.querySelectorAll('img'))
  await Promise.all(
    imgs.map((img) => {
      if (img.decode) return img.decode().catch(() => undefined)
      if (img.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    }),
  )
}
