import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db/client.js";
import {
  areas as areasTable,
  arrows as arrowsTable,
  clueRegions as clueRegionsTable,
  crosswords as crosswordsTable,
  words as wordsTable
} from "./db/schema.js";
import { createEmptyAreas } from "../shared/grid.js";
import { makeId } from "../shared/ids.js";
import type {
  Area,
  Arrow,
  ClueRegion,
  CreateCrosswordInput,
  Crossword,
  CrosswordKind,
  CrosswordSummary,
  Direction,
  Point,
  Word
} from "../shared/types.js";
import { validateCrossword, validateDimensions } from "../shared/validation.js";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export function listCrosswords(search = ""): CrosswordSummary[] {
  const rows = db
    .select({
      id: crosswordsTable.id,
      title: crosswordsTable.title,
      kind: crosswordsTable.kind,
      themeDescription: crosswordsTable.themeDescription,
      rows: crosswordsTable.rows,
      columns: crosswordsTable.columns,
      updatedAt: crosswordsTable.updatedAt,
      wordCount: sql<number>`count(${wordsTable.id})`
    })
    .from(crosswordsTable)
    .leftJoin(wordsTable, eq(wordsTable.crosswordId, crosswordsTable.id))
    .groupBy(crosswordsTable.id)
    .orderBy(desc(crosswordsTable.updatedAt))
    .all();

  const needle = search.trim().toLocaleLowerCase("pt-BR");
  return rows
    .filter((row) => !needle || row.title.toLocaleLowerCase("pt-BR").includes(needle))
    .map((row) => ({
      ...row,
      kind: row.kind as CrosswordKind,
      wordCount: Number(row.wordCount)
    }));
}

export function createCrossword(input: CreateCrosswordInput): Crossword {
  validateDimensions(input.rows, input.columns);
  if (!input.title.trim()) throw new Error("Informe um título.");
  const now = new Date().toISOString();
  const inserted = db
    .insert(crosswordsTable)
    .values({
      title: input.title.trim(),
      kind: input.kind,
      themeDescription: input.themeDescription?.trim() ?? "",
      rows: input.rows,
      columns: input.columns,
      wordBank: "[]",
      createdAt: now,
      updatedAt: now
    })
    .returning({ id: crosswordsTable.id })
    .get();

  const crossword: Crossword = {
    id: inserted.id,
    title: input.title.trim(),
    kind: input.kind,
    themeDescription: input.themeDescription?.trim() ?? "",
    rows: input.rows,
    columns: input.columns,
    areas: createEmptyAreas(input.rows, input.columns),
    words: [],
    wordBank: [],
    createdAt: now,
    updatedAt: now
  };
  saveCrossword(inserted.id, crossword);
  return getCrossword(inserted.id);
}

export function getCrossword(id: number): Crossword {
  const crosswordRow = db
    .select()
    .from(crosswordsTable)
    .where(eq(crosswordsTable.id, id))
    .get();
  if (!crosswordRow) throw new Error("Cruzada não encontrada.");

  const areaRows = db
    .select()
    .from(areasTable)
    .where(eq(areasTable.crosswordId, id))
    .orderBy(asc(areasTable.row), asc(areasTable.column))
    .all();
  const areaIds = areaRows.map((area) => area.id);
  const regionRows = areaIds.length
    ? db
        .select()
        .from(clueRegionsTable)
        .where(inArray(clueRegionsTable.areaId, areaIds))
        .orderBy(asc(clueRegionsTable.position))
        .all()
    : [];
  const regionIds = regionRows.map((region) => region.id);
  const arrowRows = regionIds.length
    ? db
        .select()
        .from(arrowsTable)
        .where(inArray(arrowsTable.clueRegionId, regionIds))
        .orderBy(asc(arrowsTable.position))
        .all()
    : [];
  const wordRows = db
    .select()
    .from(wordsTable)
    .where(eq(wordsTable.crosswordId, id))
    .all();

  const regionsByArea = new Map<number, ClueRegion[]>();
  const clientRegionByDbId = new Map<number, string>();
  for (const region of regionRows) {
    clientRegionByDbId.set(region.id, region.clientId);
    const item: ClueRegion = {
      id: region.clientId,
      content: region.content,
      isThematic: region.isThematic,
      polygon: parseJson<Point[]>(region.polygon, []),
      arrows: arrowRows
        .filter((arrow) => arrow.clueRegionId === region.id)
        .map(
          (arrow): Arrow => ({
            id: arrow.clientId,
            startSide: arrow.startSide as Direction,
            endDirection: arrow.endDirection as Direction,
            position: arrow.position
          })
        )
    };
    const current = regionsByArea.get(region.areaId) ?? [];
    current.push(item);
    regionsByArea.set(region.areaId, current);
  }

  return {
    id: crosswordRow.id,
    title: crosswordRow.title,
    kind: crosswordRow.kind as CrosswordKind,
    themeDescription: crosswordRow.themeDescription ?? "",
    rows: crosswordRow.rows,
    columns: crosswordRow.columns,
    wordBank: parseJson<string[]>(crosswordRow.wordBank, []),
    createdAt: crosswordRow.createdAt,
    updatedAt: crosswordRow.updatedAt,
    areas: areaRows.map(
      (area): Area => ({
        id: area.clientId,
        kind: area.kind as Area["kind"],
        row: area.row,
        column: area.column,
        rowSpan: area.rowSpan,
        columnSpan: area.columnSpan,
        content: area.content,
        diagonal: area.diagonal as Area["diagonal"],
        clueRegions: regionsByArea.get(area.id) ?? []
      })
    ),
    words: wordRows.map(
      (word): Word => ({
        id: word.clientId,
        clueRegionId: clientRegionByDbId.get(word.clueRegionId) ?? "",
        answer: word.answer,
        direction: word.direction as Direction,
        cells: parseJson(word.cells, [])
      })
    )
  };
}

export function saveCrossword(id: number, crossword: Crossword): Crossword {
  if (id !== crossword.id) throw new Error("Identificador da cruzada inválido.");
  validateCrossword(crossword);
  const existing = db
    .select({ id: crosswordsTable.id })
    .from(crosswordsTable)
    .where(eq(crosswordsTable.id, id))
    .get();
  if (!existing) throw new Error("Cruzada não encontrada.");
  const updatedAt = new Date().toISOString();

  db.transaction((transaction) => {
    transaction
      .update(crosswordsTable)
      .set({
        title: crossword.title.trim(),
        kind: crossword.kind,
        themeDescription: crossword.themeDescription.trim(),
        rows: crossword.rows,
        columns: crossword.columns,
        wordBank: JSON.stringify(crossword.wordBank),
        updatedAt
      })
      .where(eq(crosswordsTable.id, id))
      .run();

    transaction.delete(areasTable).where(eq(areasTable.crosswordId, id)).run();
    persistChildren(transaction, id, crossword);
  });

  return getCrossword(id);
}

function persistChildren(
  transaction: Transaction,
  crosswordId: number,
  crossword: Crossword
): void {
  const regionDbIds = new Map<string, number>();
  for (const area of crossword.areas) {
    const insertedArea = transaction
      .insert(areasTable)
      .values({
        clientId: area.id,
        crosswordId,
        kind: area.kind,
        row: area.row,
        column: area.column,
        rowSpan: area.rowSpan,
        columnSpan: area.columnSpan,
        content: area.content,
        diagonal: area.diagonal
      })
      .returning({ id: areasTable.id })
      .get();

    area.clueRegions.forEach((region, position) => {
      const insertedRegion = transaction
        .insert(clueRegionsTable)
        .values({
          clientId: region.id,
          areaId: insertedArea.id,
          content: region.content,
          isThematic: region.isThematic,
          polygon: JSON.stringify(region.polygon),
          position
        })
        .returning({ id: clueRegionsTable.id })
        .get();
      regionDbIds.set(region.id, insertedRegion.id);

      if (region.arrows.length) {
        transaction
          .insert(arrowsTable)
          .values(
            region.arrows.map((arrow, arrowPosition) => ({
              clientId: arrow.id,
              clueRegionId: insertedRegion.id,
              startSide: arrow.startSide,
              endDirection: arrow.endDirection,
              position: arrowPosition
            }))
          )
          .run();
      }
    });
  }

  if (crossword.words.length) {
    transaction
      .insert(wordsTable)
      .values(
        crossword.words.map((word) => {
          const clueRegionId = regionDbIds.get(word.clueRegionId);
          if (!clueRegionId) throw new Error("Palavra sem região de enunciado.");
          return {
            clientId: word.id,
            crosswordId,
            clueRegionId,
            answer: word.answer,
            cells: JSON.stringify(word.cells),
            direction: word.direction
          };
        })
      )
      .run();
  }
}

export function duplicateCrossword(id: number): Crossword {
  const source = getCrossword(id);
  const now = new Date().toISOString();
  const inserted = db
    .insert(crosswordsTable)
    .values({
      title: `${source.title} - cópia`,
      kind: source.kind,
      themeDescription: source.themeDescription,
      rows: source.rows,
      columns: source.columns,
      wordBank: JSON.stringify(source.wordBank),
      createdAt: now,
      updatedAt: now
    })
    .returning({ id: crosswordsTable.id })
    .get();

  const cloned = cloneWithFreshIds(source, inserted.id, now);
  saveCrossword(inserted.id, cloned);
  return getCrossword(inserted.id);
}

export function deleteCrossword(id: number): void {
  const result = db
    .delete(crosswordsTable)
    .where(eq(crosswordsTable.id, id))
    .run();
  if (!result.changes) throw new Error("Cruzada não encontrada.");
}

function cloneWithFreshIds(
  source: Crossword,
  id: number,
  now: string
): Crossword {
  const regionMap = new Map<string, string>();
  const areas = source.areas.map((area) => ({
    ...area,
    id: makeId("area"),
    clueRegions: area.clueRegions.map((region) => {
      const regionId = makeId("region");
      regionMap.set(region.id, regionId);
      return {
        ...region,
        id: regionId,
        polygon: region.polygon.map((point) => ({ ...point })),
        arrows: region.arrows.map((arrow) => ({
          ...arrow,
          id: makeId("arrow")
        }))
      };
    })
  }));
  return {
    ...source,
    id,
    title: `${source.title} - cópia`,
    createdAt: now,
    updatedAt: now,
    areas,
    words: source.words.map((word) => ({
      ...word,
      id: makeId("word"),
      clueRegionId: regionMap.get(word.clueRegionId) ?? word.clueRegionId,
      cells: word.cells.map((cell) => ({ ...cell }))
    }))
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
