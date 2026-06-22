import { create, type StoreApi } from "zustand";
import {
  generatePolygons,
  moveDivider,
  polygonToRectangle,
  type Divider,
  type SplitOrientation
} from "../../shared/geometry";
import {
  FULL_POLYGON,
  buildWordCells,
  createEmptyArea,
  findAreaAt,
  normalizeAnswer
} from "../../shared/grid";
import { makeId } from "../../shared/ids";
import type {
  Area,
  Crossword,
  Direction,
  EditorTool,
  Word
} from "../../shared/types";

type SaveState = "saved" | "saving" | "error";

interface EditorState {
  crossword: Crossword | null;
  tool: EditorTool;
  selectedAreaId: string | null;
  selectedRegionId: string | null;
  selectedWordId: string | null;
  mergeAnchor: { row: number; column: number } | null;
  past: Crossword[];
  future: Crossword[];
  dirty: boolean;
  saveState: SaveState;
  message: string | null;
  showAnswers: boolean;
  load: (crossword: Crossword) => void;
  setTool: (tool: EditorTool) => void;
  selectArea: (areaId: string, regionId?: string) => void;
  selectWord: (wordId: string) => void;
  applyToolAt: (row: number, column: number) => void;
  updateMetadata: (
    values: Partial<Pick<Crossword, "title" | "kind" | "themeDescription">>
  ) => void;
  updateAreaContent: (areaId: string, content: string) => void;
  updateRegionThematic: (regionId: string, isThematic: boolean) => void;
  updateRegionAnswerLength: (regionId: string, answerLength: number) => void;
  divideArea: (
    areaId: string,
    contents: string[],
    orientation?: SplitOrientation
  ) => void;
  redistributeRegions: (
    areaId: string,
    orientation?: SplitOrientation
  ) => void;
  undoDivision: (areaId: string) => void;
  moveRegionDivider: (
    areaId: string,
    divider: Divider,
    position: number
  ) => void;
  updateRegionContent: (regionId: string, content: string) => void;
  upsertWord: (
    regionId: string,
    answer: string,
    startSide: Direction,
    endDirection: Direction,
    wordId?: string
  ) => void;
  removeWord: (wordId: string) => void;
  updateWordBank: (words: string[]) => void;
  resizeGrid: (rows: number, columns: number) => void;
  undo: () => void;
  redo: () => void;
  toggleAnswers: () => void;
  markSaving: () => void;
  markSaved: (crossword: Crossword) => void;
  markSaveError: (message: string) => void;
  clearMessage: () => void;
}

function cloneCrossword(crossword: Crossword): Crossword {
  return structuredClone(crossword);
}

function commit(
  set: StoreApi<EditorState>["setState"],
  mutator: (draft: Crossword, state: EditorState) => void
): void {
  set((state: EditorState) => {
    if (!state.crossword) return state;
    const previous = cloneCrossword(state.crossword);
    const next = cloneCrossword(state.crossword);
    try {
      mutator(next, state);
      return {
        ...state,
        crossword: next,
        past: [...state.past.slice(-49), previous],
        future: [],
        dirty: true,
        saveState: "saving" as const,
        message: null
      };
    } catch (error) {
      return {
        ...state,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível fazer essa alteração."
      };
    }
  });
}

function regionForArea(area: Area) {
  return {
    id: makeId("region"),
    content: area.content,
    isThematic: false,
    answerLength: 0,
    polygon: FULL_POLYGON.map((point) => ({ ...point })),
    arrows: []
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  crossword: null,
  tool: "select",
  selectedAreaId: null,
  selectedRegionId: null,
  selectedWordId: null,
  mergeAnchor: null,
  past: [],
  future: [],
  dirty: false,
  saveState: "saved",
  message: null,
  showAnswers: true,

  load: (crossword) => {
    const normalized = cloneCrossword(crossword);
    normalized.themeDescription ??= "";
    normalized.areas.forEach((area) => {
      area.clueRegions.forEach((region) => {
        region.isThematic ??= false;
        region.answerLength ??= 0;
      });
      if (
        area.clueRegions.length > 1 &&
        area.clueRegions.some(
          (region) => !polygonToRectangle(region.polygon)
        )
      ) {
        const polygons = generatePolygons(
          area.clueRegions.map((region) => region.content),
          area.columnSpan / area.rowSpan
        );
        area.clueRegions.forEach((region, index) => {
          region.polygon = polygons[index];
        });
      }
    });
    set({
      crossword: normalized,
      selectedAreaId: null,
      selectedRegionId: null,
      selectedWordId: null,
      mergeAnchor: null,
      past: [],
      future: [],
      dirty: false,
      saveState: "saved",
      message: null
    });
  },

  setTool: (tool) =>
    set((state) => ({
      tool,
      mergeAnchor: tool === "merge" ? state.mergeAnchor : null,
      message:
        tool === "merge"
          ? "Clique no primeiro e depois no último quadrado da área."
          : null
    })),

  selectArea: (areaId, regionId) =>
    set({
      selectedAreaId: areaId,
      selectedRegionId: regionId ?? null,
      selectedWordId: null
    }),

  selectWord: (wordId) => {
    const crossword = get().crossword;
    const word = crossword?.words.find((item) => item.id === wordId);
    const area = crossword?.areas.find((item) =>
      item.clueRegions.some((region) => region.id === word?.clueRegionId)
    );
    set({
      selectedWordId: wordId,
      selectedRegionId: word?.clueRegionId ?? null,
      selectedAreaId: area?.id ?? null,
      tool: "select"
    });
  },

  applyToolAt: (row, column) => {
    const state = get();
    const crossword = state.crossword;
    if (!crossword) return;
    const area = findAreaAt(crossword.areas, row, column);
    if (!area) return;

    if (state.tool === "select" || state.tool === "divide" || state.tool === "arrow") {
      get().selectArea(area.id, area.clueRegions[0]?.id);
      return;
    }

    if (state.tool === "merge") {
      if (!state.mergeAnchor) {
        set({
          mergeAnchor: { row, column },
          selectedAreaId: area.id,
          message: "Agora clique no canto oposto da área que será unida."
        });
        return;
      }
      const anchor = state.mergeAnchor;
      commit(set, (draft) => {
        const minRow = Math.min(anchor.row, row);
        const maxRow = Math.max(anchor.row, row);
        const minColumn = Math.min(anchor.column, column);
        const maxColumn = Math.max(anchor.column, column);
        const selected = draft.areas.filter(
          (item) =>
            item.row >= minRow &&
            item.column >= minColumn &&
            item.row + item.rowSpan - 1 <= maxRow &&
            item.column + item.columnSpan - 1 <= maxColumn
        );
        const expected = (maxRow - minRow + 1) * (maxColumn - minColumn + 1);
        const covered = selected.reduce(
          (sum, item) => sum + item.rowSpan * item.columnSpan,
          0
        );
        if (covered !== expected) {
          throw new Error("A seleção precisa formar um retângulo completo.");
        }
        const contentKinds = new Set(
          selected.filter((item) => item.kind !== "empty").map((item) => item.kind)
        );
        if (contentKinds.size > 1) {
          throw new Error("Não é possível unir enunciados e respostas na mesma área.");
        }
        const source = selected.find((item) => item.content) ?? selected[0];
        const kind = contentKinds.has("answer") ? "answer" : "clue";
        const merged: Area = {
          id: makeId("area"),
          kind,
          row: minRow,
          column: minColumn,
          rowSpan: maxRow - minRow + 1,
          columnSpan: maxColumn - minColumn + 1,
          content: source?.content ?? "",
          diagonal: null,
          clueRegions: []
        };
        if (kind === "clue") merged.clueRegions = [regionForArea(merged)];
        const removedRegionIds = new Set(
          selected.flatMap((item) => item.clueRegions.map((region) => region.id))
        );
        draft.words = draft.words.filter(
          (word) => !removedRegionIds.has(word.clueRegionId)
        );
        const selectedIds = new Set(selected.map((item) => item.id));
        draft.areas = [
          ...draft.areas.filter((item) => !selectedIds.has(item.id)),
          merged
        ];
        set({
          selectedAreaId: merged.id,
          selectedRegionId: merged.clueRegions[0]?.id ?? null
        });
      });
      set({ mergeAnchor: null });
      return;
    }

    commit(set, (draft) => {
      const current = draft.areas.find((item) => item.id === area.id);
      if (!current) return;
      if (state.tool === "answer") {
        const removed = new Set(current.clueRegions.map((region) => region.id));
        draft.words = draft.words.filter(
          (word) => !removed.has(word.clueRegionId)
        );
        current.kind = "answer";
        current.clueRegions = [];
      } else if (state.tool === "clue") {
        current.kind = "clue";
        current.diagonal = null;
        if (!current.clueRegions.length) {
          current.clueRegions = [regionForArea(current)];
        }
      } else if (state.tool === "separate") {
        if (current.rowSpan === 1 && current.columnSpan === 1) {
          throw new Error("Esta área já ocupa apenas um quadrado.");
        }
        const removedRegions = new Set(
          current.clueRegions.map((region) => region.id)
        );
        draft.words = draft.words.filter(
          (word) => !removedRegions.has(word.clueRegionId)
        );
        draft.areas = draft.areas.filter((item) => item.id !== current.id);
        for (
          let cellRow = current.row;
          cellRow < current.row + current.rowSpan;
          cellRow += 1
        ) {
          for (
            let cellColumn = current.column;
            cellColumn < current.column + current.columnSpan;
            cellColumn += 1
          ) {
            const cell = createEmptyArea(cellRow, cellColumn);
            if (cellRow === current.row && cellColumn === current.column) {
              cell.kind = current.kind;
              cell.content = current.content;
              if (cell.kind === "clue") cell.clueRegions = [regionForArea(cell)];
            }
            draft.areas.push(cell);
          }
        }
      } else if (state.tool === "diagonal") {
        if (current.kind !== "answer") {
          throw new Error("A diagonal só pode ser usada em uma resposta.");
        }
        current.diagonal =
          current.diagonal === null
            ? "down"
            : current.diagonal === "down"
              ? "up"
              : null;
      } else if (state.tool === "erase") {
        const removed = new Set(current.clueRegions.map((region) => region.id));
        draft.words = draft.words.filter(
          (word) => !removed.has(word.clueRegionId)
        );
        current.kind = "empty";
        current.content = "";
        current.diagonal = null;
        current.clueRegions = [];
      }
    });
    set({
      selectedAreaId: area.id,
      selectedRegionId: null
    });
  },

  updateMetadata: (values) =>
    commit(set, (draft) => {
      Object.assign(draft, values);
    }),

  updateAreaContent: (areaId, content) =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) => item.id === areaId);
      if (!area) return;
      const limit =
        draft.kind === "syllabic" ? 5 : area.diagonal ? 2 : 1;
      const normalized =
        area.kind === "answer"
          ? content.toLocaleUpperCase("pt-BR").slice(0, limit)
          : content;
      area.content = normalized;
      if (area.kind === "clue" && area.clueRegions.length === 1) {
        area.clueRegions[0].content = content;
      }
      if (area.kind === "answer") {
        draft.words.forEach((word) => {
          const cellIndexes = word.cells.flatMap((cell, index) =>
            cell.row === area.row && cell.column === area.column ? [index] : []
          );
          if (!cellIndexes.length) return;
          if (draft.kind === "syllabic") {
            const units = word.answer.split(/\s*-\s*|\s+/).filter(Boolean);
            units[cellIndexes[0]] = normalized;
            word.answer = units.join(" - ");
          } else {
            const units = Array.from(word.answer.replace(/\s/g, ""));
            if (area.diagonal && cellIndexes.length > 1) {
              cellIndexes.forEach((cellIndex, index) => {
                units[cellIndex] = normalized[index] ?? "";
              });
            } else {
              const cellValue =
                area.diagonal && normalized.length > 1
                  ? normalized[
                      word.direction === "up" || word.direction === "down" ? 0 : 1
                    ] ?? normalized[0]
                  : normalized;
              units[cellIndexes[0]] = cellValue;
            }
            word.answer = units.join("");
          }
        });
      }
    }),

  divideArea: (areaId, contents, orientation = "auto") =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) => item.id === areaId);
      if (!area) return;
      if (contents.length < 2 || contents.length > 6) {
        throw new Error("Escolha entre 2 e 6 enunciados.");
      }
      const oldRegionIds = new Set(
        area.clueRegions.map((region) => region.id)
      );
      draft.words = draft.words.filter(
        (word) => !oldRegionIds.has(word.clueRegionId)
      );
      area.kind = "clue";
      area.content = "";
      const polygons = generatePolygons(
        contents,
        area.columnSpan / area.rowSpan,
        orientation
      );
      area.clueRegions = contents.map((content, index) => ({
        id: makeId("region"),
        content,
        isThematic: false,
        answerLength: 0,
        polygon: polygons[index],
        arrows: []
      }));
      set({
        selectedRegionId: area.clueRegions[0].id,
        selectedAreaId: area.id
      });
    }),

  redistributeRegions: (areaId, orientation = "auto") =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) => item.id === areaId);
      if (!area || area.clueRegions.length < 2) return;
      const polygons = generatePolygons(
        area.clueRegions.map((region) => region.content),
        area.columnSpan / area.rowSpan,
        orientation
      );
      area.clueRegions.forEach((region, index) => {
        region.polygon = polygons[index];
      });
    }),

  undoDivision: (areaId) =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) => item.id === areaId);
      if (!area || area.clueRegions.length < 2) return;
      const oldIds = new Set(area.clueRegions.map((region) => region.id));
      draft.words = draft.words.filter(
        (word) => !oldIds.has(word.clueRegionId)
      );
      area.content = area.clueRegions.map((region) => region.content).join(" / ");
      area.clueRegions = [regionForArea(area)];
      set({ selectedRegionId: area.clueRegions[0].id });
    }),

  moveRegionDivider: (areaId, divider, position) =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) => item.id === areaId);
      if (!area || area.clueRegions.length < 2) return;
      const polygons = moveDivider(
        area.clueRegions.map((region) => region.polygon),
        divider,
        position
      );
      area.clueRegions.forEach((region, index) => {
        region.polygon = polygons[index];
      });
    }),

  updateRegionContent: (regionId, content) =>
    commit(set, (draft) => {
      const region = draft.areas
        .flatMap((area) => area.clueRegions)
        .find((item) => item.id === regionId);
      if (region) {
        region.content = content;
        if (content.trim()) region.isThematic = false;
      }
    }),

  updateRegionThematic: (regionId, isThematic) =>
    commit(set, (draft) => {
      const region = draft.areas
        .flatMap((area) => area.clueRegions)
        .find((item) => item.id === regionId);
      if (!region) return;
      region.isThematic = isThematic;
      if (isThematic) region.content = "";
    }),

  updateRegionAnswerLength: (regionId, answerLength) =>
    commit(set, (draft) => {
      const region = draft.areas
        .flatMap((area) => area.clueRegions)
        .find((item) => item.id === regionId);
      if (!region) return;
      region.answerLength = Math.max(0, Math.min(99, Math.floor(answerLength)));
    }),

  upsertWord: (regionId, answer, startSide, endDirection, wordId) =>
    commit(set, (draft) => {
      const area = draft.areas.find((item) =>
        item.clueRegions.some((region) => region.id === regionId)
      );
      const region = area?.clueRegions.find((item) => item.id === regionId);
      if (!area || !region) throw new Error("Selecione um enunciado.");
      const normalized = normalizeAnswer(answer);
      const units =
        draft.kind === "syllabic"
          ? normalized.split(/\s*-\s*|\s+/).filter(Boolean)
          : Array.from(normalized.replace(/\s/g, ""));
      if (!units.length) throw new Error("Informe a resposta.");
      if (draft.kind === "syllabic" && units.some((unit) => unit.length > 5)) {
        throw new Error("Cada sílaba pode ter no máximo cinco caracteres.");
      }
      region.answerLength = units.length;
      const cells = buildWordCells(
        area,
        startSide,
        endDirection,
        units.length,
        draft.rows,
        draft.columns,
        draft.areas,
        draft.kind
      );
      if (cells.length !== units.length) {
        throw new Error("A resposta não cabe nessa direção.");
      }
      for (const cell of cells) {
        const target = findAreaAt(draft.areas, cell.row, cell.column);
        if (!target || target.kind === "clue" || target.rowSpan > 1 || target.columnSpan > 1) {
          throw new Error("A resposta encontrou uma área de enunciado ou unida.");
        }
      }
      const diagonalOccurrences = new Map<string, number>();
      cells.forEach((cell, index) => {
        const target = findAreaAt(draft.areas, cell.row, cell.column);
        if (target) {
          target.kind = "answer";
          if (target.diagonal) {
            const letters = Array.from(target.content.padEnd(2, " "));
            const key = `${cell.row}:${cell.column}`;
            const occurrence = diagonalOccurrences.get(key) ?? 0;
            const repeatedInWord =
              cells.filter((item) => item.row === cell.row && item.column === cell.column)
                .length > 1;
            const letterIndex = repeatedInWord
              ? occurrence
              : endDirection === "up" || endDirection === "down"
                ? 0
                : 1;
            letters[letterIndex] = units[index];
            target.content = letters.join("").trimEnd();
            diagonalOccurrences.set(key, occurrence + 1);
          } else {
            target.content = units[index];
          }
          target.clueRegions = [];
        }
      });
      const existing = wordId
        ? draft.words.find(
            (word) => word.id === wordId && word.clueRegionId === regionId
          )
        : undefined;
      const regionWords = draft.words.filter(
        (word) => word.clueRegionId === regionId
      );
      const arrowIndex = existing
        ? regionWords.findIndex((word) => word.id === existing.id)
        : regionWords.length;
      const arrow = {
        id: region.arrows[arrowIndex]?.id ?? makeId("arrow"),
        startSide,
        endDirection,
        position: arrowIndex
      };
      region.arrows = existing
        ? region.arrows.map((item, index) =>
            index === arrowIndex ? arrow : item
          )
        : [...region.arrows, arrow];
      const word: Word = {
        id: existing?.id ?? makeId("word"),
        clueRegionId: regionId,
        answer: normalized,
        direction: endDirection,
        cells
      };
      draft.words = existing
        ? draft.words.map((item) => (item.id === existing.id ? word : item))
        : [...draft.words, word];
      set({ selectedWordId: word.id, selectedRegionId: regionId });
    }),

  removeWord: (wordId) =>
    commit(set, (draft) => {
      const word = draft.words.find((item) => item.id === wordId);
      if (!word) return;
      const regionWords = draft.words.filter(
        (item) => item.clueRegionId === word.clueRegionId
      );
      const arrowIndex = regionWords.findIndex((item) => item.id === wordId);
      draft.words = draft.words.filter((item) => item.id !== wordId);
      const region = draft.areas
        .flatMap((area) => area.clueRegions)
        .find((item) => item.id === word.clueRegionId);
      if (region) {
        region.arrows = region.arrows
          .filter((_arrow, index) => index !== arrowIndex)
          .map((arrow, index) => ({ ...arrow, position: index }));
      }
    }),

  updateWordBank: (words) =>
    commit(set, (draft) => {
      draft.wordBank = words.map((word) => word.trim()).filter(Boolean);
    }),

  resizeGrid: (rows, columns) =>
    commit(set, (draft) => {
      if (rows < 5 || rows > 30 || columns < 5 || columns > 30) {
        throw new Error("Use entre 5 e 30 linhas e colunas.");
      }
      const removedRegionIds = new Set(
        draft.areas
          .filter(
            (area) =>
              area.row + area.rowSpan > rows ||
              area.column + area.columnSpan > columns
          )
          .flatMap((area) => area.clueRegions.map((region) => region.id))
      );
      draft.areas = draft.areas.filter(
        (area) =>
          area.row + area.rowSpan <= rows &&
          area.column + area.columnSpan <= columns
      );
      draft.words = draft.words.filter(
        (word) =>
          !removedRegionIds.has(word.clueRegionId) &&
          word.cells.every(
            (cell) => cell.row < rows && cell.column < columns
          )
      );
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          if (!findAreaAt(draft.areas, row, column)) {
            draft.areas.push(createEmptyArea(row, column));
          }
        }
      }
      draft.rows = rows;
      draft.columns = columns;
    }),

  undo: () =>
    set((state) => {
      if (!state.crossword || !state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      return {
        ...state,
        crossword: cloneCrossword(previous),
        past: state.past.slice(0, -1),
        future: [cloneCrossword(state.crossword), ...state.future].slice(0, 50),
        dirty: true,
        saveState: "saving"
      };
    }),

  redo: () =>
    set((state) => {
      if (!state.crossword || !state.future.length) return state;
      const next = state.future[0];
      return {
        ...state,
        crossword: cloneCrossword(next),
        past: [...state.past, cloneCrossword(state.crossword)].slice(-50),
        future: state.future.slice(1),
        dirty: true,
        saveState: "saving"
      };
    }),

  toggleAnswers: () => set((state) => ({ showAnswers: !state.showAnswers })),
  markSaving: () => set({ saveState: "saving" }),
  markSaved: (crossword) =>
    set((state) => ({
      crossword,
      dirty: false,
      saveState: "saved",
      past: state.past,
      future: state.future
    })),
  markSaveError: (message) => set({ saveState: "error", message }),
  clearMessage: () => set({ message: null })
}));
