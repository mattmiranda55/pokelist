import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Card, GradeInfo, PriceHistoryEntry, ValueHistoryEntry } from '@/lib/types'
import { fetchAllCards } from '@/lib/api'
import { sortCards } from '@/lib/sorting'
import { getBestMarketPrice } from '@/lib/prices'
import { getToday } from '@/lib/constants'

export const useCollectionStore = defineStore('collection', () => {
  const ownedIds = ref<Set<string>>(new Set())
  const collectionCards = ref<Card[]>([])
  const searchResults = ref<Card[]>([])
  const loading = ref(false)
  const searchLoading = ref(false)
  const error = ref<string | null>(null)

  // Init: scan localStorage for owned keys
  function initOwned() {
    const ids = new Set<string>()
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ptcg-owned-') && localStorage.getItem(key) === 'true') {
        ids.add(key.replace('ptcg-owned-', ''))
      }
    }
    ownedIds.value = ids
  }

  function isOwned(id: string): boolean {
    return localStorage.getItem(`ptcg-owned-${id}`) === 'true'
  }

  function toggleOwned(id: string) {
    if (isOwned(id)) {
      localStorage.removeItem(`ptcg-owned-${id}`)
      ownedIds.value.delete(id)
    } else {
      localStorage.setItem(`ptcg-owned-${id}`, 'true')
      ownedIds.value.add(id)
    }
    // Trigger reactivity
    ownedIds.value = new Set(ownedIds.value)
  }

  function setOwned(id: string, owned: boolean) {
    if (owned) {
      localStorage.setItem(`ptcg-owned-${id}`, 'true')
      ownedIds.value.add(id)
    } else {
      localStorage.removeItem(`ptcg-owned-${id}`)
      ownedIds.value.delete(id)
    }
    ownedIds.value = new Set(ownedIds.value)
  }

  function getGradeInfo(id: string): GradeInfo | null {
    try {
      return JSON.parse(localStorage.getItem(`ptcg-grade-${id}`) || 'null')
    } catch {
      return null
    }
  }

  function setGradeInfo(id: string, info: GradeInfo | null) {
    if (info) localStorage.setItem(`ptcg-grade-${id}`, JSON.stringify(info))
    else localStorage.removeItem(`ptcg-grade-${id}`)
  }

  function recordCardPrice(id: string, price: number | null) {
    if (price == null) return
    const today = getToday()
    let hist: PriceHistoryEntry[] = []
    try {
      hist = JSON.parse(localStorage.getItem(`ptcg-prices-${id}`) || '[]')
    } catch {
      hist = []
    }
    const existing = hist.findIndex((h) => h.date === today)
    if (existing >= 0) hist[existing].price = price
    else hist.push({ date: today, price })
    if (hist.length > 90) hist = hist.slice(-90)
    localStorage.setItem(`ptcg-prices-${id}`, JSON.stringify(hist))
  }

  function getCardPriceHistory(id: string): PriceHistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem(`ptcg-prices-${id}`) || '[]')
    } catch {
      return []
    }
  }

  function recordTotalValue(total: number) {
    const today = getToday()
    let hist: ValueHistoryEntry[] = []
    try {
      hist = JSON.parse(localStorage.getItem('ptcg-value-history') || '[]')
    } catch {
      hist = []
    }
    const existing = hist.findIndex((h) => h.date === today)
    if (existing >= 0) hist[existing].total = total
    else hist.push({ date: today, total })
    if (hist.length > 365) hist = hist.slice(-365)
    localStorage.setItem('ptcg-value-history', JSON.stringify(hist))
  }

  function getValueHistory(): ValueHistoryEntry[] {
    try {
      return JSON.parse(localStorage.getItem('ptcg-value-history') || '[]')
    } catch {
      return []
    }
  }

  async function loadCollection() {
    initOwned()
    const ids = Array.from(ownedIds.value)
    if (ids.length === 0) {
      collectionCards.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const batches: string[] = []
      for (let i = 0; i < ids.length; i += 30) {
        const batchIds = ids.slice(i, i + 30)
        const q = batchIds.map((id) => `id:"${id}"`).join(' OR ')
        batches.push(q)
      }

      let allCards: Card[] = []
      for (const q of batches) {
        const cards = await fetchAllCards(q)
        allCards = allCards.concat(cards)
      }

      collectionCards.value = sortCards(allCards)

      // Calculate total value and record prices
      let totalValue = 0
      collectionCards.value.forEach((card) => {
        const { price } = getBestMarketPrice(card)
        recordCardPrice(card.id, price)
        if (price != null) totalValue += price
      })

      recordTotalValue(totalValue)
    } catch (err: any) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  async function searchCards(term: string) {
    if (!term) return
    searchLoading.value = true
    error.value = null
    try {
      const cards = await fetchAllCards(`name:"*${term}*"`)
      searchResults.value = sortCards(cards)
    } catch (err: any) {
      error.value = err.message
    } finally {
      searchLoading.value = false
    }
  }

  function clearSearchResults() {
    searchResults.value = []
  }

  function recalculateValue() {
    let totalValue = 0
    collectionCards.value.forEach((card) => {
      const { price } = getBestMarketPrice(card)
      if (price != null) totalValue += price
    })
    recordTotalValue(totalValue)
  }

  function removeCardFromCollection(cardId: string) {
    collectionCards.value = collectionCards.value.filter((c) => c.id !== cardId)
  }

  function addCardToCollection(card: Card) {
    if (!collectionCards.value.find((c) => c.id === card.id)) {
      collectionCards.value.push(card)
      collectionCards.value = sortCards(collectionCards.value)
    }
  }

  return {
    ownedIds,
    collectionCards,
    searchResults,
    loading,
    searchLoading,
    error,
    initOwned,
    isOwned,
    toggleOwned,
    setOwned,
    getGradeInfo,
    setGradeInfo,
    recordCardPrice,
    getCardPriceHistory,
    recordTotalValue,
    getValueHistory,
    loadCollection,
    searchCards,
    clearSearchResults,
    recalculateValue,
    removeCardFromCollection,
    addCardToCollection,
  }
})
