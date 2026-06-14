export type CrosswordKind = "direct" | "syllabic" | "arrowless";
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
}

export interface ClueRegion {
  id: string;
  content: string;
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
  rows: number;
  columns: number;
  wordCount: number;
  updatedAt: string;
}

export interface CreateCrosswordInput {
  title: string;
  kind: CrosswordKind;
  rows: number;
  columns: number;
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
  arrowless: "Sem setas"
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  up: "Cima",
  down: "Baixo",
  left: "Esquerda",
  right: "Direita"
};
