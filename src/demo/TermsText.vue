<script setup lang="ts">
defineProps<{ text: string }>()
</script>

<template>
  <!-- Single run of inline text: Range.getClientRects() returns one rect per
       line box, which the engine uses to split between lines (never glyphs). -->
  <p class="text-[10px] leading-5 text-slate-500">{{ text }}</p>
</template>
