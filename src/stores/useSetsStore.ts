import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { SetInfo, Card, SetCache } from '@/lib/types'
import { fetchSets as apiFetchSets, fetchAllCards } from '@/lib/api'
import { sortCards } from '@/lib/sorting'
import { CACHE_TTL } from '@/lib/constants'

export const useSetsStore = defineStore('sets', () => {
  const sets = ref<SetInfo[]>([])
  const setsLoaded = ref(false)
  const trackedSetIds = ref<string[]>([])
  const loading = ref(false)

  function initTrackedSets() {
    try {
      trackedSetIds.value =
        JSON.parse(localStorage.getItem('ptcg-master-sets') || '[]') || []
    } catch {
      trackedSetIds.value = []
    }
  }

  async function loadSets() {
    if (setsLoaded.value) return
    loading.value = true
    try {
      sets.value = await apiFetchSets()
      setsLoaded.value = true
    } finally {
      loading.value = false
    }
  }

  function addTrackedSet(id: string) {
    if (trackedSetIds.value.includes(id)) return false
    trackedSetIds.value.push(id)
    localStorage.setItem(
      'ptcg-master-sets',
      JSON.stringify(trackedSetIds.value)
    )
    return true
  }

  function removeTrackedSet(id: string) {
    trackedSetIds.value = trackedSetIds.value.filter((s) => s !== id)
    localStorage.setItem(
      'ptcg-master-sets',
      JSON.stringify(trackedSetIds.value)
    )
  }

  function getSetCache(setId: string): SetCache | null {
    try {
      const raw = JSON.parse(
        localStorage.getItem(`ptcg-set-cache-${setId}`) || 'null'
      )
      if (!raw) return null
      if (Date.now() - raw.fetchedAt > CACHE_TTL) return null
      return raw as SetCache
    } catch {
      return null
    }
  }

  function setSetCache(setId: string, cards: Card[]) {
    localStorage.setItem(
      `ptcg-set-cache-${setId}`,
      JSON.stringify({ cards, fetchedAt: Date.now() })
    )
  }

  async function getSetCards(setId: string): Promise<Card[]> {
    const cached = getSetCache(setId)
    if (cached) return sortCards(cached.cards)

    const cards = await fetchAllCards(`set.id:${setId}`)
    const sorted = sortCards(cards)
    setSetCache(setId, sorted)
    return sorted
  }

  function getSetInfo(id: string): SetInfo | undefined {
    return sets.value.find((s) => s.id === id)
  }

  function getSetCacheSync(setId: string): SetCache | null {
    return getSetCache(setId)
  }

  return {
    sets,
    setsLoaded,
    trackedSetIds,
    loading,
    initTrackedSets,
    loadSets,
    addTrackedSet,
    removeTrackedSet,
    getSetCards,
    getSetInfo,
    getSetCacheSync,
  }
})
