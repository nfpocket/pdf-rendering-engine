<script setup lang="ts">
import type { Invoice } from './invoice'
defineProps<{ invoice: Invoice }>()
</script>

<template>
  <section class="pb-8">
    <div class="flex items-start justify-between">
      <div>
        <div class="text-lg font-semibold text-slate-900">
          {{ invoice.seller.name }}
        </div>
        <div class="mt-1 text-xs leading-5 text-slate-500">
          <div v-for="l in invoice.seller.lines" :key="l">{{ l }}</div>
          <div>VAT: {{ invoice.seller.vatId }}</div>
        </div>
      </div>
      <div class="text-right">
        <div
          class="text-2xl font-bold tracking-tight"
          :style="{ color: 'var(--brand, #0f172a)' }"
        >
          INVOICE
        </div>
        <div class="mt-1 text-xs text-slate-500">{{ invoice.number }}</div>
      </div>
    </div>

    <div class="mt-8 flex items-start justify-between">
      <div>
        <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Bill to
        </div>
        <div class="mt-1 text-sm font-medium text-slate-800">
          {{ invoice.buyer.name }}
        </div>
        <div class="text-xs leading-5 text-slate-500">
          <div v-for="l in invoice.buyer.lines" :key="l">{{ l }}</div>
          <div>VAT: {{ invoice.buyer.vatId }}</div>
        </div>
      </div>
      <table class="text-xs text-slate-600">
        <tbody>
          <tr>
            <td class="pr-4 text-slate-400">Invoice date</td>
            <td class="text-right font-medium">{{ invoice.date }}</td>
          </tr>
          <tr>
            <td class="pr-4 text-slate-400">Due date</td>
            <td class="text-right font-medium">{{ invoice.dueDate }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
