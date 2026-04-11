export interface Card {
  id: string
  name: string
  number?: string
  rarity?: string
  images?: { small?: string; large?: string }
  set?: {
    id?: string
    name?: string
    releaseDate?: string
    printedTotal?: number
    total?: number
  }
  tcgplayer?: {
    prices?: Record<
      string,
      { market?: number; mid?: number; low?: number; high?: number }
    >
  }
  cardmarket?: { prices?: { averageSellPrice?: number } }
}

export interface SetInfo {
  id: string
  name: string
  releaseDate?: string
  total?: number
  printedTotal?: number
}

export interface GradeInfo {
  company: string
  grade: string
}

export interface PriceHistoryEntry {
  date: string
  price: number
}

export interface ValueHistoryEntry {
  date: string
  total: number
}

export interface SetCache {
  cards: Card[]
  fetchedAt: number
}

export interface PokemonCache {
  cards: Card[]
  fetchedAt: number
}
