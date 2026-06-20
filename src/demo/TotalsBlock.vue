<script setup lang="ts">
import { grossTotal, money, netTotal, taxTotal, type Invoice } from './invoice'
const props = defineProps<{ invoice: Invoice }>()
</script>

<template>
  <section class="flex justify-end pt-6 pb-8">
    <table class="w-2/5 text-sm">
      <tbody>
        <tr>
          <td class="py-1 text-slate-500">Net</td>
          <td class="py-1 text-right tabular-nums text-slate-800">
            {{ money(netTotal(props.invoice), props.invoice.currency) }}
          </td>
        </tr>
        <tr>
          <td class="py-1 text-slate-500">
            VAT {{ Math.round(props.invoice.taxRate * 100) }}%
          </td>
          <td class="py-1 text-right tabular-nums text-slate-800">
            {{ money(taxTotal(props.invoice), props.invoice.currency) }}
          </td>
        </tr>
        <tr class="border-t-2 border-slate-800">
          <td class="py-2 font-semibold text-slate-900">Total due</td>
          <td class="py-2 text-right text-base font-bold tabular-nums text-slate-900">
            {{ money(grossTotal(props.invoice), props.invoice.currency) }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
