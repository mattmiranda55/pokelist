<template>
  <span class="status-badge" :class="status">{{ status === 'have' ? 'HAVE' : 'NEED' }}</span>
</template>

<script setup lang="ts">
defineProps<{ status: 'need' | 'have' }>()
</script>
