import { db } from './db';

const BASE = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMONTCG_API_KEY;

const RETRY_DELAYS_MS = [250, 500, 1000, 2000];

/** Card and set metadata is effectively immutable. */
const TTL_METADATA_S = 7 * 24 * 60 * 60;
/** Anything read for its price needs to go stale faster. */
const TTL_PRICED_S = 24 * 60 * 60;

const selectCache = db.query<
  { response_json: string; age_s: number },
  [string]
>(
  `SELECT response_json, CAST((julianday('now') - julianday(fetched_at)) * 86400 AS INTEGER) AS age_s
   FROM tcg_cache WHERE query_key = ?`
);
const upsertCache = db.query(
  `INSERT INTO tcg_cache (query_key, response_json, fetched_at)
   VALUES (?, ?, datetime('now'))
   ON CONFLICT(query_key) DO UPDATE SET
     response_json = excluded.response_json,
     fetched_at = excluded.fetched_at`
);

function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

async function fetchWithRetry(url: string): Promise<unknown> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (API_KEY) headers['X-Api-Key'] = API_KEY;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const base = RETRY_DELAYS_MS[attempt - 1];
      const jitter = Math.floor(base * 0.3 * Math.random());
      await Bun.sleep(base + jitter);
    }

    try {
      const res = await fetch(url, { headers });
      if (res.ok) return await res.json();

      if (!isRetryable(res.status)) {
        throw new Error(`Pokemon TCG API ${res.status} ${res.statusText} for ${url}`);
      }
      lastError = new Error(`Pokemon TCG API ${res.status} ${res.statusText}`);
    } catch (e) {
      // A non-retryable status already threw with that message; don't retry past it.
      if (e instanceof Error && e.message.startsWith('Pokemon TCG API 4')) throw e;
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw new Error(
    `Pokemon TCG API failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${lastError?.message}`
  );
}

async function getCached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<unknown>
): Promise<T> {
  const hit = selectCache.get(key);
  if (hit && hit.age_s < ttlSeconds) {
    return JSON.parse(hit.response_json) as T;
  }

  try {
    const fresh = await fetcher();
    upsertCache.run(key, JSON.stringify(fresh));
    return fresh as T;
  } catch (e) {
    // A stale hit beats a hard failure when upstream is down.
    if (hit) return JSON.parse(hit.response_json) as T;
    throw e;
  }
}

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

async function getData<T>(
  path: string,
  params: Record<string, string>,
  ttlSeconds: number
): Promise<T> {
  const url = buildUrl(path, params);
  const json = await getCached<{ data: T }>(url, ttlSeconds, () => fetchWithRetry(url));
  return json.data;
}

export function escapeLucene(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

export function searchCardsByName(name: string) {
  return getData<unknown[]>(
    '/cards',
    {
      q: `name:"${escapeLucene(name)}"`,
      orderBy: '-set.releaseDate,number',
      pageSize: '250',
    },
    TTL_PRICED_S
  );
}

export function searchSets(query: string) {
  return getData<unknown[]>(
    '/sets',
    { q: `name:"*${escapeLucene(query)}*"`, orderBy: '-releaseDate', pageSize: '30' },
    TTL_METADATA_S
  );
}

export async function getCardById(cardId: string): Promise<TcgCardLike | null> {
  const url = buildUrl(`/cards/${encodeURIComponent(cardId)}`, {});
  const json = await getCached<{ data: TcgCardLike }>(url, TTL_PRICED_S, () =>
    fetchWithRetry(url)
  );
  return json.data ?? null;
}

export interface TcgCardLike {
  id: string;
  tcgplayer?: { prices?: Record<string, { market?: number | null } | undefined> };
  cardmarket?: { prices?: { averageSellPrice?: number | null; trendPrice?: number | null } };
}

const VARIANT_ORDER = [
  'normal',
  'holofoil',
  'reverseHolofoil',
  '1stEditionHolofoil',
  'unlimitedHolofoil',
  '1stEdition',
];

/** First variant bucket with an actual market price wins; a null `normal` must not mask a real holofoil. */
export function extractPriceUsd(card: TcgCardLike): number | null {
  const prices = card.tcgplayer?.prices;
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

export function variantPrices(card: TcgCardLike): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [type, bucket] of Object.entries(card.tcgplayer?.prices ?? {})) {
    if (bucket?.market != null) out[type] = bucket.market;
  }
  return out;
}

export function getCardsInSet(setId: string) {
  return getData<unknown[]>(
    '/cards',
    { q: `set.id:${setId}`, orderBy: 'number', pageSize: '250' },
    TTL_PRICED_S
  );
}

export async function findCardForImport(input: {
  name: string;
  set?: string;
  number?: string;
}): Promise<unknown | null> {
  const clauses = [`name:"${escapeLucene(input.name)}"`];
  if (input.set) clauses.push(`set.name:"${escapeLucene(input.set)}"`);
  if (input.number) clauses.push(`number:"${escapeLucene(input.number)}"`);

  const exact = await getData<unknown[]>(
    '/cards',
    { q: clauses.join(' '), pageSize: '5' },
    TTL_PRICED_S
  );
  if (exact.length > 0) return exact[0];

  if (input.number && input.set) {
    const withoutNumber = await getData<unknown[]>(
      '/cards',
      {
        q: `name:"${escapeLucene(input.name)}" set.name:"${escapeLucene(input.set)}"`,
        pageSize: '5',
      },
      TTL_PRICED_S
    );
    if (withoutNumber.length > 0) return withoutNumber[0];
  }

  if (input.set) {
    const nameOnly = await getData<unknown[]>(
      '/cards',
      { q: `name:"${escapeLucene(input.name)}"`, pageSize: '5' },
      TTL_PRICED_S
    );
    if (nameOnly.length > 0) return nameOnly[0];
  }

  return null;
}
