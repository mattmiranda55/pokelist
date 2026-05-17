const BASE = 'https://api.pokemontcg.io/v2';

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

export function extractPriceUsd(card: TcgCard): number | null {
  const prices = card.tcgplayer?.prices;
  if (prices) {
    const bucket =
      prices.normal ??
      prices.holofoil ??
      prices.reverseHolofoil ??
      prices['1stEditionHolofoil'] ??
      prices.unlimitedHolofoil;
    if (bucket?.market != null) return bucket.market;
  }
  const cm = card.cardmarket?.prices;
  if (cm?.averageSellPrice != null) return cm.averageSellPrice;
  if (cm?.trendPrice != null) return cm.trendPrice;
  return null;
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Pokemon TCG API ${path} failed: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export function searchCardsByName(name: string): Promise<TcgCard[]> {
  return get<TcgCard[]>('/cards', {
    q: `name:"${name}"`,
    orderBy: '-set.releaseDate,number',
    pageSize: '50',
  });
}

export function searchSets(query: string): Promise<TcgSet[]> {
  return get<TcgSet[]>('/sets', {
    q: `name:"*${query}*"`,
    orderBy: '-releaseDate',
    pageSize: '30',
  });
}

export function getCardsInSet(setId: string): Promise<TcgCard[]> {
  return get<TcgCard[]>('/cards', {
    q: `set.id:${setId}`,
    orderBy: 'number',
    pageSize: '250',
  });
}

function escapeLucene(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export async function findCardForImport(input: {
  name: string;
  set?: string;
  number?: string;
}): Promise<TcgCard | null> {
  const clauses: string[] = [`name:"${escapeLucene(input.name)}"`];
  if (input.set) clauses.push(`set.name:"${escapeLucene(input.set)}"`);
  if (input.number) clauses.push(`number:"${escapeLucene(input.number)}"`);

  const cards = await get<TcgCard[]>('/cards', {
    q: clauses.join(' '),
    pageSize: '5',
  });
  if (cards.length > 0) return cards[0];

  if (input.number && input.set) {
    const fallback = await get<TcgCard[]>('/cards', {
      q: `name:"${escapeLucene(input.name)}" set.name:"${escapeLucene(input.set)}"`,
      pageSize: '5',
    });
    if (fallback.length > 0) return fallback[0];
  }

  if (input.set) {
    const fallback = await get<TcgCard[]>('/cards', {
      q: `name:"${escapeLucene(input.name)}"`,
      pageSize: '5',
    });
    if (fallback.length > 0) return fallback[0];
  }

  return null;
}
