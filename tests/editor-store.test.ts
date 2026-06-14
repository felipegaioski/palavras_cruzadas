import { useEditorStore } from "../src/client/store/editor";
import { createEmptyAreas } from "../src/shared/grid";
import type { Crossword } from "../src/shared/types";

function sample(): Crossword {
  return {
    id: 99,
    title: "Editor",
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

describe("estado do editor", () => {
  beforeEach(() => {
    useEditorStore.getState().load(sample());
  });

  it("une e separa uma área retangular", () => {
    const store = useEditorStore.getState();
    store.setTool("merge");
    store.applyToolAt(0, 0);
    useEditorStore.getState().applyToolAt(1, 1);
    const merged = useEditorStore
      .getState()
      .crossword!.areas.find(
        (area) => area.row === 0 && area.column === 0
      )!;
    expect(merged.rowSpan).toBe(2);
    expect(merged.columnSpan).toBe(2);

    useEditorStore.getState().setTool("separate");
    useEditorStore.getState().applyToolAt(0, 0);
    expect(useEditorStore.getState().crossword!.areas).toHaveLength(25);
  });

  it("divide uma dica e permite desfazer/refazer", () => {
    const store = useEditorStore.getState();
    store.setTool("clue");
    store.applyToolAt(0, 0);
    const area = useEditorStore.getState().crossword!.areas[0];
    useEditorStore.getState().divideArea(area.id, ["Uma", "Duas", "Três"]);
    expect(
      useEditorStore.getState().crossword!.areas.find((item) => item.id === area.id)
        ?.clueRegions
    ).toHaveLength(3);
    useEditorStore.getState().undo();
    expect(
      useEditorStore.getState().crossword!.areas.find((item) => item.id === area.id)
        ?.clueRegions
    ).toHaveLength(1);
    useEditorStore.getState().redo();
    expect(
      useEditorStore.getState().crossword!.areas.find((item) => item.id === area.id)
        ?.clueRegions
    ).toHaveLength(3);
  });

  it("mantém várias setas por dica e sincroniza a edição da célula", () => {
    const store = useEditorStore.getState();
    store.setTool("clue");
    store.applyToolAt(2, 2);
    const area = useEditorStore
      .getState()
      .crossword!.areas.find(
        (item) => item.row === 2 && item.column === 2
      )!;
    const regionId = area.clueRegions[0].id;

    useEditorStore
      .getState()
      .upsertWord(regionId, "AB", "right", "right");
    useEditorStore.getState().selectArea(area.id, regionId);
    useEditorStore
      .getState()
      .upsertWord(regionId, "CD", "down", "down");

    const current = useEditorStore.getState().crossword!;
    expect(current.words).toHaveLength(2);
    expect(
      current.areas.find((item) => item.id === area.id)?.clueRegions[0].arrows
    ).toHaveLength(2);

    const answerArea = current.areas.find(
      (item) => item.row === 2 && item.column === 3
    )!;
    useEditorStore.getState().updateAreaContent(answerArea.id, "Z");
    expect(
      useEditorStore.getState().crossword!.words.find((word) => word.answer.endsWith("B"))
        ?.answer
    ).toBe("ZB");
  });
});
