import type { Card } from './types'

export function naturalSort(a: string, b: string): number {
  const numA = parseInt(a, 10)
  const numB = parseInt(b, 10)
  if (!isNaN(numA) && !isNaN(numB))
    return numA !== numB ? numA - numB : a.localeCompare(b)
  if (!isNaN(numA)) return -1
  if (!isNaN(numB)) return 1
  return a.localeCompare(b)
}

export function sortCards(cards: Card[]): Card[] {
  return cards.slice().sort((a, b) => {
    const dateA = a.set?.releaseDate || '0000'
    const dateB = b.set?.releaseDate || '0000'
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    const nc = naturalSort(a.number || '', b.number || '')
    if (nc !== 0) return nc
    return (a.name || '').localeCompare(b.name || '')
  })
}
