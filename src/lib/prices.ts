import type { Card } from './types'

const VARIANT_PRIORITY = [
  'holofoil',
  'reverseHolofoil',
  'normal',
  '1stEditionHolofoil',
  '1stEditionNormal',
]

export function getBestMarketPrice(card: Card): {
  price: number | null
  variant: string | null
} {
  const tcg = card.tcgplayer?.prices
  const cm = card.cardmarket?.prices
  let price: number | null = null
  let variant: string | null = null

  if (tcg) {
    for (const v of VARIANT_PRIORITY) {
      if (tcg[v]?.market != null) {
        price = tcg[v].market!
        variant = v
        break
      }
    }
    if (price == null) {
      for (const [v, data] of Object.entries(tcg)) {
        if (data?.market != null) {
          price = data.market!
          variant = v
          break
        }
      }
    }
  }
  if (price == null && cm?.averageSellPrice != null) {
    price = cm.averageSellPrice
    variant = 'cardmarket'
  }
  return { price, variant }
}

export function formatPrice(val: number | null | undefined): string | null {
  return val == null ? null : '$' + val.toFixed(2)
}
