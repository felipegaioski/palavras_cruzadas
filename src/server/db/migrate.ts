import type Database from "better-sqlite3";

export function migrate(database: Database.Database): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS crosswords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('direct', 'syllabic', 'arrowless')),
      rows INTEGER NOT NULL CHECK (rows BETWEEN 5 AND 30),
      columns INTEGER NOT NULL CHECK (columns BETWEEN 5 AND 30),
      word_bank TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      crossword_id INTEGER NOT NULL REFERENCES crosswords(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('answer', 'clue', 'empty')),
      row INTEGER NOT NULL,
      column INTEGER NOT NULL,
      row_span INTEGER NOT NULL DEFAULT 1 CHECK (row_span > 0),
      column_span INTEGER NOT NULL DEFAULT 1 CHECK (column_span > 0),
      content TEXT NOT NULL DEFAULT '',
      diagonal TEXT CHECK (diagonal IS NULL OR diagonal IN ('down', 'up'))
    );

    CREATE TABLE IF NOT EXISTS clue_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      polygon TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      clue_region_id INTEGER NOT NULL REFERENCES clue_regions(id) ON DELETE CASCADE,
      start_side TEXT NOT NULL,
      end_direction TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      crossword_id INTEGER NOT NULL REFERENCES crosswords(id) ON DELETE CASCADE,
      clue_region_id INTEGER NOT NULL REFERENCES clue_regions(id) ON DELETE CASCADE,
      answer TEXT NOT NULL DEFAULT '',
      cells TEXT NOT NULL,
      direction TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_areas_crossword ON areas(crossword_id);
    CREATE INDEX IF NOT EXISTS idx_regions_area ON clue_regions(area_id);
    CREATE INDEX IF NOT EXISTS idx_arrows_region ON arrows(clue_region_id);
    CREATE INDEX IF NOT EXISTS idx_words_crossword ON words(crossword_id);
  `);
}
