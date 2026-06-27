import type Database from "better-sqlite3";

export function migrate(database: Database.Database): void {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS crosswords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('direct', 'syllabic', 'arrowless', 'thematic', 'diagonalless', 'directresponse', 'letterbag')),
      theme_description TEXT NOT NULL DEFAULT '',
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
      diagonal TEXT CHECK (diagonal IS NULL OR diagonal IN ('down', 'up')),
      direct_response_number INTEGER,
      letter_bag_size INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS clue_regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      area_id INTEGER NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
      content TEXT NOT NULL DEFAULT '',
      is_thematic INTEGER NOT NULL DEFAULT 0,
      answer_length INTEGER NOT NULL DEFAULT 0,
      text_scale INTEGER NOT NULL DEFAULT 100,
      polygon TEXT NOT NULL,
      position INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arrows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id TEXT NOT NULL,
      clue_region_id INTEGER NOT NULL REFERENCES clue_regions(id) ON DELETE CASCADE,
      start_side TEXT NOT NULL,
      end_direction TEXT NOT NULL,
      source_row INTEGER,
      source_column INTEGER,
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

    CREATE TABLE IF NOT EXISTS word_bank_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_areas_crossword ON areas(crossword_id);
    CREATE INDEX IF NOT EXISTS idx_regions_area ON clue_regions(area_id);
    CREATE INDEX IF NOT EXISTS idx_arrows_region ON arrows(clue_region_id);
    CREATE INDEX IF NOT EXISTS idx_words_crossword ON words(crossword_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_word_bank_entries_word ON word_bank_entries(word);
  `);

  const crosswordColumns = database
    .prepare("PRAGMA table_info(crosswords)")
    .all() as Array<{ name: string }>;
  if (!crosswordColumns.some((column) => column.name === "theme_description")) {
    database.exec("ALTER TABLE crosswords ADD COLUMN theme_description TEXT NOT NULL DEFAULT '';");
  }

  const clueRegionColumns = database
    .prepare("PRAGMA table_info(clue_regions)")
    .all() as Array<{ name: string }>;
  if (!clueRegionColumns.some((column) => column.name === "is_thematic")) {
    database.exec("ALTER TABLE clue_regions ADD COLUMN is_thematic INTEGER NOT NULL DEFAULT 0;");
  }
  if (!clueRegionColumns.some((column) => column.name === "answer_length")) {
    database.exec("ALTER TABLE clue_regions ADD COLUMN answer_length INTEGER NOT NULL DEFAULT 0;");
  }
  if (!clueRegionColumns.some((column) => column.name === "text_scale")) {
    database.exec("ALTER TABLE clue_regions ADD COLUMN text_scale INTEGER NOT NULL DEFAULT 100;");
  }

  const areaColumns = database
    .prepare("PRAGMA table_info(areas)")
    .all() as Array<{ name: string }>;
  if (!areaColumns.some((column) => column.name === "direct_response_number")) {
    database.exec("ALTER TABLE areas ADD COLUMN direct_response_number INTEGER;");
  }
  if (!areaColumns.some((column) => column.name === "letter_bag_size")) {
    database.exec("ALTER TABLE areas ADD COLUMN letter_bag_size INTEGER NOT NULL DEFAULT 0;");
  }

  const arrowColumns = database
    .prepare("PRAGMA table_info(arrows)")
    .all() as Array<{ name: string }>;
  if (!arrowColumns.some((column) => column.name === "source_row")) {
    database.exec("ALTER TABLE arrows ADD COLUMN source_row INTEGER;");
  }
  if (!arrowColumns.some((column) => column.name === "source_column")) {
    database.exec("ALTER TABLE arrows ADD COLUMN source_column INTEGER;");
  }

  const crosswordSql = database
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'crosswords'")
    .get() as { sql?: string } | undefined;
  if (crosswordSql?.sql && !crosswordSql.sql.includes("'letterbag'")) {
    database.exec(`
      PRAGMA foreign_keys = OFF;

      CREATE TABLE crosswords_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('direct', 'syllabic', 'arrowless', 'thematic', 'diagonalless', 'directresponse', 'letterbag')),
        theme_description TEXT NOT NULL DEFAULT '',
        rows INTEGER NOT NULL CHECK (rows BETWEEN 5 AND 30),
        columns INTEGER NOT NULL CHECK (columns BETWEEN 5 AND 30),
        word_bank TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO crosswords_new (
        id,
        title,
        kind,
        theme_description,
        rows,
        columns,
        word_bank,
        created_at,
        updated_at
      )
      SELECT
        id,
        title,
        kind,
        theme_description,
        rows,
        columns,
        word_bank,
        created_at,
        updated_at
      FROM crosswords;

      DROP TABLE crosswords;
      ALTER TABLE crosswords_new RENAME TO crosswords;
      PRAGMA foreign_keys = ON;
    `);
  }
}
