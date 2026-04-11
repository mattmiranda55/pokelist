<template>
  <div>
    <header>
      <h1>PokeList</h1>
      <div class="subtitle">Master Set Checklists</div>
    </header>

    <div v-if="errorMsg" class="banner warning">{{ errorMsg }}</div>
    <div class="spinner" :class="{ visible: setsStore.loading }"></div>

    <!-- Level 1: Set List -->
    <div v-if="!detailSetId">
      <div class="ms-add-bar">
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
        <button class="btn" @click="addSet">Add Set</button>
      </div>

      <div class="ms-set-list" v-if="setsStore.trackedSetIds.length > 0">
        <div
          v-for="setId in setsStore.trackedSetIds"
          :key="setId"
          class="ms-set-card"
        >
          <div class="ms-info" @click="openDetail(setId)">
            <div class="ms-name">{{ getSetName(setId) }}</div>
            <div class="ms-year">{{ getSetYear(setId) }}</div>
            <div class="ms-progress-text">{{ getOwnedCount(setId) }} / {{ getSetTotal(setId) }} owned</div>
            <ProgressBar :value="getProgressPct(setId)" />
          </div>
          <button class="ms-remove-btn" @click.stop="removeSet(setId)">Remove</button>
        </div>
      </div>

      <div v-if="setsStore.trackedSetIds.length === 0" class="empty-state">
        <span class="empty-icon">&#x1F4CB;</span>
        <div>No tracked sets yet</div>
        <div class="empty-hint">Select a set above and tap "Add Set" to start tracking</div>
      </div>
    </div>

    <!-- Level 2: Set Detail -->
    <div v-if="detailSetId">
      <div class="ms-detail-header">
        <button class="ms-back-btn" @click="goBack">&larr; Back to Sets</button>
        <div class="ms-detail-title">{{ detailTitle }}</div>
        <div class="ms-detail-stats">{{ detailStats }}</div>
      </div>

      <div class="ms-filter-bar">
        <button
          v-for="f in filters"
          :key="f"
          class="filter-btn"
          :class="{ active: currentFilter === f }"
          @click="currentFilter = f"
        >{{ f === 'all' ? 'All' : f === 'need' ? 'Need' : 'Have' }}</button>
        <button class="btn btn-small" @click="printPage">Print</button>
      </div>

      <div class="ms-detail-search">
        <input
          type="text"
          v-model="detailSearchQuery"
          placeholder="Filter cards by name..."
          autocomplete="off"
        />
      </div>

      <div class="spinner" :class="{ visible: detailLoading }"></div>

      <div class="checklist-table-wrap" v-if="!detailLoading">
        <div v-if="filteredCards.length === 0" class="empty-state">
          <template v-if="currentFilter === 'need'">
            <span class="empty-icon">&#x1F389;</span>
            <div>You own every card in this set!</div>
          </template>
          <template v-else>
            <span class="empty-icon">&#x1F50D;</span>
            <div>No cards match this filter</div>
          </template>
        </div>
        <table v-else class="checklist-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>Name</th>
              <th>Rarity</th>
              <th>Status</th>
              <th>Own</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in filteredCards"
              :key="item.card.id"
              :class="{ 'row-owned': collectionStore.isOwned(item.card.id) }"
            >
              <td>{{ item.card.number || '?' }}</td>
              <td>
                <img
                  class="card-thumb"
                  :src="item.card.images?.small || ''"
                  :alt="item.card.name"
                  loading="lazy"
                  @click="onThumbClick(item.card)"
                />
              </td>
              <td>
                <template v-for="(seg, si) in item.segments" :key="si">
                  <span v-if="seg.highlighted" class="fuzzy-match-char">{{ seg.text }}</span>
                  <template v-else>{{ seg.text }}</template>
                </template>
              </td>
              <td>{{ item.card.rarity || 'Unknown' }}</td>
              <td>
                <StatusBadge :status="collectionStore.isOwned(item.card.id) ? 'have' : 'need'" />
              </td>
              <td>
                <input
                  type="checkbox"
                  class="own-checkbox"
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
