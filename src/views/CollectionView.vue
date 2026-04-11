<template>
  <div>
    <header>
      <h1>PokeList</h1>
      <div class="subtitle">Track your collection</div>
    </header>

    <ValueChart />

    <div class="search-bar">
      <input
        type="text"
        v-model="searchTerm"
        placeholder="Search by card name..."
        autocomplete="off"
        @keydown.enter="doSearch"
        @input="onSearchInput"
        @blur="onSearchBlur"
      />
      <button @click="doSearch" :disabled="store.searchLoading">Search</button>
    </div>

    <!-- Fuzzy autocomplete from collection -->
    <div class="col-fuzzy-results" v-if="fuzzyResults.length > 0 && showFuzzy">
      <div class="fuzzy-result-list">
        <div
          v-for="result in fuzzyResults"
          :key="result.item.id"
          class="fuzzy-result-item"
          @click="onFuzzyClick(result.item)"
        >
          <img :src="result.item.images?.small || ''" :alt="result.item.name" loading="lazy" />
          <div class="fuzzy-result-info">
            <div class="fuzzy-result-name">
              <template v-for="(seg, i) in getSegments(result)" :key="i">
                <span v-if="seg.highlighted" class="fuzzy-match-char">{{ seg.text }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </div>
            <div class="fuzzy-result-meta">
              {{ result.item.set?.name || 'Unknown' }} &middot; {{ result.item.number || '?' }}/{{ result.item.set?.printedTotal || '?' }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Banners -->
    <div v-if="store.error" class="banner error">{{ store.error }}</div>

    <!-- Spinner -->
    <div class="spinner" :class="{ visible: store.loading || store.searchLoading }"></div>

    <!-- Collection section -->
    <div v-if="!store.loading">
      <div v-if="store.collectionCards.length === 0" class="empty-state">
        <span class="empty-icon">&#x1F0CF;</span>
        <div>Your collection is empty</div>
        <div class="empty-hint">Search for cards below to start adding to your collection</div>
      </div>
      <template v-else>
        <div class="section-header">
          <span class="section-title">Your Collection ({{ store.collectionCards.length }} cards)</span>
        </div>
        <CardGrid>
          <CardTile
            v-for="(card, i) in store.collectionCards"
            :key="card.id"
            :card="card"
            :index="i"
            @toggle-owned="onCollectionToggle(card)"
          />
        </CardGrid>
      </template>
    </div>

    <!-- Search results section -->
    <div v-if="store.searchResults.length > 0">
      <div class="section-header">
        <span class="section-title">Search Results ({{ store.searchResults.length }})</span>
        <button class="btn btn-small btn-surface" @click="clearResults">Clear results</button>
      </div>
      <CardGrid>
        <CardTile
          v-for="(card, i) in store.searchResults"
          :key="card.id"
          :card="card"
          :index="i"
          @toggle-owned="onSearchToggle(card)"
        />
      </CardGrid>
    </div>
    <div v-if="searchDone && store.searchResults.length === 0 && !store.searchLoading" class="empty-state">
      <span class="empty-icon">&#x1F50D;</span>
      <div>No cards found</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useCollectionStore } from '@/stores/useCollectionStore'
import { fuzzyFilter, getHighlightSegments, type FuzzyFilterResult } from '@/lib/fuzzy'
import type { Card } from '@/lib/types'
import ValueChart from '@/components/ValueChart.vue'
import CardGrid from '@/components/CardGrid.vue'
import CardTile from '@/components/CardTile.vue'
import { inject } from 'vue'

const store = useCollectionStore()
const openLightbox = inject<(src: string) => void>('openLightbox')

const searchTerm = ref('')
const searchDone = ref(false)
const showFuzzy = ref(false)
const fuzzyResults = ref<FuzzyFilterResult<Card>[]>([])
let collectionLoaded = false

onMounted(async () => {
  if (!collectionLoaded && store.collectionCards.length === 0) {
    collectionLoaded = true
    await store.loadCollection()
  }
})

function onSearchInput() {
  const query = searchTerm.value.trim()
  if (!query || store.collectionCards.length === 0) {
    fuzzyResults.value = []
    showFuzzy.value = false
    return
  }
  const matches = fuzzyFilter(query, store.collectionCards, (c) => c.name)
  if (
    matches.length === 0 ||
    (matches.length === store.collectionCards.length && matches[0].score === 0)
  ) {
    fuzzyResults.value = []
    showFuzzy.value = false
    return
  }
  fuzzyResults.value = matches.slice(0, 20)
  showFuzzy.value = true
}

function onSearchBlur() {
  setTimeout(() => {
    showFuzzy.value = false
  }, 200)
}

function getSegments(result: FuzzyFilterResult<Card>) {
  return getHighlightSegments(result.item.name, result.indices)
}

function onFuzzyClick(card: Card) {
  if (openLightbox) {
    openLightbox(card.images?.large || card.images?.small || '')
  }
}

async function doSearch() {
  const term = searchTerm.value.trim()
  if (!term) return
  showFuzzy.value = false
  searchDone.value = true
  await store.searchCards(term)
}

function clearResults() {
  store.clearSearchResults()
  searchTerm.value = ''
  searchDone.value = false
}

function onCollectionToggle(card: Card) {
  setTimeout(() => {
    if (!store.isOwned(card.id)) {
      store.removeCardFromCollection(card.id)
    }
    store.recalculateValue()
  }, 100)
}

function onSearchToggle(card: Card) {
  setTimeout(() => {
    if (store.isOwned(card.id)) {
      store.addCardToCollection(card)
    } else {
      store.removeCardFromCollection(card.id)
    }
    store.recalculateValue()
  }, 100)
}
</script>
