<template>
  <div>
    <header
      class="print-hide bg-gradient-to-b from-accent/10 to-transparent px-4 pt-[1.2rem] pb-[0.8rem] text-center"
    >
      <h1
        class="h-gradient text-[1.5rem] font-extrabold tracking-[-0.02em] max-[500px]:text-[1.25rem]"
      >
        PokeList
      </h1>
      <div
        class="mt-[0.15rem] text-[0.7rem] font-medium uppercase tracking-[0.05em] text-text-muted"
      >
        Track your collection
      </div>
    </header>

    <ValueChart />

    <div class="print-hide mx-auto mt-2 flex max-w-[600px] gap-2 px-4">
      <input
        type="text"
        v-model="searchTerm"
        placeholder="Search by card name..."
        autocomplete="off"
        @keydown.enter="doSearch"
        @input="onSearchInput"
        @blur="onSearchBlur"
        class="min-h-[44px] flex-1 rounded-[10px] border border-border bg-surface px-[0.9rem] py-[0.7rem] text-[0.95rem] text-text shadow-sm transition-all duration-150 focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,69,96,0.2)]"
      />
      <button
        @click="doSearch"
        :disabled="store.searchLoading"
        class="min-h-[44px] whitespace-nowrap rounded-[10px] bg-accent px-[1.2rem] py-[0.7rem] text-[0.9rem] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-accent-hover active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 disabled:transform-none"
      >
        Search
      </button>
    </div>

    <!-- Fuzzy autocomplete from collection -->
    <div
      v-if="fuzzyResults.length > 0 && showFuzzy"
      class="mx-auto mt-1 max-w-[600px] px-4"
    >
      <div
        class="max-h-[280px] overflow-y-auto rounded-[10px] border border-border bg-surface shadow-md"
      >
        <div
          v-for="result in fuzzyResults"
          :key="result.item.id"
          class="flex cursor-pointer items-center gap-[0.6rem] border-b border-border/40 p-[0.45rem_0.7rem] transition-colors duration-150 last:border-b-0 hover:bg-surface2"
          @click="onFuzzyClick(result.item)"
        >
          <img
            :src="result.item.images?.small || ''"
            :alt="result.item.name"
            loading="lazy"
            class="h-11 w-8 flex-shrink-0 rounded-[3px] object-contain"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[0.82rem] font-semibold">
              <template v-for="(seg, i) in getSegments(result)" :key="i">
                <span v-if="seg.highlighted" class="font-bold text-accent">{{ seg.text }}</span>
                <template v-else>{{ seg.text }}</template>
              </template>
            </div>
            <div class="truncate text-[0.68rem] text-text-muted">
              {{ result.item.set?.name || 'Unknown' }} &middot; {{ result.item.number || '?' }}/{{
                result.item.set?.printedTotal || '?'
              }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Banners -->
    <div
      v-if="store.error"
      class="animate-banner-in mx-auto my-2 max-w-[600px] rounded-[10px] border border-[rgba(251,187,187,0.15)] bg-[#5c1a1a] px-4 py-[0.65rem] text-center text-[0.82rem] text-[#fbb]"
    >
      {{ store.error }}
    </div>

    <!-- Spinner -->
    <div
      v-if="store.loading || store.searchLoading"
      class="spinner block py-12 text-center"
    ></div>

    <!-- Collection section -->
    <div v-if="!store.loading">
      <div
        v-if="store.collectionCards.length === 0"
        class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
      >
        <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F0CF;</span>
        <div>Your collection is empty</div>
        <div class="mt-1 text-[0.78rem] opacity-60">
          Search for cards below to start adding to your collection
        </div>
      </div>
      <template v-else>
        <div
          class="mx-auto mt-3 flex max-w-[1200px] items-center justify-between gap-2 px-4 pb-1"
        >
          <span
            class="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
            >Your Collection ({{ store.collectionCards.length }} cards)</span
          >
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
      <div
        class="mx-auto mt-3 flex max-w-[1200px] items-center justify-between gap-2 px-4 pb-1"
      >
        <span
          class="text-[0.78rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
          >Search Results ({{ store.searchResults.length }})</span
        >
        <button
          class="min-h-[34px] whitespace-nowrap rounded-[10px] border border-border bg-surface px-[0.7rem] py-[0.4rem] text-[0.78rem] font-medium text-text shadow-sm transition-colors duration-150 hover:bg-surface2"
          @click="clearResults"
        >
          Clear results
        </button>
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
    <div
      v-if="searchDone && store.searchResults.length === 0 && !store.searchLoading"
      class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
    >
      <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F50D;</span>
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
