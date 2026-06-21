<script setup lang="ts">
import { reactive } from "vue";
import { PaginatedDocument } from "./engine-vue";

const doc = reactive({
  title: "Delivery Note",
  rows: Array.from({ length: 40 }, (_, i) => ({ id: `r${i}`, name: `Item ${i + 1}`, qty: i + 1 })),
});
</script>

<template>
  <PaginatedDocument :model="doc" paper="A4" :margins-mm="{ top: 22, right: 18, bottom: 16, left: 18 }">
    <!-- (1) THE GALLEY: the whole document, once, with data-atom-* tags -->
    <template #document>
      <h1 data-atom-id="title" data-atom-kind="block" class="pb-4 text-xl font-bold">
        {{ doc.title }}
      </h1>

      <table data-atom-id="rows" data-atom-kind="table" class="w-full table-fixed text-sm">
        <thead data-thead>
          <tr>
            <th class="text-left">Item</th>
            <th class="text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in doc.rows" :key="r.id" :data-row-id="r.id">
            <td>{{ r.name }}</td>
            <td class="text-right">{{ r.qty }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- (2) THE PAGE: render each computed fragment, mirroring the galley -->
    <template #page="{ fragments }">
      <template v-for="(f, i) in fragments" :key="i">
        <h1 v-if="f.kind === 'block' && f.atomId === 'title'" class="pb-4 text-xl font-bold">
          {{ doc.title }}
        </h1>

        <table v-else-if="f.kind === 'table'" class="w-full table-fixed text-sm">
          <thead>
            <tr>
              <th class="text-left">Item</th>
              <th class="text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            <!-- only THIS page's rows; the <thead> above repeats automatically -->
            <tr v-for="r in doc.rows.slice(f.fromRow, f.toRow)" :key="r.id">
              <td>{{ r.name }}</td>
              <td class="text-right">{{ r.qty }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>

    <!-- (3) OPTIONAL running chrome (repeats on every sheet) -->
    <template #footer="{ pageNumber, totalPages }">
      <div class="flex h-full items-start justify-between border-t pt-2 text-[10px] text-slate-400">
        <span>{{ doc.title }}</span>
        <span>Page {{ pageNumber }} of {{ totalPages }}</span>
      </div>
    </template>
  </PaginatedDocument>
</template>
