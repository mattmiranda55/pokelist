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

export interface TcgCard {
  id: string;
  name: string;
  number: string;
  rarity?: string;
  images: TcgCardImage;
  set: TcgCardSet;
  // Upstream only enumerates a card's variants as the keys of its price map; the bucket
  // values are prices and go unread.
  tcgplayer?: {
    prices?: Record<string, unknown>;
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
}

export function getAvailableVariants(card: TcgCard): AvailableVariant[] {
  const variants: AvailableVariant[] = Object.keys(card.tcgplayer?.prices ?? {}).map(
    (type) => ({ type, label: variantLabel(type) })
  );

  if (variants.length === 0) {
    variants.push({ type: 'normal', label: 'Normal' });
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
