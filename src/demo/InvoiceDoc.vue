<script setup lang="ts">
import type { Invoice } from './invoice'
import InvoiceMeta from './InvoiceMeta.vue'
import ItemsTable from './ItemsTable.vue'
import TotalsBlock from './TotalsBlock.vue'
import TermsText from './TermsText.vue'

defineProps<{ invoice: Invoice }>()
</script>

<template>
  <!--
    The authored document, rendered ONCE into the galley. Each measurable unit
    carries data-atom-* so the framework-agnostic core can fragment it. This is
    the ONLY coupling between content and engine — plain HTML data attributes.
  -->
  <InvoiceMeta :invoice="invoice" data-atom-id="meta" data-atom-kind="block" />

  <ItemsTable
    :invoice="invoice"
    :items="invoice.items"
    data-atom-id="items"
    data-atom-kind="table"
  />

  <TotalsBlock
    :invoice="invoice"
    data-atom-id="totals"
    data-atom-kind="block"
  />

  <h3
    class="pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
    data-atom-id="terms-heading"
    data-atom-kind="block"
    data-keep-with-next
  >
    Terms &amp; Conditions
  </h3>

  <TermsText
    :text="invoice.terms"
    data-atom-id="terms"
    data-atom-kind="text"
    data-orphans="2"
    data-widows="2"
  />
</template>
