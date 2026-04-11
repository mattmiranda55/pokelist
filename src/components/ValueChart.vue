<template>
  <div class="value-chart-wrap" v-if="history.length > 0">
    <div class="value-chart-label">Collection Value</div>
    <div class="value-chart-header">
      <span class="value-total">{{ currentFormatted }}</span>
      <span class="value-change" :class="changeClass">{{ changeText }}</span>
    </div>
    <svg
      class="value-chart-svg"
      :viewBox="`0 0 ${w} ${h}`"
      preserveAspectRatio="none"
      v-html="svgContent"
    ></svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCollectionStore } from '@/stores/useCollectionStore'
import { formatPrice } from '@/lib/prices'

const store = useCollectionStore()

const history = computed(() => store.getValueHistory())

const w = 400
const h = 80

const currentFormatted = computed(() => {
  if (history.value.length === 0) return '$0.00'
  return formatPrice(history.value[history.value.length - 1].total) || '$0.00'
})

const changeClass = computed(() => {
  if (history.value.length < 2) return 'flat'
  const first = history.value[0].total
  const current = history.value[history.value.length - 1].total
  if (first <= 0) return 'flat'
  const pct = ((current - first) / first) * 100
  if (pct > 0) return 'up'
  if (pct < 0) return 'down'
  return 'flat'
})

const changeText = computed(() => {
  if (history.value.length < 2) return '--'
  const first = history.value[0].total
  const current = history.value[history.value.length - 1].total
  if (first <= 0) return '--'
  const pct = ((current - first) / first * 100).toFixed(1)
  const sign = parseFloat(pct) >= 0 ? '+' : ''
  return `${sign}${pct}%`
})

const svgContent = computed(() => {
  const vals = history.value.map((h) => h.total)
  if (vals.length === 0) return ''

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => {
    const x = vals.length === 1 ? w / 2 : (i / (vals.length - 1)) * w
    const y = h - 4 - ((v - min) / range) * (h - 8)
    return [x, y]
  })

  if (vals.length === 1) {
    const y = h / 2
    return `<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="var(--accent)" stroke-width="2" opacity="0.6"/><circle cx="${w / 2}" cy="${y}" r="3" fill="var(--accent)"/>`
  }

  const linePoints = pts.map((p) => p.join(',')).join(' ')
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`

  return `<defs><linearGradient id="vcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs><polygon points="${areaPoints}" fill="url(#vcg)"/><polyline points="${linePoints}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="3" fill="var(--accent)"/>`
})
</script>
