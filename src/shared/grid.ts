import type {
  Area,
  CellCoordinate,
  Crossword,
  Direction,
  Word
} from "./types.js";
import { makeId } from "./ids.js";

export const FULL_POLYGON = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 }
];

export function createEmptyAreas(rows: number, columns: number): Area[] {
  const areas: Area[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      areas.push(createEmptyArea(row, column));
    }
  }
  return areas;
}

export function createEmptyArea(row: number, column: number): Area {
  return {
    id: makeId("area"),
    kind: "empty",
    row,
    column,
    rowSpan: 1,
    columnSpan: 1,
    content: "",
    diagonal: null,
    clueRegions: []
  };
}

export function areaContains(
  area: Area,
  row: number,
  column: number
): boolean {
  return (
    row >= area.row &&
    row < area.row + area.rowSpan &&
    column >= area.column &&
    column < area.column + area.columnSpan
  );
}

export function findAreaAt(
  areas: Area[],
  row: number,
  column: number
): Area | undefined {
  return areas.find((area) => areaContains(area, row, column));
}

export function cellKey(cell: CellCoordinate): string {
  return `${cell.row}:${cell.column}`;
}

export function normalizeAnswer(answer: string): string {
  return answer.trim().toLocaleUpperCase("pt-BR");
}

export function answerUnits(answer: string, kind: Crossword["kind"]): string[] {
  return kind === "syllabic"
    ? answer.split(/\s*-\s*|\s+/).filter(Boolean)
    : Array.from(normalizeAnswer(answer).replace(/\s/g, ""));
}

export function stepFor(direction: Direction): CellCoordinate {
  switch (direction) {
    case "up":
      return { row: -1, column: 0 };
    case "down":
      return { row: 1, column: 0 };
    case "left":
      return { row: 0, column: -1 };
    case "right":
      return { row: 0, column: 1 };
  }
}

export function firstCellFromArea(
  area: Area,
  startSide: Direction
): CellCoordinate {
  const middleRow = area.row + Math.floor((area.rowSpan - 1) / 2);
  const middleColumn = area.column + Math.floor((area.columnSpan - 1) / 2);
  switch (startSide) {
    case "up":
      return { row: area.row - 1, column: middleColumn };
    case "down":
      return { row: area.row + area.rowSpan, column: middleColumn };
    case "left":
      return { row: middleRow, column: area.column - 1 };
    case "right":
      return { row: middleRow, column: area.column + area.columnSpan };
  }
}

export function buildWordCells(
  area: Area,
  startSide: Direction,
  direction: Direction,
  length: number,
  rows: number,
  columns: number,
  areas: Area[] = [],
  kind: Crossword["kind"] = "direct"
): CellCoordinate[] {
  const first = firstCellFromArea(area, startSide);
  const step = stepFor(direction);
  const cells: CellCoordinate[] = [];
  for (let offset = 0; cells.length < length; offset += 1) {
    const cell = {
      row: first.row + step.row * offset,
      column: first.column + step.column * offset
    };
    if (
      cell.row < 0 ||
      cell.column < 0 ||
      cell.row >= rows ||
      cell.column >= columns
    ) {
      break;
    }
    cells.push(cell);
    const target = findAreaAt(areas, cell.row, cell.column);
    if (kind !== "syllabic" && target?.diagonal && cells.length < length) {
      cells.push({ ...cell });
    }
  }
  return cells;
}

export function wordState(
  word: Word,
  crossword: Pick<Crossword, "areas" | "words" | "kind">
): "complete" | "incomplete" | "conflict" {
  const conflicts = findWordConflicts(crossword.words, crossword.areas);
  if (conflicts.has(word.id)) return "conflict";
  const answerUnits =
    crossword.kind === "syllabic"
      ? word.answer.split(/\s*-\s*|\s+/).filter(Boolean)
      : Array.from(word.answer.replace(/\s/g, ""));
  return word.cells.length > 0 && word.cells.length === answerUnits.length
    ? "complete"
    : "incomplete";
}

export function findWordConflicts(
  words: Word[],
  areas: Area[] = []
): Set<string> {
  const values = new Map<
    string,
    Array<{ value: string; wordId: string }>
  >();
  const conflicts = new Set<string>();
  for (const word of words) {
    const units = Array.from(normalizeAnswer(word.answer).replace(/\s/g, ""));
    word.cells.forEach((cell, index) => {
      const key = cellKey(cell);
      const current = units[index] ?? "";
      const previous = values.get(key) ?? [];
      const area = findAreaAt(areas, cell.row, cell.column);
      const different = previous.filter((item) => item.value !== current);
      if (different.length && !area?.diagonal) {
        different.forEach((item) => conflicts.add(item.wordId));
        conflicts.add(word.id);
      } else if (current) {
        previous.push({ value: current, wordId: word.id });
        values.set(key, previous);
      }
    });
  }
  return conflicts;
}

export function responseValues(crossword: Crossword): Map<string, string> {
  const result = new Map<string, string>();
  for (const area of crossword.areas) {
    if (area.kind === "answer" && area.content) {
      result.set(cellKey({ row: area.row, column: area.column }), area.content);
    }
  }
  for (const word of crossword.words) {
    const units = answerUnits(word.answer, crossword.kind);
    const diagonalOccurrences = new Map<string, number>();
    word.cells.forEach((cell, index) => {
      if (!units[index]) return;
      const key = cellKey(cell);
      const area = findAreaAt(crossword.areas, cell.row, cell.column);
      const current = result.get(key) ?? "";
      if (area?.diagonal) {
        const letters = Array.from(current.padEnd(2, " "));
        const occurrence = diagonalOccurrences.get(key) ?? 0;
        const repeatedInWord =
          word.cells.filter((item) => cellKey(item) === key).length > 1;
        const letterIndex = repeatedInWord
          ? occurrence
          : word.direction === "up" || word.direction === "down"
            ? 0
            : 1;
        letters[letterIndex] = units[index];
        result.set(key, letters.join("").trimEnd());
        diagonalOccurrences.set(key, occurrence + 1);
      } else if (!current) {
        result.set(key, units[index]);
      }
    });
  }
  return result;
}
