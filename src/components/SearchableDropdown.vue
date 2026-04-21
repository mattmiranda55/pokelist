<template>
  <div class="relative flex-1" ref="wrapRef">
    <input
      type="text"
      v-model="query"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="showList"
      @input="onInput"
      @keydown="onKeydown"
      class="min-h-[44px] w-full rounded-[10px] border border-border bg-surface px-[0.9rem] py-[0.7rem] text-[0.9rem] text-text shadow-sm transition-all duration-150 focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,69,96,0.2)]"
    />
    <div
      v-if="isOpen"
      class="absolute left-0 right-0 top-full z-[100] max-h-[260px] overflow-y-auto rounded-b-[10px] border border-t-0 border-border bg-surface shadow-md"
    >
      <div
        v-if="filteredItems.length === 0"
        class="p-[0.7rem_0.9rem] text-center text-[0.82rem] text-text-muted"
      >
        No results found
      </div>
      <div
        v-for="(result, idx) in filteredItems"
        :key="getKey(result.item)"
        class="cursor-pointer border-b border-border/40 p-[0.55rem_0.9rem] text-[0.85rem] leading-[1.35] transition-colors duration-150 last:border-b-0 hover:bg-surface2"
        :class="{ 'bg-surface2': idx === highlightIdx }"
        @click="selectItem(result)"
      >
        <span>
          <template v-for="(seg, si) in getSegments(result)" :key="si">
            <span v-if="seg.highlighted" class="font-bold text-accent">{{ seg.text }}</span>
            <template v-else>{{ seg.text }}</template>
          </template>
        </span>
        <span v-if="getMeta" class="ml-[0.3rem] text-[0.72rem] text-text-muted">{{
          getMeta(result.item)
        }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fuzzyFilter, getHighlightSegments, type FuzzyFilterResult } from '@/lib/fuzzy'

const props = defineProps<{
  items: any[]
  getLabel: (item: any) => string
  getMeta?: (item: any) => string
  getKey?: (item: any) => string
  placeholder: string
  searchText?: (item: any) => string
}>()

const emit = defineEmits<{
  select: [item: any]
}>()

const query = ref('')
const isOpen = ref(false)
const highlightIdx = ref(-1)
const wrapRef = ref<HTMLElement | null>(null)

function getKey(item: any): string {
  if (props.getKey) return props.getKey(item)
  return props.getLabel(item)
}

const filteredItems = computed<FuzzyFilterResult<any>[]>(() => {
  const getText = props.searchText || props.getLabel
  const q = query.value.trim()
  if (!q) {
    return props.items.slice(0, 50).map((item) => ({ item, score: 0, indices: [] }))
  }
  return fuzzyFilter(q, props.items, getText).slice(0, 50)
})

function getSegments(result: FuzzyFilterResult<any>) {
  const label = props.getLabel(result.item)
  const labelIndices = result.indices.filter((i) => i < label.length)
  return getHighlightSegments(label, labelIndices)
}

function showList() {
  isOpen.value = true
  highlightIdx.value = -1
}

function onInput() {
  isOpen.value = true
  highlightIdx.value = -1
}

function onKeydown(e: KeyboardEvent) {
  const len = filteredItems.value.length
  if (!len) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    highlightIdx.value = Math.min(highlightIdx.value + 1, len - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    highlightIdx.value = Math.max(highlightIdx.value - 1, 0)
  } else if (e.key === 'Enter') {
    e.preventDefault()
    if (highlightIdx.value >= 0 && filteredItems.value[highlightIdx.value]) {
      selectItem(filteredItems.value[highlightIdx.value])
    }
  } else if (e.key === 'Escape') {
    isOpen.value = false
  }
}

function selectItem(result: FuzzyFilterResult<any>) {
  const label = props.getLabel(result.item)
  const meta = props.getMeta ? props.getMeta(result.item) : ''
  query.value = label + (meta ? ` ${meta}` : '')
  isOpen.value = false
  emit('select', result.item)
}

function onClickOutside(e: MouseEvent) {
  if (wrapRef.value && !wrapRef.value.contains(e.target as Node)) {
    isOpen.value = false
  }
}

function reset() {
  query.value = ''
  isOpen.value = false
  highlightIdx.value = -1
}

onMounted(() => {
  document.addEventListener('click', onClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', onClickOutside)
})

defineExpose({ reset })
</script>
