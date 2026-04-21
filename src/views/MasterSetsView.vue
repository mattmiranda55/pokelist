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
        Master Set Checklists
      </div>
    </header>

    <div
      v-if="errorMsg"
      class="animate-banner-in mx-auto my-2 max-w-[600px] rounded-[10px] border border-[rgba(254,235,187,0.15)] bg-[#5c4a1a] px-4 py-[0.65rem] text-center text-[0.82rem] text-[#feb]"
    >
      {{ errorMsg }}
    </div>
    <div v-if="setsStore.loading" class="spinner block py-12 text-center"></div>

    <!-- Level 1: Set List -->
    <div v-if="!detailSetId">
      <div class="print-hide mx-auto my-2 flex max-w-[600px] gap-2 px-4">
        <SearchableDropdown
          ref="dropdownRef"
          :items="reversedSets"
          :get-label="(s: any) => s.name"
          :get-meta="(s: any) => `(${s.releaseDate ? s.releaseDate.slice(0, 4) : '?'}) \u2014 ${s.total || '?'} cards`"
          :get-key="(s: any) => s.id"
          :search-text="(s: any) => `${s.name} ${s.releaseDate ? s.releaseDate.slice(0, 4) : ''}`"
          :placeholder="setsStore.sets.length > 0 ? `Search ${setsStore.sets.length} sets...` : 'Loading sets...'"
          @select="onDropdownSelect"
        />
        <button
          class="min-h-[44px] whitespace-nowrap rounded-[10px] bg-accent px-[1.2rem] py-[0.7rem] text-[0.9rem] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-accent-hover active:scale-[0.96]"
          @click="addSet"
        >
          Add Set
        </button>
      </div>

      <div
        v-if="setsStore.trackedSetIds.length > 0"
        class="mx-auto my-2 flex max-w-[600px] flex-col gap-2 px-4"
      >
        <div
          v-for="setId in setsStore.trackedSetIds"
          :key="setId"
          class="flex min-h-[44px] items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-[0.8rem] shadow-sm transition-transform duration-150 active:scale-[0.98]"
        >
          <div class="flex-1 cursor-pointer" @click="openDetail(setId)">
            <div class="text-[0.9rem] font-semibold">{{ getSetName(setId) }}</div>
            <div class="mt-[0.1rem] text-[0.72rem] text-text-muted">{{ getSetYear(setId) }}</div>
            <div class="mt-1 text-[0.75rem] text-text-muted">
              {{ getOwnedCount(setId) }} / {{ getSetTotal(setId) }} owned
            </div>
            <ProgressBar :value="getProgressPct(setId)" />
          </div>
          <button
            class="min-h-[32px] rounded-md border border-border bg-transparent px-2 py-[0.3rem] text-[0.7rem] text-text-muted transition-colors duration-150 hover:border-accent hover:text-accent"
            @click.stop="removeSet(setId)"
          >
            Remove
          </button>
        </div>
      </div>

      <div
        v-if="setsStore.trackedSetIds.length === 0"
        class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
      >
        <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F4CB;</span>
        <div>No tracked sets yet</div>
        <div class="mt-1 text-[0.78rem] opacity-60">
          Select a set above and tap "Add Set" to start tracking
        </div>
      </div>
    </div>

    <!-- Level 2: Set Detail -->
    <div v-if="detailSetId">
      <div class="mx-auto max-w-[800px] px-4 py-2">
        <button
          class="print-hide flex min-h-[44px] items-center gap-1 py-[0.4rem] text-[0.85rem] font-medium text-accent"
          @click="goBack"
        >
          &larr; Back to Sets
        </button>
        <div class="mt-[0.3rem] text-[1.15rem] font-bold print-detail-title">
          {{ detailTitle }}
        </div>
        <div class="mt-[0.15rem] text-[0.82rem] text-text-muted print-detail-stats">
          {{ detailStats }}
        </div>
      </div>

      <div
        class="print-hide mx-auto my-2 flex max-w-[800px] flex-wrap items-center gap-[0.4rem] px-4"
      >
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
        <button
          class="min-h-[34px] rounded-[10px] border border-border bg-surface px-[0.7rem] py-[0.4rem] text-[0.78rem] font-medium text-text shadow-sm transition-colors duration-150 hover:bg-surface2"
          @click="printPage"
        >
          Print
        </button>
      </div>

      <div class="print-hide mx-auto mt-1 max-w-[800px] px-4">
        <input
          type="text"
          v-model="detailSearchQuery"
          placeholder="Filter cards by name..."
          autocomplete="off"
          class="min-h-[38px] w-full rounded-[10px] border border-border bg-surface px-[0.8rem] py-[0.55rem] text-[0.85rem] text-text shadow-sm transition-all duration-150 focus:border-accent focus:outline-none focus:shadow-[0_0_0_3px_rgba(233,69,96,0.2)]"
        />
      </div>

      <div v-if="detailLoading" class="spinner block py-12 text-center"></div>

      <div v-if="!detailLoading" class="mx-auto max-w-[800px] px-4 pb-8">
        <div
          v-if="filteredCards.length === 0"
          class="px-6 py-12 text-center text-[0.9rem] text-text-muted"
        >
          <template v-if="currentFilter === 'need'">
            <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F389;</span>
            <div>You own every card in this set!</div>
          </template>
          <template v-else>
            <span class="mb-[0.6rem] block text-[2.5rem] opacity-50">&#x1F50D;</span>
            <div>No cards match this filter</div>
          </template>
        </div>
        <table
          v-else
          class="checklist-table w-full border-collapse text-[0.82rem]"
        >
          <thead>
            <tr>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              >
                #
              </th>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              ></th>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              >
                Name
              </th>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              >
                Rarity
              </th>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              >
                Status
              </th>
              <th
                class="sticky top-0 z-10 border-b-2 border-border bg-bg px-[0.55rem] py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-text-muted"
              >
                Own
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredCards"
              :key="item.card.id"
              class="border-b border-border transition-colors duration-150 hover:bg-white/[0.03]"
              :class="{ 'row-owned opacity-[0.45]': collectionStore.isOwned(item.card.id) }"
            >
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                {{ item.card.number || '?' }}
              </td>
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                <img
                  class="h-14 w-10 cursor-pointer rounded object-contain align-middle"
                  :src="item.card.images?.small || ''"
                  :alt="item.card.name"
                  loading="lazy"
                  @click="onThumbClick(item.card)"
                />
              </td>
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                <template v-for="(seg, si) in item.segments" :key="si">
                  <span v-if="seg.highlighted" class="font-bold text-accent">{{ seg.text }}</span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </td>
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                {{ item.card.rarity || 'Unknown' }}
              </td>
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                <StatusBadge :status="collectionStore.isOwned(item.card.id) ? 'have' : 'need'" />
              </td>
              <td class="px-[0.55rem] py-[0.4rem] align-middle">
                <input
                  type="checkbox"
                  class="print-hide h-5 w-5 cursor-pointer accent-success"
                  :checked="collectionStore.isOwned(item.card.id)"
                  @change="onChecklistToggle(item.card, $event)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import { useSetsStore } from '@/stores/useSetsStore'
import { useCollectionStore } from '@/stores/useCollectionStore'
import { fuzzyFilter, getHighlightSegments, type HighlightSegment } from '@/lib/fuzzy'
import type { Card } from '@/lib/types'
import SearchableDropdown from '@/components/SearchableDropdown.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import StatusBadge from '@/components/StatusBadge.vue'

const setsStore = useSetsStore()
const collectionStore = useCollectionStore()
const openLightbox = inject<(src: string) => void>('openLightbox')

const dropdownRef = ref<InstanceType<typeof SearchableDropdown> | null>(null)
const selectedSetId = ref('')
const errorMsg = ref('')
const detailSetId = ref<string | null>(null)
const currentFilter = ref<'all' | 'need' | 'have'>('all')
const detailSearchQuery = ref('')
const detailLoading = ref(false)
const detailCards = ref<Card[]>([])
const filters = ['all', 'need', 'have'] as const

const reversedSets = computed(() => setsStore.sets.slice().reverse())

function onDropdownSelect(item: any) {
  selectedSetId.value = item.id
}

function getSetName(id: string): string {
  return setsStore.getSetInfo(id)?.name || id
}

function getSetYear(id: string): string {
  const info = setsStore.getSetInfo(id)
  return info?.releaseDate ? info.releaseDate.slice(0, 4) : '?'
}

function getSetTotal(id: string): number {
  return setsStore.getSetInfo(id)?.total || 0
}

function getOwnedCount(id: string): number {
  let count = 0
  const cached = setsStore.getSetCacheSync(id)
  if (cached) {
    cached.cards.forEach((c) => {
      if (collectionStore.isOwned(c.id)) count++
    })
  } else {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(`ptcg-owned-${id}-`)) count++
    }
  }
  return count
}

function getProgressPct(id: string): number {
  const total = getSetTotal(id)
  if (total <= 0) return 0
  return (getOwnedCount(id) / total) * 100
}

function addSet() {
  if (!selectedSetId.value) return
  const added = setsStore.addTrackedSet(selectedSetId.value)
  if (!added) {
    errorMsg.value = 'Set already tracked.'
    setTimeout(() => (errorMsg.value = ''), 3000)
    return
  }
  errorMsg.value = ''
  selectedSetId.value = ''
  if (dropdownRef.value) dropdownRef.value.reset()
}

function removeSet(id: string) {
  const info = setsStore.getSetInfo(id)
  if (confirm(`Remove "${info?.name || id}" from tracked sets?`)) {
    setsStore.removeTrackedSet(id)
  }
}

async function openDetail(setId: string) {
  detailSetId.value = setId
  currentFilter.value = 'all'
  detailSearchQuery.value = ''
  detailLoading.value = true
  try {
    detailCards.value = await setsStore.getSetCards(setId)
  } catch (err: any) {
    errorMsg.value = err.message
  } finally {
    detailLoading.value = false
  }
}

function goBack() {
  detailSetId.value = null
}

const detailTitle = computed(() => {
  if (!detailSetId.value) return ''
  const info = setsStore.getSetInfo(detailSetId.value)
  const year = info?.releaseDate ? info.releaseDate.slice(0, 4) : '?'
  return `${info?.name || detailSetId.value} (${year})`
})

const detailStats = computed(() => {
  let ownedCount = 0
  detailCards.value.forEach((c) => {
    if (collectionStore.isOwned(c.id)) ownedCount++
  })
  const needCount = detailCards.value.length - ownedCount
  return `${ownedCount} / ${detailCards.value.length} owned \u00B7 ${needCount} needed`
})

interface FilteredCardItem {
  card: Card
  segments: HighlightSegment[]
}

const filteredCards = computed<FilteredCardItem[]>(() => {
  let cards = detailCards.value
  if (currentFilter.value === 'need') {
    cards = cards.filter((c) => !collectionStore.isOwned(c.id))
  } else if (currentFilter.value === 'have') {
    cards = cards.filter((c) => collectionStore.isOwned(c.id))
  }

  if (detailSearchQuery.value.trim()) {
    const results = fuzzyFilter(detailSearchQuery.value.trim(), cards, (c) => c.name)
    return results.map((r) => ({
      card: r.item,
      segments: getHighlightSegments(r.item.name, r.indices),
    }))
  }

  return cards.map((card) => ({
    card,
    segments: [{ text: card.name, highlighted: false }],
  }))
})

function onThumbClick(card: Card) {
  if (openLightbox) {
    openLightbox(card.images?.large || card.images?.small || '')
  }
}

function onChecklistToggle(card: Card, e: Event) {
  const checked = (e.target as HTMLInputElement).checked
  collectionStore.setOwned(card.id, checked)
}

function printPage() {
  window.print()
}
</script>
