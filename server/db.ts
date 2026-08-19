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

export interface AddCardInput {
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
}

export interface VariantSelection {
  variantType: string;
  quantity: number;
}

export interface CollectionVariant {
  id: number;
  variant_type: string;
  quantity: number;
}

export interface GradedCopy {
  id: number;
  variant_type: string | null;
  company: string;
  grade: string;
  cert_number: string | null;
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
  total_quantity: number;
  variants: CollectionVariant[];
  graded: GradedCopy[];
}

export interface Want {
  id: number;
  pokemon_tcg_id: string;
  name: string;
  set_name: string | null;
  series: string | null;
  image_url: string | null;
  rarity: string | null;
  card_number: string | null;
  variant_type: string | null;
  added_at: string;
}

export interface AddWantInput extends AddCardInput {
  variantType: string | null;
}

export interface AddGradedInput {
  variantType: string | null;
  company: string;
  grade: string;
  certNumber: string | null;
}

/** 'add' increments existing quantities (manual add); 'set' overwrites them so re-imports converge. */
export type QuantityMode = 'add' | 'set';

const selectCollection = db.query<Omit<CollectionCard, 'variants' | 'graded'>, []>(`
  SELECT
    c.id,
    c.pokemon_tcg_id,
    c.name,
    c.set_name,
    c.series,
    c.image_url,
    c.rarity,
    c.card_number,
    COALESCE(SUM(v.quantity), 0) AS total_quantity
  FROM cards c
  LEFT JOIN card_variants v ON v.card_id = c.id
  GROUP BY c.id
  ORDER BY c.added_at DESC
`);

const selectAllVariants = db.query<CollectionVariant & { card_id: number }, []>(
  'SELECT id, card_id, variant_type, quantity FROM card_variants ORDER BY id ASC'
);

const selectAllGraded = db.query<GradedCopy & { card_id: number }, []>(
  `SELECT id, card_id, variant_type, company, grade, cert_number
   FROM graded_cards ORDER BY id ASC`
);

export function getCollection(): CollectionCard[] {
  const cards = selectCollection.all();
  if (cards.length === 0) return [];

  const variantsByCard = new Map<number, CollectionVariant[]>();
  for (const v of selectAllVariants.all()) {
    const list = variantsByCard.get(v.card_id) ?? [];
    list.push({ id: v.id, variant_type: v.variant_type, quantity: v.quantity });
    variantsByCard.set(v.card_id, list);
  }

  const gradedByCard = new Map<number, GradedCopy[]>();
  for (const g of selectAllGraded.all()) {
    const list = gradedByCard.get(g.card_id) ?? [];
    list.push({
      id: g.id,
      variant_type: g.variant_type,
      company: g.company,
      grade: g.grade,
      cert_number: g.cert_number,
    });
    gradedByCard.set(g.card_id, list);
  }

  return cards.map((c) => ({
    ...c,
    variants: variantsByCard.get(c.id) ?? [],
    graded: gradedByCard.get(c.id) ?? [],
  }));
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
const insertVariant = db.query(
  'INSERT INTO card_variants (card_id, variant_type, quantity) VALUES (?, ?, ?)'
);
const deleteWantForVariant = db.query(
  'DELETE FROM wants WHERE pokemon_tcg_id = ? AND variant_type = ?'
);
const deleteWantAnyVariant = db.query(
  'DELETE FROM wants WHERE pokemon_tcg_id = ? AND variant_type IS NULL'
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

    let added = false;
    for (const v of variants) {
      if (v.quantity <= 0) continue;
      const existing = selectVariant.get(cardId, v.variantType);
      if (existing) {
        updateVariantQty.run(
          mode === 'add' ? existing.quantity + v.quantity : v.quantity,
          existing.id
        );
      } else {
        insertVariant.run(cardId, v.variantType, v.quantity);
      }
      // Acquiring a variant clears the want for it; a want for a different variant survives.
      deleteWantForVariant.run(input.pokemon_tcg_id, v.variantType);
      added = true;
    }
    if (added) deleteWantAnyVariant.run(input.pokemon_tcg_id);

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
const countGradedForCard = db.query<{ n: number }, [number]>(
  'SELECT COUNT(*) AS n FROM graded_cards WHERE card_id = ?'
);

/** A card with nothing left — no variants and no slabs — can't linger at quantity 0. */
function deleteCardIfEmpty(cardId: number): void {
  if (
    countVariantsForCard.get(cardId)!.n === 0 &&
    countGradedForCard.get(cardId)!.n === 0
  ) {
    db.query('DELETE FROM cards WHERE id = ?').run(cardId);
  }
}

export const removeVariant = db.transaction((variantId: number) => {
  const owner = selectVariantCardId.get(variantId);
  db.query('DELETE FROM card_variants WHERE id = ?').run(variantId);
  if (owner) deleteCardIfEmpty(owner.card_id);
});

export const addVariantToCard = db.transaction(
  (cardId: number, variantType: string, quantity: number) => {
    const existing = selectVariant.get(cardId, variantType);
    if (existing) {
      updateVariantQty.run(existing.quantity + quantity, existing.id);
    } else {
      insertVariant.run(cardId, variantType, quantity);
    }
  }
);

const insertGraded = db.query<{ id: number }, [number, string | null, string, string, string | null]>(
  `INSERT INTO graded_cards (card_id, variant_type, company, grade, cert_number)
   VALUES (?, ?, ?, ?, ?)
   RETURNING id`
);

export function addGradedCopy(cardId: number, input: AddGradedInput): number {
  const row = insertGraded.get(
    cardId,
    input.variantType,
    input.company,
    input.grade,
    input.certNumber
  );
  if (!row) throw new Error(`Failed to add graded copy to card ${cardId}`);
  return row.id;
}

const selectGradedCardId = db.query<{ card_id: number }, [number]>(
  'SELECT card_id FROM graded_cards WHERE id = ?'
);

export const removeGradedCopy = db.transaction((gradedId: number) => {
  const owner = selectGradedCardId.get(gradedId);
  db.query('DELETE FROM graded_cards WHERE id = ?').run(gradedId);
  if (owner) deleteCardIfEmpty(owner.card_id);
});

const selectWants = db.query<Want, []>(
  `SELECT id, pokemon_tcg_id, name, set_name, series, image_url, rarity, card_number,
          variant_type, added_at
   FROM wants ORDER BY added_at DESC, id DESC`
);

export function getWants(): Want[] {
  return selectWants.all();
}

export function getWantTcgIds(): string[] {
  return db
    .query<{ pokemon_tcg_id: string }, []>('SELECT DISTINCT pokemon_tcg_id FROM wants')
    .all()
    .map((r) => r.pokemon_tcg_id);
}

const insertWant = db.query(
  `INSERT INTO wants
     (pokemon_tcg_id, name, set_name, series, image_url, rarity, card_number, variant_type)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT DO NOTHING`
);

export function addWant(input: AddWantInput): void {
  insertWant.run(
    input.pokemon_tcg_id,
    input.name,
    input.set_name,
    input.series,
    input.image_url,
    input.rarity,
    input.card_number,
    input.variantType
  );
}

export function removeWant(wantId: number): void {
  db.query('DELETE FROM wants WHERE id = ?').run(wantId);
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
         v.quantity
       FROM cards c
       INNER JOIN card_variants v ON v.card_id = c.id
       ORDER BY c.added_at DESC, v.id ASC`
    )
    .all();
}
