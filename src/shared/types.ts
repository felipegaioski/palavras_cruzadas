export type CrosswordKind =
  | "direct"
  | "syllabic"
  | "arrowless"
  | "thematic"
  | "diagonalless"
  | "directresponse"
  | "letterbag";
export type AreaKind = "answer" | "clue" | "empty";
export type Direction = "up" | "down" | "left" | "right";
export type Diagonal = "down" | "up" | null;

export interface Point {
  x: number;
  y: number;
}

export interface CellCoordinate {
  row: number;
  column: number;
}

export interface Arrow {
  id: string;
  startSide: Direction;
  endDirection: Direction;
  position: number;
  sourceCell?: CellCoordinate | null;
}

export interface ClueRegion {
  id: string;
  content: string;
  isThematic: boolean;
  answerLength: number;
  polygon: Point[];
  arrows: Arrow[];
}

export interface Area {
  id: string;
  kind: AreaKind;
  row: number;
  column: number;
  rowSpan: number;
  columnSpan: number;
  content: string;
  diagonal: Diagonal;
  directResponseNumber: number | null;
  letterBagSize: number;
  clueRegions: ClueRegion[];
}

export interface Word {
  id: string;
  clueRegionId: string;
  answer: string;
  direction: Direction;
  cells: CellCoordinate[];
}

export interface Crossword {
  id: number;
  title: string;
  kind: CrosswordKind;
  themeDescription: string;
  rows: number;
  columns: number;
  areas: Area[];
  words: Word[];
  wordBank: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CrosswordSummary {
  id: number;
  title: string;
  kind: CrosswordKind;
  themeDescription: string;
  rows: number;
  columns: number;
  wordCount: number;
  previewAreas: Array<
    Pick<
      Area,
      | "id"
      | "kind"
      | "row"
      | "column"
      | "rowSpan"
      | "columnSpan"
      | "content"
      | "diagonal"
      | "letterBagSize"
    >
  >;
  updatedAt: string;
}

export interface WordBankEntry {
  id: number;
  word: string;
  used: boolean;
  createdAt: string;
}

export interface CreateCrosswordInput {
  title: string;
  kind: CrosswordKind;
  themeDescription?: string;
  rows: number;
  columns: number;
}

export interface CreateWordBankEntryInput {
  word: string;
}

export type EditorTool =
  | "select"
  | "answer"
  | "clue"
  | "merge"
  | "divide"
  | "separate"
  | "arrow"
  | "diagonal"
  | "erase";

export const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];

export const KIND_LABELS: Record<CrosswordKind, string> = {
  direct: "Direta",
  syllabic: "Silábica",
  arrowless: "Sem setas",
  diagonalless: "Sem diagonal",
  directresponse: "Direta resposta",
  letterbag: "Bolsão de letras",
  thematic: "Temática"
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  up: "Cima",
  down: "Baixo",
  left: "Esquerda",
  right: "Direita"
};
