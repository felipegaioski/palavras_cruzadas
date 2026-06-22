import { generatePolygons } from "../src/shared/geometry";
import { makeId } from "../src/shared/ids";
import { sqlite } from "../src/server/db/client";
import {
  createCrossword,
  deleteCrossword,
  duplicateCrossword,
  getCrossword,
  listCrosswords,
  saveCrossword
} from "../src/server/repository";

describe("persistência SQLite", () => {
  beforeEach(() => {
    sqlite.exec("DELETE FROM crosswords");
  });

  it("cria, salva e recupera todos os elementos", () => {
    const created = createCrossword({
      title: "Persistência",
      kind: "direct",
      rows: 5,
      columns: 6
    });
    const clueArea = created.areas[0];
    const contents = ["Capital do Brasil", "Cor do céu"];
    const polygons = generatePolygons(contents);
    clueArea.kind = "clue";
    clueArea.rowSpan = 2;
    clueArea.columnSpan = 2;
    created.areas = created.areas.filter(
      (area) => !(area.row < 2 && area.column < 2 && area.id !== clueArea.id)
    );
    clueArea.clueRegions = contents.map((content, index) => ({
      id: makeId("region"),
      content,
      isThematic: index === 1,
      answerLength: index === 0 ? 1 : 5,
      polygon: polygons[index],
      arrows: [
        {
          id: makeId("arrow"),
          startSide: "right",
          endDirection: "right",
          position: 0
        }
      ]
    }));
    created.areas.find((area) => area.row === 0 && area.column === 2)!.kind =
      "answer";
    created.areas.find((area) => area.row === 0 && area.column === 2)!.content =
      "A";
    created.areas.find(
      (area) => area.row === 0 && area.column === 2
    )!.directResponseNumber = 1;
    created.words = [
      {
        id: makeId("word"),
        clueRegionId: clueArea.clueRegions[0].id,
        answer: "A",
        direction: "right",
        cells: [{ row: 0, column: 2 }]
      }
    ];
    created.wordBank = ["A"];

    const saved = saveCrossword(created.id, created);
    const reopened = getCrossword(saved.id);

    expect(reopened.areas.find((area) => area.kind === "clue")?.clueRegions)
      .toHaveLength(2);
    expect(
      reopened.areas.find((area) => area.kind === "clue")?.clueRegions[1]
        .isThematic
    ).toBe(true);
    expect(
      reopened.areas.find((area) => area.kind === "clue")?.clueRegions[1]
        .answerLength
    ).toBe(5);
    expect(reopened.words[0].answer).toBe("A");
    expect(
      reopened.areas.find((area) => area.row === 0 && area.column === 2)
        ?.directResponseNumber
    ).toBe(1);
    expect(reopened.wordBank).toEqual(["A"]);
  });

  it("duplica e exclui uma cruzada", () => {
    const created = createCrossword({
      title: "Original",
      kind: "syllabic",
      rows: 5,
      columns: 5
    });
    const copy = duplicateCrossword(created.id);
    expect(copy.title).toContain("cópia");
    expect(listCrosswords()).toHaveLength(2);
    deleteCrossword(created.id);
    expect(listCrosswords()).toHaveLength(1);
  });
});
