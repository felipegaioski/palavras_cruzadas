import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const crosswords = sqliteTable("crosswords", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  themeDescription: text("theme_description").notNull().default(""),
  rows: integer("rows").notNull(),
  columns: integer("columns").notNull(),
  wordBank: text("word_bank").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull(),
  crosswordId: integer("crossword_id")
    .notNull()
    .references(() => crosswords.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  row: integer("row").notNull(),
  column: integer("column").notNull(),
  rowSpan: integer("row_span").notNull().default(1),
  columnSpan: integer("column_span").notNull().default(1),
  content: text("content").notNull().default(""),
  diagonal: text("diagonal")
});

export const clueRegions = sqliteTable("clue_regions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull(),
  areaId: integer("area_id")
    .notNull()
    .references(() => areas.id, { onDelete: "cascade" }),
  content: text("content").notNull().default(""),
  isThematic: integer("is_thematic", { mode: "boolean" }).notNull().default(false),
  polygon: text("polygon").notNull(),
  position: integer("position").notNull()
});

export const arrows = sqliteTable("arrows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull(),
  clueRegionId: integer("clue_region_id")
    .notNull()
    .references(() => clueRegions.id, { onDelete: "cascade" }),
  startSide: text("start_side").notNull(),
  endDirection: text("end_direction").notNull(),
  position: integer("position").notNull()
});

export const words = sqliteTable("words", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clientId: text("client_id").notNull(),
  crosswordId: integer("crossword_id")
    .notNull()
    .references(() => crosswords.id, { onDelete: "cascade" }),
  clueRegionId: integer("clue_region_id")
    .notNull()
    .references(() => clueRegions.id, { onDelete: "cascade" }),
  answer: text("answer").notNull().default(""),
  cells: text("cells").notNull(),
  direction: text("direction").notNull()
});
