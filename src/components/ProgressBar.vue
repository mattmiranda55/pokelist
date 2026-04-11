<template>
  <div class="ms-progress-bar">
    <div class="ms-progress-fill" :style="{ width: `${value}%` }"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: number }>()
</script>
