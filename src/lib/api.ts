import { API_BASE, PAGE_SIZE } from './constants'
import type { Card, SetInfo } from './types'

export async function apiFetch(url: string): Promise<any> {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 429)
      throw new Error('Rate limited. Please wait a moment and try again.')
    throw new Error(`API error: ${res.status}`)
  }
  return res.json()
}

export async function fetchAllCards(query: string): Promise<Card[]> {
  const url = `${API_BASE}/cards?q=${encodeURIComponent(query)}&pageSize=${PAGE_SIZE}&orderBy=set.releaseDate,number&page=1`
  const first = await apiFetch(url)
  let allCards: Card[] = first.data || []
  const totalCount: number = first.totalCount || 0
  if (totalCount > PAGE_SIZE) {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE)
    const promises: Promise<any>[] = []
    for (let p = 2; p <= totalPages; p++) {
      promises.push(
        apiFetch(
          `${API_BASE}/cards?q=${encodeURIComponent(query)}&pageSize=${PAGE_SIZE}&orderBy=set.releaseDate,number&page=${p}`
        ).catch(() => ({ data: [] }))
      )
    }
    const results = await Promise.all(promises)
    for (const r of results) allCards = allCards.concat(r.data || [])
  }
  return allCards
}

export async function fetchSets(): Promise<SetInfo[]> {
  try {
    const json = await apiFetch(
      `${API_BASE}/sets?orderBy=releaseDate&pageSize=250`
    )
    let sets: SetInfo[] = json.data || []
    const total: number = json.totalCount || sets.length
    if (total > 250) {
      const pages = Math.ceil(total / 250)
      for (let p = 2; p <= pages; p++) {
        const extra = await apiFetch(
          `${API_BASE}/sets?orderBy=releaseDate&pageSize=250&page=${p}`
        )
        sets = sets.concat(extra.data || [])
      }
    }
    return sets
  } catch {
    return []
  }
}
