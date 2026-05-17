import * as SQLite from 'expo-sqlite';

const DB_NAME = 'pokelist.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync(DB_NAME);

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pokemon_tcg_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      set_name TEXT,
      series TEXT,
      image_url TEXT,
      rarity TEXT,
      card_number TEXT,
      added_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS card_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      variant_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      price_usd REAL NOT NULL,
      fetched_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  return database;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate();
  }
  return dbPromise;
}

export function initDatabase(): Promise<void> {
  return getDatabase().then(() => undefined);
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

export async function addCardToCollection(input: AddCardInput): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO cards (pokemon_tcg_id, name, set_name, series, image_url, rarity, card_number)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(pokemon_tcg_id) DO NOTHING`,
    [
      input.pokemon_tcg_id,
      input.name,
      input.set_name,
      input.series,
      input.image_url,
      input.rarity,
      input.card_number,
    ]
  );

  if (input.price_usd != null) {
    const row = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM cards WHERE pokemon_tcg_id = ?',
      [input.pokemon_tcg_id]
    );
    if (row) {
      await db.runAsync(
        'INSERT INTO price_history (card_id, price_usd) VALUES (?, ?)',
        [row.id, input.price_usd]
      );
    }
  }
}

export async function getCollectionTcgIds(): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ pokemon_tcg_id: string }>(
    'SELECT pokemon_tcg_id FROM cards'
  );
  return new Set(rows.map((r) => r.pokemon_tcg_id));
}
