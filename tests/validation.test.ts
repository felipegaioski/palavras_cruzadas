import { createEmptyAreas, FULL_POLYGON } from "../src/shared/grid";
import type { Crossword } from "../src/shared/types";
import {
  validateCrossword,
  validateDimensions
} from "../src/shared/validation";

function crossword(): Crossword {
  return {
    id: 1,
    title: "Teste",
    kind: "direct",
    rows: 5,
    columns: 5,
    areas: createEmptyAreas(5, 5),
    words: [],
    wordBank: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

describe("validação", () => {
  it("aceita dimensões entre 5 e 30", () => {
    expect(() => validateDimensions(5, 30)).not.toThrow();
  });

  it("rejeita dimensões fora do limite", () => {
    expect(() => validateDimensions(4, 10)).toThrow(
      "Use entre 5 e 30 linhas e colunas."
    );
  });

  it("rejeita áreas sobrepostas", () => {
    const value = crossword();
    value.areas.push({
      ...value.areas[0],
      id: "sobreposta"
    });
    expect(() => validateCrossword(value)).toThrow("áreas sobrepostas");
  });

  it("rejeita conflito entre respostas", () => {
    const value = crossword();
    value.areas[0] = {
      ...value.areas[0],
      kind: "clue",
      clueRegions: [
        {
          id: "r1",
          content: "Primeira",
          polygon: FULL_POLYGON,
          arrows: []
        },
        {
          id: "r2",
          content: "Segunda",
          polygon: FULL_POLYGON,
          arrows: []
        }
      ]
    };
    value.words = [
      {
        id: "w1",
        clueRegionId: "r1",
        answer: "A",
        direction: "right",
        cells: [{ row: 1, column: 1 }]
      },
      {
        id: "w2",
        clueRegionId: "r2",
        answer: "B",
        direction: "down",
        cells: [{ row: 1, column: 1 }]
      }
    ];
    expect(() => validateCrossword(value)).toThrow();
  });
});
