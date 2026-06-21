<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { PaginatedDocument } from './engine-vue'
import type { PaperName } from './core'
import InvoiceDoc from './demo/InvoiceDoc.vue'
import FragmentView from './demo/FragmentView.vue'
import { createInvoice, makeItem, grossTotal, money } from './demo/invoice'

const invoice = reactive(createInvoice(24))

const paper = ref<PaperName>('A4')
const headerMm = ref(28) // top margin === running-header band height
const footerMm = ref(16) // bottom margin === footer band height
const sideMm = ref(18)
const itemCount = ref(invoice.items.length)

// --- Corporate identity / stationery -------------------------------------
const brand = ref('#1d4ed8')

// A default placeholder logo (inline SVG data URI — prints with no network).
const DEFAULT_LOGO =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='12' fill='#1d4ed8'/><path d='M16 47V17h6.5L40 39V17h6.5v30H40L22.5 25v22z' fill='#fff'/></svg>`,
  )
const logoUrl = ref<string | null>(DEFAULT_LOGO)
const letterheadUrl = ref<string | null>(null)
const letterheadAllPages = ref(true)

const themeVars = computed(() => ({ '--brand': brand.value }))

const marginsMm = computed(() => ({
  top: headerMm.value,
  right: sideMm.value,
  bottom: footerMm.value,
  left: sideMm.value,
}))

const totalPages = ref(0)
const docRef = ref<InstanceType<typeof PaginatedDocument> | null>(null)

function onPaginated(e: { totalPages: number; warnings: string[] }) {
  totalPages.value = e.totalPages
}

watch(itemCount, (n) => {
  const cur = invoice.items.length
  if (n > cur) for (let i = cur; i < n; i++) invoice.items.push(makeItem(i))
  else if (n < cur) invoice.items.splice(n)
})

function onFile(e: Event, set: (url: string | null) => void) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () =>
    set(typeof reader.result === 'string' ? reader.result : null)
  reader.readAsDataURL(file)
}

// A built-in sample letterhead so the background feature is visible without an
// upload. In production this is the customer's uploaded image (or a PDF page
// rasterised server-side — see docs/ARCHITECTURE.md).
function loadSampleLetterhead() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 794 1123'>
    <rect width='794' height='1123' fill='#ffffff'/>
    <rect x='0' y='0' width='794' height='12' fill='${brand.value}'/>
    <rect x='40' y='1086' width='714' height='2' fill='${brand.value}' opacity='0.6'/>
    <text x='40' y='1104' font-family='sans-serif' font-size='11' fill='#94a3b8'>Musterfirma GmbH · Hafenstraße 12 · 20457 Hamburg · www.musterfirma.de</text>
    <text x='397' y='640' font-family='sans-serif' font-size='150' fill='${brand.value}' opacity='0.05' text-anchor='middle' transform='rotate(-28 397 600)'>MUSTERFIRMA</text>
  </svg>`
  letterheadUrl.value = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
</script>

<template>
  <div class="flex h-screen flex-col bg-slate-100 text-slate-900">
    <header
      class="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3"
    >
      <div class="flex items-baseline gap-3">
        <h1 class="text-sm font-semibold">vue-pdf-live-render</h1>
        <span class="text-xs text-slate-400">
          live paginated preview · logo · stationery · running header/footer
        </span>
      </div>
      <div class="flex items-center gap-4 text-xs">
        <span class="text-slate-500">
          {{ totalPages }} page{{ totalPages === 1 ? '' : 's' }} ·
          {{ invoice.items.length }} items ·
          {{ money(grossTotal(invoice), invoice.currency) }}
        </span>
        <button
          class="rounded-md px-3 py-1.5 font-medium text-white hover:opacity-90"
          :style="{ background: brand }"
          @click="docRef?.print()"
        >
          Print / Export PDF
        </button>
      </div>
    </header>

    <div class="flex min-h-0 flex-1">
      <aside
        class="w-72 shrink-0 space-y-4 overflow-y-auto border-r border-slate-200 bg-white p-5 text-xs"
      >
        <div class="font-semibold uppercase tracking-wider text-slate-400">
          Page setup
        </div>
        <Field label="Paper">
          <select v-model="paper" class="ctl">
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
            <option value="Legal">Legal</option>
          </select>
        </Field>
        <Field :label="`Header height (top margin): ${headerMm}mm`">
          <input v-model.number="headerMm" type="range" min="12" max="60" class="w-full" />
        </Field>
        <Field :label="`Footer height (bottom margin): ${footerMm}mm`">
          <input v-model.number="footerMm" type="range" min="10" max="40" class="w-full" />
        </Field>
        <Field :label="`Side margins: ${sideMm}mm`">
          <input v-model.number="sideMm" type="range" min="8" max="32" class="w-full" />
        </Field>
        <Field :label="`Line items: ${itemCount}`">
          <input v-model.number="itemCount" type="range" min="1" max="80" class="w-full" />
        </Field>

        <div class="border-t border-slate-100 pt-4 font-semibold uppercase tracking-wider text-slate-400">
          Corporate identity
        </div>
        <Field label="Brand colour">
          <input v-model="brand" type="color" class="h-8 w-full rounded border border-slate-200" />
        </Field>
        <Field label="Logo (running header)">
          <div class="flex items-center gap-2">
            <img v-if="logoUrl" :src="logoUrl" alt="logo" class="h-8 w-8 rounded object-contain ring-1 ring-slate-200" />
            <input type="file" accept="image/*" class="min-w-0 flex-1 text-[11px]" @change="onFile($event, (u) => (logoUrl = u))" />
            <button v-if="logoUrl" class="text-slate-400 hover:text-slate-600" @click="logoUrl = null">clear</button>
          </div>
        </Field>
        <Field label="Letterhead / stationery (full page)">
          <div class="space-y-2">
            <input type="file" accept="image/*" class="w-full text-[11px]" @change="onFile($event, (u) => (letterheadUrl = u))" />
            <div class="flex items-center gap-2">
              <button class="rounded border border-slate-200 px-2 py-1 hover:bg-slate-50" @click="loadSampleLetterhead">Load sample</button>
              <button v-if="letterheadUrl" class="text-slate-400 hover:text-slate-600" @click="letterheadUrl = null">clear</button>
            </div>
            <label class="flex items-center gap-2 text-slate-500">
              <input v-model="letterheadAllPages" type="checkbox" />
              show on all pages (else first page only)
            </label>
          </div>
        </Field>
        <p class="leading-5 text-slate-400">
          Uploads are read as data URIs, so they print through Puppeteer with no
          network fetch. For a PDF letterhead, rasterise it server-side (see docs).
        </p>
      </aside>

      <main class="min-w-0 flex-1 overflow-auto p-8">
        <PaginatedDocument
          ref="docRef"
          :model="invoice"
          :paper="paper"
          :margins-mm="marginsMm"
          :theme-vars="themeVars"
          @paginated="onPaginated"
        >
          <template #document>
            <InvoiceDoc :invoice="invoice" />
          </template>

          <!-- Full-page stationery layer (behind content). -->
          <template #background="{ isFirstPage }">
            <img
              v-if="letterheadUrl && (letterheadAllPages || isFirstPage)"
              :src="letterheadUrl"
              alt=""
              class="h-full w-full"
              style="object-fit: cover"
            />
          </template>

          <!-- Running header — fuller on page 1, compact on continuations. -->
          <template #header="{ isFirstPage }">
            <div
              class="flex h-full items-center justify-between gap-4 pb-2"
              style="border-bottom: 2px solid var(--brand)"
            >
              <!-- h-full gives the group a DEFINITE height so the logo's
                   max-height:100% actually resolves (else the SVG overflows).
                   The logo is the SAME size on every page (consistent branding);
                   the first-page-different bits below are the address line and
                   the "continued" label. -->
              <div class="flex h-full min-w-0 items-center gap-3">
                <img
                  v-if="logoUrl"
                  :src="logoUrl"
                  alt="logo"
                  class="w-auto object-contain"
                  :style="{ maxHeight: '100%' }"
                />
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold text-slate-800">
                    {{ invoice.seller.name }}
                  </div>
                  <div v-if="isFirstPage" class="truncate text-[10px] text-slate-400">
                    {{ invoice.seller.lines.join(' · ') }}
                  </div>
                </div>
              </div>
              <div class="shrink-0 text-right">
                <div class="text-xs font-medium" :style="{ color: 'var(--brand)' }">
                  {{ invoice.number }}
                </div>
                <div v-if="!isFirstPage" class="text-[10px] text-slate-400">
                  continued
                </div>
              </div>
            </div>
          </template>

          <template #footer="{ pageNumber, totalPages: tp }">
            <div
              class="flex h-full items-start justify-between border-t border-slate-200 pt-2 text-[10px] text-slate-400"
            >
              <span>{{ invoice.number }} · {{ invoice.date }}</span>
              <span>Page {{ pageNumber }} of {{ tp }}</span>
            </div>
          </template>

          <template #page="{ fragments }">
            <FragmentView
              v-for="(f, i) in fragments"
              :key="i"
              :fragment="f"
              :invoice="invoice"
            />
          </template>
        </PaginatedDocument>
      </main>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, h } from 'vue'

const Field = defineComponent({
  props: { label: { type: String, required: true } },
  setup(props, { slots }) {
    return () =>
      h('label', { class: 'block' }, [
        h('span', { class: 'mb-1 block font-medium text-slate-600' }, props.label),
        slots.default?.(),
      ])
  },
})

export default { components: { Field } }
</script>

<style scoped>
.ctl {
  width: 100%;
  border: 1px solid rgb(203 213 225);
  border-radius: 0.375rem;
  padding: 0.375rem 0.5rem;
  background: #fff;
}
</style>
