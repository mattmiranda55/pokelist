import { Database } from 'bun:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Docker sets this to /data/pokelist.db against a mounted volume; locally it stays in the repo.
const DB_PATH = process.env.DATABASE_PATH ?? './data/pokelist.db';

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH, { create: true });

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(join(import.meta.dir, 'schema.sql'), 'utf8'));

// Databases created before per-variant pricing need the column added in place.
function hasColumn(table: string, column: string): boolean {
  return db
    .query<{ name: string }, []>(`PRAGMA table_info(${table})`)
    .all()
    .some((r) => r.name === column);
}
if (!hasColumn('card_variants', 'price_usd')) {
  db.exec('ALTER TABLE card_variants ADD COLUMN price_usd REAL');
}

export interface AddCardInput {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  price_usd: number | null;
}

export interface VariantSelection {
  variantType: string;
  quantity: number;
  priceUsd?: number | null;
}

export interface CollectionVariant {
  id: number;
  variant_type: string;
  quantity: number;
  price_usd: number | null;
}

export interface CollectionCard {
  id: number;
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  price_usd: number | null;
  total_quantity: number;
  variants: CollectionVariant[];
}

/** 'add' increments existing quantities (manual add); 'set' overwrites them so re-imports converge. */
export type QuantityMode = 'add' | 'set';

const selectCollection = db.query<Omit<CollectionCard, 'variants'>, []>(`
  SELECT
    c.id,
    c.pokemon_tcg_id,
    c.name,
    c.set_name,
    c.series,
    c.image_url,
    c.rarity,
    c.card_number,
    COALESCE(SUM(v.quantity), 0) AS total_quantity,
    (
      SELECT p.price_usd
      FROM price_history p
      WHERE p.card_id = c.id
      ORDER BY p.fetched_at DESC, p.id DESC
      LIMIT 1
    ) AS price_usd
  FROM cards c
  LEFT JOIN card_variants v ON v.card_id = c.id
  GROUP BY c.id
  ORDER BY c.added_at DESC
`);

const selectAllVariants = db.query<CollectionVariant & { card_id: number }, []>(
  'SELECT id, card_id, variant_type, quantity, price_usd FROM card_variants ORDER BY id ASC'
);

export function getCollection(): CollectionCard[] {
  const cards = selectCollection.all();
  if (cards.length === 0) return [];

  const byCard = new Map<number, CollectionVariant[]>();
  for (const v of selectAllVariants.all()) {
    const list = byCard.get(v.card_id) ?? [];
    list.push({
      id: v.id,
      variant_type: v.variant_type,
      quantity: v.quantity,
      price_usd: v.price_usd,
    });
    byCard.set(v.card_id, list);
  }

  return cards.map((c) => ({ ...c, variants: byCard.get(c.id) ?? [] }));
}

export function getCollectionTcgIds(): string[] {
  const rows = db
    .query<{ pokemon_tcg_id: string }, []>('SELECT pokemon_tcg_id FROM cards')
    .all();
  return rows.map((r) => r.pokemon_tcg_id);
}

const insertCard = db.query(
  `INSERT INTO cards (pokemon_tcg_id, name, set_name, series, image_url, rarity, card_number)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(pokemon_tcg_id) DO NOTHING`
);
const selectCardIdByTcgId = db.query<{ id: number }, [string]>(
  'SELECT id FROM cards WHERE pokemon_tcg_id = ?'
);
const selectVariant = db.query<{ id: number; quantity: number }, [number, string]>(
  'SELECT id, quantity FROM card_variants WHERE card_id = ? AND variant_type = ?'
);
const updateVariantQty = db.query('UPDATE card_variants SET quantity = ? WHERE id = ?');
const updateVariantQtyAndPrice = db.query(
  'UPDATE card_variants SET quantity = ?, price_usd = ? WHERE id = ?'
);
const insertVariant = db.query(
  'INSERT INTO card_variants (card_id, variant_type, quantity, price_usd) VALUES (?, ?, ?, ?)'
);
const insertPrice = db.query(
  'INSERT INTO price_history (card_id, price_usd) VALUES (?, ?)'
);
// One price point per card per day keeps repeated imports from bloating the chart in Phase 4.
const hasPriceToday = db.query<{ n: number }, [number]>(
  `SELECT COUNT(*) AS n FROM price_history
   WHERE card_id = ? AND date(fetched_at) = date('now')`
);

export const addCardWithVariants = db.transaction(
  (input: AddCardInput, variants: VariantSelection[], mode: QuantityMode) => {
    if (variants.length === 0) {
      throw new Error('addCardWithVariants requires at least one variant');
    }

    insertCard.run(
      input.pokemon_tcg_id,
      input.name,
      input.set_name,
      input.series,
      input.image_url,
      input.rarity,
      input.card_number
    );

    const row = selectCardIdByTcgId.get(input.pokemon_tcg_id);
    if (!row) throw new Error(`Card not found after insert: ${input.pokemon_tcg_id}`);
    const cardId = row.id;

    for (const v of variants) {
      if (v.quantity <= 0) continue;
      const price = v.priceUsd ?? null;
      const existing = selectVariant.get(cardId, v.variantType);
      if (existing) {
        const next = mode === 'add' ? existing.quantity + v.quantity : v.quantity;
        if (price != null) {
          updateVariantQtyAndPrice.run(next, price, existing.id);
        } else {
          updateVariantQty.run(next, existing.id);
        }
      } else {
        insertVariant.run(cardId, v.variantType, v.quantity, price);
      }
    }

    if (input.price_usd != null && hasPriceToday.get(cardId)!.n === 0) {
      insertPrice.run(cardId, input.price_usd);
    }

    return cardId;
  }
);

export function removeCard(cardId: number): void {
  db.query('DELETE FROM cards WHERE id = ?').run(cardId);
}

export function setVariantQuantity(variantId: number, quantity: number): void {
  db.query('UPDATE card_variants SET quantity = ? WHERE id = ?').run(quantity, variantId);
}

const selectVariantCardId = db.query<{ card_id: number }, [number]>(
  'SELECT card_id FROM card_variants WHERE id = ?'
);
const countVariantsForCard = db.query<{ n: number }, [number]>(
  'SELECT COUNT(*) AS n FROM card_variants WHERE card_id = ?'
);

/** Deleting a card's last variant also deletes the card, so it can't linger at quantity 0. */
export const removeVariant = db.transaction((variantId: number) => {
  const owner = selectVariantCardId.get(variantId);
  db.query('DELETE FROM card_variants WHERE id = ?').run(variantId);
  if (owner && countVariantsForCard.get(owner.card_id)!.n === 0) {
    db.query('DELETE FROM cards WHERE id = ?').run(owner.card_id);
  }
});

export const addVariantToCard = db.transaction(
  (cardId: number, variantType: string, quantity: number) => {
    const existing = selectVariant.get(cardId, variantType);
    if (existing) {
      updateVariantQty.run(existing.quantity + quantity, existing.id);
    } else {
      insertVariant.run(cardId, variantType, quantity, null);
    }
  }
);

export interface PricePoint {
  day: string;
  value: number;
}

const RANGE_MODIFIERS: Record<string, string> = {
  '7D': '-7 days',
  '3M': '-3 months',
  '6M': '-6 months',
};

/**
 * Collection value per day. Uses the same formula as the headline total — per-variant price
 * where known, that day's recorded card price otherwise — so the two always agree for today.
 * Quantities and variant prices are current, not historical, so only the card-level series
 * varies over time; days before a card was first priced omit it rather than backfilling.
 */
export function getPriceHistory(range: string): PricePoint[] {
  const modifier = RANGE_MODIFIERS[range];
  if (!modifier) throw new Error(`Unknown range: ${range}`);
  return db
    .query<PricePoint, [string]>(
      `SELECT date(p.fetched_at) AS day,
              ROUND(SUM(v.quantity * COALESCE(v.price_usd, p.price_usd)), 2) AS value
       FROM price_history p
       JOIN card_variants v ON v.card_id = p.card_id
       WHERE date(p.fetched_at) >= date('now', ?)
       GROUP BY day
       ORDER BY day ASC`
    )
    .all(modifier);
}

export function getPricedCardIds(): { id: number; pokemon_tcg_id: string }[] {
  return db
    .query<{ id: number; pokemon_tcg_id: string }, []>(
      'SELECT id, pokemon_tcg_id FROM cards'
    )
    .all();
}

export function recordPrice(cardId: number, priceUsd: number): void {
  if (hasPriceToday.get(cardId)!.n > 0) return;
  insertPrice.run(cardId, priceUsd);
}

export function setVariantPrice(
  cardId: number,
  variantType: string,
  priceUsd: number
): void {
  db.query(
    'UPDATE card_variants SET price_usd = ? WHERE card_id = ? AND variant_type = ?'
  ).run(priceUsd, cardId, variantType);
}

export interface ExportRow {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  rarity: string | null;
  card_number: string | null;
  variant_type: string;
  quantity: number;
  price_usd: number | null;
  added_at: string;
}

export function getExportRows(): ExportRow[] {
  return db
    .query<ExportRow, []>(
      `SELECT
         c.pokemon_tcg_id,
         c.name,
         c.set_name,
         c.series,
         c.rarity,
         c.card_number,
         c.added_at,
         v.variant_type,
         v.quantity,
         (
           SELECT p.price_usd
           FROM price_history p
           WHERE p.card_id = c.id
           ORDER BY p.fetched_at DESC, p.id DESC
           LIMIT 1
         ) AS price_usd
       FROM cards c
       INNER JOIN card_variants v ON v.card_id = c.id
       ORDER BY c.added_at DESC, v.id ASC`
    )
    .all();
}
