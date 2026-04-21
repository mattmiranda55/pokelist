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
        Track Every Card of a Pok&eacute;mon
      </div>
    </header>

    <div
      v-if="errorMsg"
      class="animate-banner-in mx-auto my-2 max-w-[600px] rounded-[10px] border border-[rgba(254,235,187,0.15)] bg-[#5c4a1a] px-4 py-[0.65rem] text-center text-[0.82rem] text-[#feb]"
    >
      {{ errorMsg }}
    </div>
    <div v-if="pokedexStore.loading" class="spinner block py-12 text-center"></div>

    <!-- Level 1: Pokemon List -->
    <div v-if="!detailName">
      <div class="relative mx-auto my-2 flex max-w-[600px] gap-2 px-4">
        <div class="relative flex-1">
          <input
            class="min-h-[44px] w-full rounded-[10px] border border-border bg-surface px-[0.9rem] py-[0.7rem] text-[0.9rem] text-text shadow-sm focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,69,96,0.2)]"
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
          <div
            v-if="showSuggestions && suggestions.length > 0"
            class="absolute left-0 right-0 top-full z-[100] max-h-[260px] overflow-y-auto rounded-b-[10px] border border-t-0 border-border bg-surface shadow-lg"
          >
            <div
              v-for="(s, i) in suggestions"
              :key="s.item"
              class="cursor-pointer p-[0.55rem_0.9rem] text-[0.88rem] text-text transition-colors duration-150 hover:bg-surface2"
              :class="{ 'bg-surface2': i === highlightIdx }"
              @mousedown.prevent="selectSuggestion(s.item)"
            >
              <span v-for="(seg, j) in getHighlightSegments(s.item, s.indices)" :key="j">
                <span v-if="seg.highlighted" class="font-bold text-accent">{{ seg.text }}</span>
                <span v-else>{{ seg.text }}</span>
              </span>
            </div>
          </div>
        </div>
        <button
          class="min-h-[44px] whitespace-nowrap rounded-[10px] bg-accent px-[1.2rem] py-[0.7rem] text-[0.9rem] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-accent-hover active:scale-[0.96]"
          @click="addPokemon"
        >
          Track Pok&eacute;mon
        </button>
      </div>

      <div
        v-if="pokedexStore.trackedPokemon.length > 0"
        class="mx-auto my-2 flex max-w-[600px] flex-col gap-2 px-4"
      >
        <div
          v-for="name in pokedexStore.trackedPokemon"
          :key="name"
          class="flex min-h-[44px] items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-[0.8rem] shadow-sm transition-transform duration-150 active:scale-[0.98]"
        >
          <div class="flex-1 cursor-pointer" @click="openDetail(name)">
            <div class="text-[0.9rem] font-semibold">{{ name }}</div>
            <div class="mt-1 text-[0.75rem] text-text-muted">
              {{ getOwnedCount(name) }} / {{ getTotalCount(name) }} cards owned{{
                getTotalCount(name) === 0 ? ' (tap to load)' : ''
              }}
            </div>
            <ProgressBar :value="getProgressPct(name)" />
          </div>
          <button
            class="min-h-[32px] rounded-md border border-border bg-transparent px-2 py-[0.3rem] text-[0.7rem] text-text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
            @click.stop="removePokemon(name)"
          >
            Remove
          </button>
        </div>
      </div>

      <div
        v-if="pokedexStore.trackedPokemon.length === 0"
        class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
      >
        <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F50E;</span>
        <div>No tracked Pok&eacute;mon yet</div>
        <div class="mt-1 text-[0.78rem] opacity-60">
          Type a Pok&eacute;mon name above and tap "Track Pok&eacute;mon"
        </div>
      </div>
    </div>

    <!-- Level 2: Pokemon Detail -->
    <div v-if="detailName">
      <div class="mx-auto max-w-[800px] px-4 py-2">
        <button
          class="flex min-h-[44px] items-center gap-1 py-[0.4rem] text-[0.85rem] font-medium text-accent"
          @click="goBack"
        >
          &larr; Back to Pok&eacute;mon
        </button>
        <div class="mt-[0.3rem] text-[1.15rem] font-bold">{{ detailName }}</div>
        <div class="mt-[0.15rem] text-[0.82rem] text-text-muted">{{ detailStatsText }}</div>
      </div>

      <div class="mx-auto my-2 flex max-w-[800px] flex-wrap items-center gap-[0.4rem] px-4">
        <button
          v-for="f in filters"
          :key="f"
          class="min-h-[36px] cursor-pointer rounded-[10px] border px-[0.85rem] py-[0.45rem] text-[0.78rem] font-medium transition-all duration-150"
          :class="
            currentFilter === f
              ? 'border-accent bg-accent text-white font-semibold'
              : 'border-border bg-surface text-text hover:bg-surface2'
          "
          @click="currentFilter = f"
        >
          {{ f === 'all' ? 'All' : f === 'need' ? 'Need' : 'Have' }}
        </button>
      </div>

      <div v-if="detailLoading" class="spinner block py-12 text-center"></div>

      <div
        v-if="!detailLoading"
        class="relative mx-auto max-w-[1200px] flex-1 px-4 pb-4"
      >
        <div
          v-if="filteredCards.length === 0"
          class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
        >
          <template v-if="currentFilter === 'need'">
            <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F389;</span>
            <div>You own every card of this Pok&eacute;mon!</div>
          </template>
          <template v-else>
            <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F50D;</span>
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

const allPokemonNames = ref<string[]>([])
const showSuggestions = ref(false)
const highlightIdx = ref(-1)

onMounted(async () => {
  try {
    const res = await fetch('/pokemon-names.json')
    allPokemonNames.value = await res.json()
  } catch {
    /* fail silently */
  }
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
  setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

function highlightNext() {
  if (suggestions.value.length === 0) return
  highlightIdx.value = (highlightIdx.value + 1) % suggestions.value.length
}

function highlightPrev() {
  if (suggestions.value.length === 0) return
  highlightIdx.value =
    highlightIdx.value <= 0 ? suggestions.value.length - 1 : highlightIdx.value - 1
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
