<script setup lang="ts">
import type { Fragment } from '../core'
import type { Invoice } from './invoice'
import InvoiceMeta from './InvoiceMeta.vue'
import ItemsTable from './ItemsTable.vue'
import TotalsBlock from './TotalsBlock.vue'
import TermsText from './TermsText.vue'

defineProps<{ fragment: Fragment; invoice: Invoice }>()
</script>

<template>
  <!-- block atoms: render the whole component -->
  <template v-if="fragment.kind === 'block'">
    <InvoiceMeta v-if="fragment.atomId === 'meta'" :invoice="invoice" />
    <TotalsBlock v-else-if="fragment.atomId === 'totals'" :invoice="invoice" />
    <h3
      v-else-if="fragment.atomId === 'terms-heading'"
      class="pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
    >
      Terms &amp; Conditions
    </h3>
  </template>

  <!-- table atom: render the repeated header + this page's row slice -->
  <ItemsTable
    v-else-if="fragment.kind === 'table'"
    :invoice="invoice"
    :items="invoice.items.slice(fragment.fromRow, fragment.toRow)"
    :start-pos="fragment.fromRow"
    :continued="fragment.continued"
  />

  <!-- text atom: clip-window projection of the SAME paragraph, sliced by line -->
  <div
    v-else-if="fragment.kind === 'text'"
    :style="{ height: fragment.clipHeight + 'px', overflow: 'hidden' }"
  >
    <div :style="{ transform: `translateY(${-fragment.clipTop}px)` }">
      <TermsText :text="invoice.terms" />
    </div>
  </div>
</template>
