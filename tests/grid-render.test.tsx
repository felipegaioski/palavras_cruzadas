import { renderToStaticMarkup } from "react-dom/server";
import { CrosswordGrid } from "../src/client/components/CrosswordGrid";
import { createEmptyAreas } from "../src/shared/grid";
import type { Crossword } from "../src/shared/types";

describe("renderização da grade", () => {
  it("leva a seta da borda da dica até a entrada da primeira resposta distante", () => {
    const areas = createEmptyAreas(10, 10);
    const clue = areas.find((area) => area.row === 1 && area.column === 1)!;
    const covered = new Set(
      areas
        .filter(
          (area) =>
            area.row >= 1 &&
            area.row < 3 &&
            area.column >= 1 &&
            area.column < 3
        )
        .map((area) => area.id)
    );
    const visibleAreas = areas.filter(
      (area) => !covered.has(area.id) || area.id === clue.id
    );
    clue.kind = "clue";
    clue.rowSpan = 2;
    clue.columnSpan = 2;
    clue.clueRegions = [
      {
        id: "region",
        content: "Resposta distante",
        polygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 }
        ],
        arrows: [
          {
            id: "arrow",
            startSide: "right",
            endDirection: "down",
            position: 0
          }
        ]
      }
    ];

    const crossword: Crossword = {
      id: 1,
      title: "Seta",
      kind: "direct",
      rows: 10,
      columns: 10,
      areas: visibleAreas,
      words: [
        {
          id: "word",
          clueRegionId: "region",
          answer: "SOL",
          direction: "down",
          cells: [
            { row: 4, column: 6 },
            { row: 5, column: 6 },
            { row: 6, column: 6 }
          ]
        }
      ],
      wordBank: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    };

    const markup = renderToStaticMarkup(
      <CrosswordGrid crossword={crossword} showAnswers readOnly />
    );

    const arrowPath = markup.match(/class="clue-arrow[^"]*" d="([^"]+)"/)?.[1];
    expect(arrowPath).toBeDefined();
    expect(arrowPath).toContain("M 168");
    expect(arrowPath).toContain("L 364 239");
  });
});
