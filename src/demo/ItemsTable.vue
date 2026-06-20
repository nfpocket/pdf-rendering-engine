<script setup lang="ts">
import { lineTotal, money, type Invoice, type LineItem } from './invoice'

withDefaults(
  defineProps<{
    invoice: Invoice
    /** The rows to render in THIS fragment. */
    items: LineItem[]
    /** Position number of the first row (1-based display offset). */
    startPos?: number
    /** Show "continued" affordance when the table carries to the next page. */
    continued?: boolean
  }>(),
  { startPos: 0, continued: false },
)

// table-layout:fixed + a colgroup keeps column widths identical across every
// page fragment, so a split table looks like one continuous table.
</script>

<template>
  <div>
    <table class="w-full table-fixed border-collapse text-xs">
    <colgroup>
      <col style="width: 7%" />
      <col style="width: 49%" />
      <col style="width: 10%" />
      <col style="width: 16%" />
      <col style="width: 18%" />
    </colgroup>
    <thead data-thead>
      <tr class="border-b-2 border-slate-800 text-left text-slate-500">
        <th class="py-2 pr-2 font-semibold">#</th>
        <th class="py-2 pr-2 font-semibold">Description</th>
        <th class="py-2 pr-2 text-right font-semibold">Qty</th>
        <th class="py-2 pr-2 text-right font-semibold">Unit price</th>
        <th class="py-2 text-right font-semibold">Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(item, idx) in items"
        :key="item.id"
        :data-row-id="item.id"
        class="border-b border-slate-100 align-top"
      >
        <td class="py-2 pr-2 text-slate-400">{{ startPos + idx + 1 }}</td>
        <td class="py-2 pr-2 text-slate-700">{{ item.description }}</td>
        <td class="py-2 pr-2 text-right tabular-nums text-slate-700">
          {{ item.qty }} {{ item.unit }}
        </td>
        <td class="py-2 pr-2 text-right tabular-nums text-slate-700">
          {{ money(item.unitPrice, invoice.currency) }}
        </td>
        <td class="py-2 text-right font-medium tabular-nums text-slate-900">
          {{ money(lineTotal(item), invoice.currency) }}
        </td>
      </tr>
    </tbody>
    </table>
    <div
      v-if="continued"
      class="pt-1 text-right text-[10px] italic text-slate-400"
    >
      continued on next page →
    </div>
  </div>
</template>
