<template>
  <div class="fuzzy-dropdown-wrap" ref="wrapRef">
    <input
      type="text"
      v-model="query"
      :placeholder="placeholder"
      autocomplete="off"
      @focus="showList"
      @input="onInput"
      @keydown="onKeydown"
    />
    <div class="fuzzy-dropdown-list" :class="{ open: isOpen }">
      <div
        v-if="filteredItems.length === 0"
        class="fuzzy-dropdown-empty"
      >
        No results found
      </div>
      <div
        v-for="(result, idx) in filteredItems"
        :key="getKey(result.item)"
        class="fuzzy-dropdown-item"
        :class="{ highlighted: idx === highlightIdx }"
        @click="selectItem(result)"
      >
        <span>
          <template v-for="(seg, si) in getSegments(result)" :key="si">
            <span v-if="seg.highlighted" class="fuzzy-match-char">{{ seg.text }}</span>
            <template v-else>{{ seg.text }}</template>
          </template>
        </span>
        <span v-if="getMeta" class="fuzzy-meta">{{ getMeta(result.item) }}</span>
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
  // Only highlight indices within the label portion
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
