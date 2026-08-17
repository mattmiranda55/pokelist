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
  price_usd REAL,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  price_usd REAL NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tcg_cache (
  query_key TEXT PRIMARY KEY,
  response_json TEXT NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_variants_card ON card_variants(card_id);
CREATE INDEX IF NOT EXISTS idx_price_history_card ON price_history(card_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_card_variants_unique ON card_variants(card_id, variant_type);
