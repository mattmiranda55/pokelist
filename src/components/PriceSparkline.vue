<template>
  <div class="sparkline-wrap" v-if="values.length >= 2">
    <svg :viewBox="`0 0 ${w} ${h}`" preserveAspectRatio="none">
      <polyline
        :points="points"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ values: number[] }>()

const w = 100
const h = 20

const points = computed(() => {
  if (props.values.length < 2) return ''
  const min = Math.min(...props.values)
  const max = Math.max(...props.values)
  const range = max - min || 1
  return props.values
    .map((v, i) => {
      const x = (i / (props.values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

const color = computed(() => {
  if (props.values.length < 2) return 'var(--success)'
  return props.values[props.values.length - 1] >= props.values[0]
    ? 'var(--success)'
    : 'var(--accent)'
})
</script>
