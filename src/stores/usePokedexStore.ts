import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Card, PokemonCache } from '@/lib/types'
import { fetchAllCards } from '@/lib/api'
import { sortCards } from '@/lib/sorting'
import { CACHE_TTL } from '@/lib/constants'

export const usePokedexStore = defineStore('pokedex', () => {
  const trackedPokemon = ref<string[]>([])
  const loading = ref(false)

  function initTracked() {
    try {
      trackedPokemon.value =
        JSON.parse(localStorage.getItem('ptcg-tracked-pokemon') || '[]') || []
    } catch {
      trackedPokemon.value = []
    }
  }

  function addTrackedPokemon(name: string): boolean {
    const exists = trackedPokemon.value.find(
      (n) => n.toLowerCase() === name.toLowerCase()
    )
    if (exists) return false
    trackedPokemon.value.push(name)
    localStorage.setItem(
      'ptcg-tracked-pokemon',
      JSON.stringify(trackedPokemon.value)
    )
    return true
  }

  function removeTrackedPokemon(name: string) {
    trackedPokemon.value = trackedPokemon.value.filter((n) => n !== name)
    localStorage.setItem(
      'ptcg-tracked-pokemon',
      JSON.stringify(trackedPokemon.value)
    )
  }

  function getPokemonCacheSync(name: string): PokemonCache | null {
    try {
      const raw = JSON.parse(
        localStorage.getItem(`ptcg-pokemon-cache-${name}`) || 'null'
      )
      if (!raw) return null
      if (Date.now() - raw.fetchedAt > CACHE_TTL) return null
      return raw as PokemonCache
    } catch {
      return null
    }
  }

  function setPokemonCache(name: string, cards: Card[]) {
    localStorage.setItem(
      `ptcg-pokemon-cache-${name}`,
      JSON.stringify({ cards, fetchedAt: Date.now() })
    )
  }

  async function getPokemonCards(name: string): Promise<Card[]> {
    const cached = getPokemonCacheSync(name)
    if (cached) return sortCards(cached.cards)

    const cards = await fetchAllCards(`name:"${name}*"`)
    const sorted = sortCards(cards)
    setPokemonCache(name, sorted)
    return sorted
  }

  return {
    trackedPokemon,
    loading,
    initTracked,
    addTrackedPokemon,
    removeTrackedPokemon,
    getPokemonCards,
    getPokemonCacheSync,
  }
})
