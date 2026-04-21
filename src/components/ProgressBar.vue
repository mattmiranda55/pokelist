<template>
  <div class="mt-1.5 h-1 w-full overflow-hidden rounded-[2px] bg-border">
    <div
      class="h-full rounded-[2px] bg-success transition-[width] duration-300 ease-out"
      :style="{ width: `${value}%` }"
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ value: number }>()
</script>
