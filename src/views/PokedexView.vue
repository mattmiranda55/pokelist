<template>
  <div>
    <header>
      <h1>PokeList</h1>
      <div class="subtitle">Track Every Card of a Pok&eacute;mon</div>
    </header>

    <div v-if="errorMsg" class="banner warning">{{ errorMsg }}</div>
    <div class="spinner" :class="{ visible: pokedexStore.loading }"></div>

    <!-- Level 1: Pokemon List -->
    <div v-if="!detailName">
      <div class="pk-add-bar" style="position:relative;">
        <div style="flex:1;position:relative;">
          <input
            style="width:100%"
            ref="nameInputEl"
            type="text"
            v-model="nameInput"
            placeholder="Pok&eacute;mon name (e.g. Charizard)"
            autocomplete="off"
            @input="onInputChange"
            @keydown.enter.prevent="onEnter"
            @keydown.down.prevent="highlightNext"
            @keydown.up.prevent="highlightPrev"
            @keydown.escape="closeSuggestions"
            @focus="onInputChange"
            @blur="onBlur"
          />
          <div v-if="showSuggestions && suggestions.length > 0" class="pk-suggestions">
            <div
              v-for="(s, i) in suggestions"
              :key="s.item"
              class="pk-suggestion-item"
              :class="{ highlighted: i === highlightIdx }"
              @mousedown.prevent="selectSuggestion(s.item)"
            >
              <span v-for="(seg, j) in getHighlightSegments(s.item, s.indices)" :key="j">
                <span v-if="seg.highlighted" class="fuzzy-match-char">{{ seg.text }}</span>
                <span v-else>{{ seg.text }}</span>
              </span>
            </div>
          </div>
        </div>
        <button class="btn" @click="addPokemon">Track Pok&eacute;mon</button>
      </div>

      <div class="pk-pokemon-list" v-if="pokedexStore.trackedPokemon.length > 0">
        <div
          v-for="name in pokedexStore.trackedPokemon"
          :key="name"
          class="ms-set-card"
        >
          <div class="ms-info" @click="openDetail(name)">
            <div class="ms-name">{{ name }}</div>
            <div class="ms-progress-text">
              {{ getOwnedCount(name) }} / {{ getTotalCount(name) }} cards owned{{ getTotalCount(name) === 0 ? ' (tap to load)' : '' }}
            </div>
            <ProgressBar :value="getProgressPct(name)" />
          </div>
          <button class="ms-remove-btn" @click.stop="removePokemon(name)">Remove</button>
        </div>
      </div>

      <div v-if="pokedexStore.trackedPokemon.length === 0" class="empty-state">
        <span class="empty-icon">&#x1F50E;</span>
        <div>No tracked Pok&eacute;mon yet</div>
        <div class="empty-hint">Type a Pok&eacute;mon name above and tap "Track Pok&eacute;mon"</div>
      </div>
    </div>

    <!-- Level 2: Pokemon Detail -->
    <div v-if="detailName">
      <div class="ms-detail-header">
        <button class="ms-back-btn" @click="goBack">&larr; Back to Pok&eacute;mon</button>
        <div class="ms-detail-title">{{ detailName }}</div>
        <div class="ms-detail-stats">{{ detailStatsText }}</div>
      </div>

      <div class="ms-filter-bar">
        <button
          v-for="f in filters"
          :key="f"
          class="filter-btn"
          :class="{ active: currentFilter === f }"
          @click="currentFilter = f"
        >{{ f === 'all' ? 'All' : f === 'need' ? 'Need' : 'Have' }}</button>
      </div>

      <div class="spinner" :class="{ visible: detailLoading }"></div>

      <div v-if="!detailLoading" style="max-width:1200px;margin:0 auto;padding:0 1rem 1rem;">
        <div v-if="filteredCards.length === 0" class="empty-state">
          <template v-if="currentFilter === 'need'">
            <span class="empty-icon">&#x1F389;</span>
            <div>You own every card of this Pok&eacute;mon!</div>
          </template>
          <template v-else>
            <span class="empty-icon">&#x1F50D;</span>
            <div>No cards match this filter</div>
          </template>
        </div>
        <CardGrid v-else>
          <CardTile
            v-for="(card, i) in filteredCards"
            :key="card.id"
            :card="card"
            :index="i"
            :show-pricing="false"
            :show-grading="false"
            :show-status="true"
            @toggle-owned="onDetailToggle"
          />
        </CardGrid>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePokedexStore } from '@/stores/usePokedexStore'
import { useCollectionStore } from '@/stores/useCollectionStore'
import { fuzzyFilter, getHighlightSegments } from '@/lib/fuzzy'
import type { Card } from '@/lib/types'
import type { FuzzyFilterResult } from '@/lib/fuzzy'
import CardGrid from '@/components/CardGrid.vue'
import CardTile from '@/components/CardTile.vue'
import ProgressBar from '@/components/ProgressBar.vue'

const pokedexStore = usePokedexStore()
const collectionStore = useCollectionStore()

const nameInput = ref('')
const nameInputEl = ref<HTMLInputElement | null>(null)
const errorMsg = ref('')

// Fuzzy autocomplete state
const allPokemonNames = ref<string[]>([])
const showSuggestions = ref(false)
const highlightIdx = ref(-1)

onMounted(async () => {
  try {
    const res = await fetch('/pokemon-names.json')
    allPokemonNames.value = await res.json()
  } catch { /* fail silently */ }
})

const suggestions = computed<FuzzyFilterResult<string>[]>(() => {
  const q = nameInput.value.trim()
  if (!q || q.length < 1) return []
  return fuzzyFilter(q, allPokemonNames.value, (n) => n).slice(0, 20)
})

function onInputChange() {
  showSuggestions.value = true
  highlightIdx.value = -1
}

function closeSuggestions() {
  showSuggestions.value = false
  highlightIdx.value = -1
}

function onBlur() {
  // Delay to allow mousedown on suggestion to fire first
  setTimeout(() => { showSuggestions.value = false }, 150)
}

function highlightNext() {
  if (suggestions.value.length === 0) return
  highlightIdx.value = (highlightIdx.value + 1) % suggestions.value.length
}

function highlightPrev() {
  if (suggestions.value.length === 0) return
  highlightIdx.value = highlightIdx.value <= 0 ? suggestions.value.length - 1 : highlightIdx.value - 1
}

function selectSuggestion(name: string) {
  nameInput.value = name
  showSuggestions.value = false
  highlightIdx.value = -1
  addPokemon()
}

function onEnter() {
  if (highlightIdx.value >= 0 && highlightIdx.value < suggestions.value.length) {
    selectSuggestion(suggestions.value[highlightIdx.value].item)
  } else {
    addPokemon()
  }
}
const detailName = ref<string | null>(null)
const currentFilter = ref<'all' | 'need' | 'have'>('all')
const detailLoading = ref(false)
const detailCards = ref<Card[]>([])
const filters = ['all', 'need', 'have'] as const

function getTotalCount(name: string): number {
  const cached = pokedexStore.getPokemonCacheSync(name)
  return cached ? cached.cards.length : 0
}

function getOwnedCount(name: string): number {
  const cached = pokedexStore.getPokemonCacheSync(name)
  if (!cached) return 0
  let count = 0
  cached.cards.forEach((c) => {
    if (collectionStore.isOwned(c.id)) count++
  })
  return count
}

function getProgressPct(name: string): number {
  const total = getTotalCount(name)
  if (total <= 0) return 0
  return (getOwnedCount(name) / total) * 100
}

function addPokemon() {
  const name = nameInput.value.trim()
  if (!name) return
  const added = pokedexStore.addTrackedPokemon(name)
  if (!added) {
    errorMsg.value = `"${name}" is already tracked.`
    setTimeout(() => (errorMsg.value = ''), 3000)
    return
  }
  errorMsg.value = ''
  nameInput.value = ''
}

function removePokemon(name: string) {
  if (confirm(`Remove "${name}" from tracked Pok\u00e9mon?`)) {
    pokedexStore.removeTrackedPokemon(name)
  }
}

async function openDetail(name: string) {
  detailName.value = name
  currentFilter.value = 'all'
  detailLoading.value = true
  try {
    detailCards.value = await pokedexStore.getPokemonCards(name)
  } catch (err: any) {
    errorMsg.value = err.message
  } finally {
    detailLoading.value = false
  }
}

function goBack() {
  detailName.value = null
}

const detailStatsText = computed(() => {
  let ownedCount = 0
  detailCards.value.forEach((c) => {
    if (collectionStore.isOwned(c.id)) ownedCount++
  })
  const needCount = detailCards.value.length - ownedCount
  return `${ownedCount} / ${detailCards.value.length} owned \u00B7 ${needCount} needed`
})

const filteredCards = computed(() => {
  let cards = detailCards.value
  if (currentFilter.value === 'need') {
    cards = cards.filter((c) => !collectionStore.isOwned(c.id))
  } else if (currentFilter.value === 'have') {
    cards = cards.filter((c) => collectionStore.isOwned(c.id))
  }
  return cards
})

function onDetailToggle() {
  // Reactivity handles re-render via computed
}
</script>
