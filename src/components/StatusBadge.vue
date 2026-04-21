<template>
  <span
    class="inline-block rounded-full px-2 py-[0.12rem] text-[0.68rem] font-semibold"
    :class="
      status === 'have'
        ? 'border border-success/20 bg-success/10 text-success print-status-have'
        : 'border border-accent/25 bg-accent/15 text-accent print-status-need'
    "
  >
    {{ status === 'have' ? 'HAVE' : 'NEED' }}
  </span>
</template>

<script setup lang="ts">
defineProps<{ status: 'need' | 'have' }>()
</script>
