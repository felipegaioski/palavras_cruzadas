import type { Area, Crossword, Direction } from "./types.js";
import { areaContains, findWordConflicts } from "./grid.js";
import { regionsCoverUnit } from "./geometry.js";

const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

export function validateDimensions(rows: number, columns: number): void {
  if (
    !Number.isInteger(rows) ||
    !Number.isInteger(columns) ||
    rows < 5 ||
    rows > 30 ||
    columns < 5 ||
    columns > 30
  ) {
    throw new Error("Use entre 5 e 30 linhas e colunas.");
  }
}

export function validateCrossword(crossword: Crossword): void {
  validateDimensions(crossword.rows, crossword.columns);
  if (!crossword.title.trim()) throw new Error("Informe um título.");
  if (
    ![
      "direct",
      "syllabic",
      "arrowless",
      "thematic",
      "diagonalless",
      "directresponse",
      "letterbag"
    ].includes(crossword.kind)
  ) {
    throw new Error("Tipo de cruzada inválido.");
  }
  validateAreas(crossword);
  validateWords(crossword);
}

function validateAreas(crossword: Crossword): void {
  for (const area of crossword.areas) {
    if (
      area.row < 0 ||
      area.column < 0 ||
      area.rowSpan < 1 ||
      area.columnSpan < 1 ||
      area.row + area.rowSpan > crossword.rows ||
      area.column + area.columnSpan > crossword.columns
    ) {
      throw new Error("Há uma área fora da grade.");
    }
    if (area.kind === "clue" && area.clueRegions.length) {
      if (!regionsCoverUnit(area.clueRegions.map((region) => region.polygon))) {
        throw new Error("A divisão de um enunciado não cobre toda a área.");
      }
      for (const region of area.clueRegions) {
        for (const arrow of region.arrows) {
          if (
            !DIRECTIONS.includes(arrow.startSide) ||
            !DIRECTIONS.includes(arrow.endDirection)
          ) {
            throw new Error("Uma seta possui direção inválida.");
          }
        }
      }
    }
    if (
      area.directResponseNumber !== null &&
      (!Number.isInteger(area.directResponseNumber) ||
        area.directResponseNumber < 1 ||
        area.directResponseNumber > 99)
    ) {
      throw new Error("Uma letra-resposta possui nÃºmero invÃ¡lido.");
    }
    if (
      area.letterBagSize !== 0 &&
      (!Number.isInteger(area.letterBagSize) ||
        area.letterBagSize < 3 ||
        area.letterBagSize > 12)
    ) {
      throw new Error("Um bolsÃ£o de letras possui quantidade invÃ¡lida.");
    }
    validateResponseContent(area, crossword.kind);
  }
  for (let first = 0; first < crossword.areas.length; first += 1) {
    for (let second = first + 1; second < crossword.areas.length; second += 1) {
      if (areasOverlap(crossword.areas[first], crossword.areas[second])) {
        throw new Error("Há áreas sobrepostas na grade.");
      }
    }
  }
}

function validateResponseContent(
  area: Area,
  kind: Crossword["kind"]
): void {
  if (area.kind !== "answer") return;
  const limit =
    kind === "syllabic"
      ? 5
      : area.letterBagSize >= 3
        ? area.letterBagSize
        : area.diagonal
          ? 2
          : 1;
  if (area.content.length > limit) {
    throw new Error(
      kind === "syllabic"
        ? "Cada célula silábica aceita até cinco caracteres."
        : "Cada célula de resposta aceita uma letra."
    );
  }
}

function areasOverlap(first: Area, second: Area): boolean {
  for (let row = first.row; row < first.row + first.rowSpan; row += 1) {
    for (
      let column = first.column;
      column < first.column + first.columnSpan;
      column += 1
    ) {
      if (areaContains(second, row, column)) return true;
    }
  }
  return false;
}

function validateWords(crossword: Crossword): void {
  const regionIds = new Set(
    crossword.areas.flatMap((area) =>
      area.clueRegions.map((region) => region.id)
    )
  );
  for (const word of crossword.words) {
    if (!regionIds.has(word.clueRegionId)) {
      throw new Error("Há uma palavra sem enunciado correspondente.");
    }
    if (!DIRECTIONS.includes(word.direction)) {
      throw new Error("Há uma palavra com direção inválida.");
    }
    for (const cell of word.cells) {
      if (
        cell.row < 0 ||
        cell.column < 0 ||
        cell.row >= crossword.rows ||
        cell.column >= crossword.columns
      ) {
        throw new Error("Há uma palavra fora da grade.");
      }
    }
  }
  if (findWordConflicts(crossword.words, crossword.areas).size > 0) {
    throw new Error("Existem respostas com letras conflitantes.");
  }
}
