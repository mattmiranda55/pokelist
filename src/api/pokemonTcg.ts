import { apiGet } from './client';

export interface TcgCardImage {
  small: string;
  large: string;
}

export interface TcgCardSet {
  id: string;
  name: string;
  series: string;
}

interface TcgPlayerPriceBucket {
  market?: number | null;
}

interface TcgPlayerPrices {
  normal?: TcgPlayerPriceBucket;
  holofoil?: TcgPlayerPriceBucket;
  reverseHolofoil?: TcgPlayerPriceBucket;
  '1stEditionHolofoil'?: TcgPlayerPriceBucket;
  unlimitedHolofoil?: TcgPlayerPriceBucket;
}

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: TcgCardImage;
  set: TcgCardSet;
  tcgplayer?: {
    prices?: TcgPlayerPrices;
  };
  cardmarket?: {
    prices?: {
      averageSellPrice?: number | null;
      trendPrice?: number | null;
    };
  };
}

export interface TcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string;
  images: { symbol: string; logo: string };
  total: number;
}

/** First bucket with an actual market price wins; a present-but-null `normal` must not mask a real holofoil. */
export function extractPriceUsd(card: TcgCard): number | null {
  const prices = card.tcgplayer?.prices as
    | Record<string, { market?: number | null } | undefined>
    | undefined;
  if (prices) {
    for (const key of VARIANT_ORDER) {
      const market = prices[key]?.market;
      if (market != null) return market;
    }
    for (const bucket of Object.values(prices)) {
      if (bucket?.market != null) return bucket.market;
    }
  }
  const cm = card.cardmarket?.prices;
  if (cm?.averageSellPrice != null) return cm.averageSellPrice;
  if (cm?.trendPrice != null) return cm.trendPrice;
  return null;
}

export const VARIANT_LABELS: Record<string, string> = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  reverseHolofoil: 'Reverse Holofoil',
  '1stEditionHolofoil': '1st Ed Holofoil',
  unlimitedHolofoil: 'Unlimited Holofoil',
  '1stEdition': '1st Edition',
};

export const VARIANT_ORDER = [
  'normal',
  'holofoil',
  'reverseHolofoil',
  '1stEditionHolofoil',
  'unlimitedHolofoil',
  '1stEdition',
];

export const ALL_VARIANT_TYPES = VARIANT_ORDER;

export function variantLabel(variantType: string): string {
  return VARIANT_LABELS[variantType] ?? variantType;
}

export interface AvailableVariant {
  type: string;
  label: string;
  priceUsd: number | null;
}

export function getAvailableVariants(card: TcgCard): AvailableVariant[] {
  const prices = card.tcgplayer?.prices as
    | Record<string, { market?: number | null } | undefined>
    | undefined;
  const variants: AvailableVariant[] = [];

  if (prices) {
    for (const [type, bucket] of Object.entries(prices)) {
      variants.push({
        type,
        label: variantLabel(type),
        priceUsd: bucket?.market ?? null,
      });
    }
  }

  if (variants.length === 0) {
    variants.push({ type: 'normal', label: 'Normal', priceUsd: extractPriceUsd(card) });
  }

  variants.sort((a, b) => {
    const ai = VARIANT_ORDER.indexOf(a.type);
    const bi = VARIANT_ORDER.indexOf(b.type);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return variants;
}

// Lucene query construction, retry, and caching all live server-side in server/tcg.ts.
export function searchCardsByName(name: string): Promise<TcgCard[]> {
  return apiGet<TcgCard[]>(`/tcg/cards?name=${encodeURIComponent(name)}`);
}

export function searchSets(query: string): Promise<TcgSet[]> {
  return apiGet<TcgSet[]>(`/tcg/sets?q=${encodeURIComponent(query)}`);
}

export function getCardsInSet(setId: string): Promise<TcgCard[]> {
  return apiGet<TcgCard[]>(`/tcg/sets/${encodeURIComponent(setId)}/cards`);
}

export function getCardByTcgId(id: string): Promise<TcgCard | null> {
  return apiGet<TcgCard | null>(`/tcg/card/${encodeURIComponent(id)}`);
}

/** Which variants this specific card exists in. Falls back to the generic list if lookup fails,
 *  since showing no options at all would leave the user unable to add anything. */
export async function getVariantTypesForCard(id: string): Promise<string[]> {
  const card = await getCardByTcgId(id);
  if (!card) return ALL_VARIANT_TYPES;
  return getAvailableVariants(card).map((v) => v.type);
}

export function findCardForImport(input: {
  name: string;
  set?: string;
  number?: string;
}): Promise<TcgCard | null> {
  const params = new URLSearchParams({ name: input.name });
  if (input.set) params.set('set', input.set);
  if (input.number) params.set('number', input.number);
  return apiGet<TcgCard | null>(`/tcg/match?${params.toString()}`);
}
