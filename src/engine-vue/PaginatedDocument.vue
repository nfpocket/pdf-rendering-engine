<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import {
  makeGeometry,
  type Margins,
  type PaperName,
  type Size,
} from '../core'
import { usePagination } from './usePagination'
import { buildPrintHtml, printViaBrowser } from './printExport'

const props = withDefaults(
  defineProps<{
    /** The reactive document model. Deep-watched to re-paginate on change. */
    model: unknown
    paper?: PaperName | Size
    orientation?: 'portrait' | 'landscape'
    marginsMm?: Partial<Margins>
    /** Gap between paper sheets on screen, in px. */
    gap?: number
    /** CSS custom properties applied to the root (galley AND pages, so the
     *  measured galley and the rendered pages share a theme), e.g. for CI:
     *  { '--brand': '#b91c1c' }. */
    themeVars?: Record<string, string>
  }>(),
  { paper: 'A4', orientation: 'portrait', gap: 24 },
)

const emit = defineEmits<{
  paginated: [{ totalPages: number; warnings: string[] }]
}>()

const geometry = computed(() =>
  makeGeometry({
    paper: props.paper,
    orientation: props.orientation,
    marginsMm: props.marginsMm,
  }),
)

const galleyEl = ref<HTMLElement | null>(null)
const pagesEl = ref<HTMLElement | null>(null)

const { pages, warnings, isPaginating } = usePagination({
  galley: galleyEl,
  geometry,
  model: () => props.model,
})

watch(pages, (p) =>
  emit('paginated', { totalPages: p.length, warnings: warnings.value }),
)

const pageStyle = computed<CSSProperties>(() => ({
  width: `${geometry.value.page.width}px`,
  height: `${geometry.value.page.height}px`,
  marginBottom: `${props.gap}px`,
}))

const bodyStyle = computed<CSSProperties>(() => {
  const g = geometry.value
  return {
    position: 'absolute',
    top: `${g.margins.top}px`,
    left: `${g.margins.left}px`,
    width: `${g.content.width}px`,
    height: `${g.content.height}px`,
    overflow: 'hidden',
    zIndex: 1,
  }
})

// Full-bleed layer behind everything — for an uploaded letterhead / stationery.
const bgStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  inset: '0px',
  width: `${geometry.value.page.width}px`,
  height: `${geometry.value.page.height}px`,
  overflow: 'hidden',
  zIndex: 0,
}))

const headerStyle = computed<CSSProperties>(() => {
  const g = geometry.value
  return {
    top: '0px',
    height: `${g.margins.top}px`,
    paddingLeft: `${g.margins.left}px`,
    paddingRight: `${g.margins.right}px`,
    boxSizing: 'border-box',
    zIndex: 3,
  }
})

const footerStyle = computed<CSSProperties>(() => {
  const g = geometry.value
  return {
    bottom: '0px',
    height: `${g.margins.bottom}px`,
    paddingLeft: `${g.margins.left}px`,
    paddingRight: `${g.margins.right}px`,
    boxSizing: 'border-box',
    zIndex: 3,
  }
})

function print() {
  if (!pagesEl.value) return
  printViaBrowser(buildPrintHtml(pagesEl.value, geometry.value))
}

defineExpose({ pages, warnings, isPaginating, geometry, print })
</script>

<template>
  <div class="vplr-root" :style="themeVars">
    <!--
      The GALLEY: the authored document rendered ONCE, off-canvas, at the exact
      printable content width. This is the single live, reactive source DOM.
      Pagination measures it; it is never cloned or moved on screen.
    -->
    <div
      ref="galleyEl"
      class="vplr-galley"
      :style="{ width: geometry.content.width + 'px' }"
      aria-hidden="true"
    >
      <div>
        <slot name="document" />
      </div>
    </div>

    <!-- The visible paginated preview. THIS is what gets printed. -->
    <div ref="pagesEl" class="vplr-pages flex flex-col items-center">
      <div
        v-for="page in pages"
        :key="page.index"
        class="vplr-page"
        :style="pageStyle"
      >
        <!-- full-bleed stationery / letterhead layer (behind everything) -->
        <div class="vplr-chrome" :style="bgStyle">
          <slot
            name="background"
            :page-number="page.index + 1"
            :total-pages="pages.length"
            :is-first-page="page.index === 0"
          />
        </div>

        <div class="vplr-chrome" :style="headerStyle">
          <slot
            name="header"
            :page-number="page.index + 1"
            :total-pages="pages.length"
            :is-first-page="page.index === 0"
          />
        </div>

        <div class="vplr-body" :style="bodyStyle">
          <slot
            name="page"
            :fragments="page.fragments"
            :page-number="page.index + 1"
            :total-pages="pages.length"
            :is-first-page="page.index === 0"
          />
        </div>

        <div class="vplr-chrome" :style="footerStyle">
          <slot
            name="footer"
            :page-number="page.index + 1"
            :total-pages="pages.length"
            :is-first-page="page.index === 0"
          />
        </div>
      </div>
    </div>
  </div>
</template>
