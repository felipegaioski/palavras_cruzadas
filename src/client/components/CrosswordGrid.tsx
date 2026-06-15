import { useMemo, useRef, useState } from "react";
import {
  findDividers,
  polygonToRectangle,
  textLikelyFits,
  type Divider
} from "../../shared/geometry";
import {
  cellKey,
  responseValues
} from "../../shared/grid";
import type {
  Area,
  Crossword,
  Direction,
  EditorTool,
  Point,
  Word
} from "../../shared/types";

const CELL = 56;

interface CrosswordGridProps {
  crossword: Crossword;
  showAnswers: boolean;
  answerSheet?: boolean;
  readOnly?: boolean;
  selectedAreaId?: string | null;
  selectedRegionId?: string | null;
  selectedWordId?: string | null;
  tool?: EditorTool;
  onCellClick?: (row: number, column: number) => void;
  onRegionClick?: (areaId: string, regionId: string) => void;
  onMoveDivider?: (
    areaId: string,
    divider: Divider,
    position: number
  ) => void;
}

export function CrosswordGrid({
  crossword,
  showAnswers,
  answerSheet = false,
  readOnly = false,
  selectedAreaId,
  selectedRegionId,
  selectedWordId,
  tool = "select",
  onCellClick,
  onRegionClick,
  onMoveDivider
}: CrosswordGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingAreaId, setDraggingAreaId] = useState<string | null>(null);
  const answers = useMemo(() => responseValues(crossword), [crossword]);
  const selectedWord = crossword.words.find((word) => word.id === selectedWordId);
  const selectedCells = new Set(selectedWord?.cells.map(cellKey) ?? []);

  const eventPoint = (event: React.PointerEvent<SVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse()
    );
    return { x: point.x, y: point.y };
  };

  const handleGridPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly || draggingAreaId) return;
    const point = eventPoint(event);
    if (!point) return;
    const column = Math.floor(point.x / CELL);
    const row = Math.floor(point.y / CELL);
    if (
      row >= 0 &&
      column >= 0 &&
      row < crossword.rows &&
      column < crossword.columns
    ) {
      onCellClick?.(row, column);
    }
  };

  return (
    <svg
      ref={svgRef}
      className={`crossword-grid ${readOnly ? "is-readonly" : ""}`}
      viewBox={`0 0 ${crossword.columns * CELL} ${crossword.rows * CELL}`}
      role="grid"
      aria-label={`Grade de ${crossword.rows} linhas por ${crossword.columns} colunas`}
      onPointerDown={handleGridPointer}
    >
      <defs>
        <marker
          id="arrow-head"
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L0,6 L7,3 z" fill="currentColor" />
        </marker>
      </defs>

      {crossword.areas.map((area) => (
        <AreaView
          key={area.id}
          area={area}
          crossword={crossword}
          answers={answers}
          selected={
            area.id === selectedAreaId ||
            area.clueRegions.some((region) => region.id === selectedRegionId)
          }
          selectedRegionId={selectedRegionId}
          selectedCells={selectedCells}
          showAnswers={showAnswers}
          answerSheet={answerSheet}
          readOnly={readOnly}
          tool={tool}
          onRegionClick={onRegionClick}
        />
      ))}

      {!answerSheet && crossword.kind !== "arrowless" &&
        crossword.areas.flatMap((area) =>
          area.clueRegions.flatMap((region) => {
            const regionWords = crossword.words.filter(
              (word) => word.clueRegionId === region.id
            );
            return region.arrows.flatMap((arrow, index) => {
              const word = regionWords[index];
              if (!word?.cells.length) return [];
              return [
                <ArrowView
                  key={arrow.id}
                  area={area}
                  region={region.polygon}
                  word={word}
                  startSide={arrow.startSide}
                  endDirection={arrow.endDirection}
                  selected={word.id === selectedWordId}
                />
              ];
            });
          })
        )}

      {!readOnly &&
        crossword.areas
          .filter(
            (area) =>
              area.id === selectedAreaId && area.clueRegions.length > 1
          )
          .flatMap((area) =>
            findDividers(
              area.clueRegions.map((region) => region.polygon)
            ).map((divider) => {
              const vertical = divider.axis === "vertical";
              const x = (
                area.column +
                (vertical ? divider.position : (divider.start + divider.end) / 2) *
                  area.columnSpan
              ) * CELL;
              const y = (
                area.row +
                (vertical ? (divider.start + divider.end) / 2 : divider.position) *
                  area.rowSpan
              ) * CELL;
              return (
                <circle
                  key={`${area.id}-${divider.id}`}
                  className={`divider-handle ${vertical ? "vertical" : "horizontal"}`}
                  cx={x}
                  cy={y}
                  r={8}
                  aria-label={`Ajustar divisão ${vertical ? "vertical" : "horizontal"}`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDraggingAreaId(area.id);
                  }}
                  onPointerMove={(event) => {
                    if (draggingAreaId !== area.id) return;
                    const point = eventPoint(event);
                    if (!point) return;
                    const position = vertical
                      ? (point.x / CELL - area.column) / area.columnSpan
                      : (point.y / CELL - area.row) / area.rowSpan;
                    onMoveDivider?.(area.id, divider, position);
                  }}
                  onPointerUp={(event) => {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                    setDraggingAreaId(null);
                  }}
                />
              );
            })
          )}
    </svg>
  );
}

interface AreaViewProps {
  area: Area;
  crossword: Crossword;
  answers: Map<string, string>;
  selected: boolean;
  selectedRegionId?: string | null;
  selectedCells: Set<string>;
  showAnswers: boolean;
  answerSheet: boolean;
  readOnly: boolean;
  tool: EditorTool;
  onRegionClick?: (areaId: string, regionId: string) => void;
}

function AreaView({
  area,
  crossword,
  answers,
  selected,
  selectedRegionId,
  selectedCells,
  showAnswers,
  answerSheet,
  readOnly,
  tool,
  onRegionClick
}: AreaViewProps) {
  const x = area.column * CELL;
  const y = area.row * CELL;
  const width = area.columnSpan * CELL;
  const height = area.rowSpan * CELL;
  const answer = answers.get(cellKey({ row: area.row, column: area.column }));
  const isWordCell = selectedCells.has(
    cellKey({ row: area.row, column: area.column })
  );

  return (
    <g className={`grid-area kind-${area.kind}`}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        className={[
          "area-background",
          selected ? "is-selected" : "",
          isWordCell ? "is-word-selected" : ""
        ].join(" ")}
      />
      {answerSheet && area.kind === "clue" && (
        <rect x={x} y={y} width={width} height={height} className="answer-clue-block" />
      )}
      {!answerSheet && area.kind === "clue" &&
        area.clueRegions.map((region) => {
          const rectangle = polygonToRectangle(region.polygon);
          const points = region.polygon
            .map(
              (point) =>
                `${x + point.x * width},${y + point.y * height}`
            )
            .join(" ");
          const fits = textLikelyFits(
            region.content,
            region.polygon,
            width,
            height
          );
          return (
            <g
              key={region.id}
              className={[
                "clue-region",
                region.id === selectedRegionId ? "is-selected" : "",
                fits ? "" : "has-overflow"
              ].join(" ")}
              onPointerDown={(event) => {
                if (readOnly || !["select", "divide", "arrow"].includes(tool)) {
                  return;
                }
                event.stopPropagation();
                onRegionClick?.(area.id, region.id);
              }}
            >
              <polygon points={points} />
              <foreignObject
                x={x + (rectangle?.left ?? 0) * width + 3}
                y={y + (rectangle?.top ?? 0) * height + 3}
                width={Math.max(
                  18,
                  ((rectangle?.right ?? 1) - (rectangle?.left ?? 0)) * width - 6
                )}
                height={Math.max(
                  18,
                  ((rectangle?.bottom ?? 1) - (rectangle?.top ?? 0)) * height - 6
                )}
                pointerEvents="none"
              >
                <div className="clue-text" title={region.content}>
                  {region.content || "Enunciado"}
                </div>
              </foreignObject>
            </g>
          );
        })}
      {area.kind === "answer" && showAnswers && answer && (
        area.diagonal && answer.length > 1 ? (
          <>
            <text
              className="answer diagonal-answer first"
              x={x + width * (area.diagonal === "down" ? 0.72 : 0.28)}
              y={y + height * 0.28}
              dominantBaseline="central"
              textAnchor="middle"
            >
              {answer[0]}
            </text>
            <text
              className="answer diagonal-answer second"
              x={x + width * (area.diagonal === "down" ? 0.28 : 0.72)}
              y={y + height * 0.72}
              dominantBaseline="central"
              textAnchor="middle"
            >
              {answer[1]}
            </text>
          </>
        ) : (
          <text
            className={crossword.kind === "syllabic" ? "answer syllable" : "answer"}
            x={x + width / 2}
            y={y + height / 2}
            dominantBaseline="central"
            textAnchor="middle"
          >
            {answer}
          </text>
        )
      )}
      {area.diagonal && (
        <line
          className="diagonal"
          x1={area.diagonal === "down" ? x : x + width}
          y1={y}
          x2={area.diagonal === "down" ? x + width : x}
          y2={y + height}
        />
      )}
    </g>
  );
}

function ArrowView({
  area,
  region,
  word,
  startSide,
  endDirection,
  selected
}: {
  area: Area;
  region: Point[];
  word: Word;
  startSide: Direction;
  endDirection: Direction;
  selected: boolean;
}) {
  const width = area.columnSpan * CELL;
  const height = area.rowSpan * CELL;
  const rectangle = polygonToRectangle(region);
  const firstCell = word.cells[0];
  if (!rectangle || !firstCell) return null;

  const cellBounds = {
    left: firstCell.column * CELL,
    top: firstCell.row * CELL,
    right: (firstCell.column + 1) * CELL,
    bottom: (firstCell.row + 1) * CELL
  };
  const regionCenter = {
    x: (rectangle.left + rectangle.right) / 2,
    y: (rectangle.top + rectangle.bottom) / 2
  };
  const path = arrowPointsInCell(
    startSide,
    endDirection,
    cellBounds,
    regionCenter
  )
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  return (
    <path
      className={`clue-arrow ${selected ? "is-selected" : ""}`}
      d={path}
      markerEnd="url(#arrow-head)"
    />
  );
}

function directionVector(direction: Direction): Point {
  switch (direction) {
    case "up":
      return { x: 0, y: -1 };
    case "down":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
  }
}

function arrowPointsInCell(
  startSide: Direction,
  direction: Direction,
  bounds: { left: number; top: number; right: number; bottom: number },
  alignment: Point
): Point[] {
  const inset = 7;
  const leg = 16;
  const straightLength = 22;
  const aligned = {
    x: clamp(
      bounds.left + (bounds.right - bounds.left) * alignment.x,
      bounds.left + inset,
      bounds.right - inset
    ),
    y: clamp(
      bounds.top + (bounds.bottom - bounds.top) * alignment.y,
      bounds.top + inset,
      bounds.bottom - inset
    )
  };
  const entryVector = directionVector(startSide);
  const endVector = directionVector(direction);
  const start =
    startSide === "left"
      ? { x: bounds.right, y: aligned.y }
      : startSide === "right"
        ? { x: bounds.left, y: aligned.y }
        : startSide === "up"
          ? { x: aligned.x, y: bounds.bottom }
          : { x: aligned.x, y: bounds.top };
  const inward = {
    x: start.x + entryVector.x * leg,
    y: start.y + entryVector.y * leg
  };

  if (startSide === direction) {
    return [
      start,
      {
        x: clamp(
          start.x + endVector.x * straightLength,
          bounds.left + inset,
          bounds.right - inset
        ),
        y: clamp(
          start.y + endVector.y * straightLength,
          bounds.top + inset,
          bounds.bottom - inset
        )
      }
    ];
  }

  return [
    start,
    inward,
    {
      x: clamp(
        inward.x + endVector.x * leg,
        bounds.left + inset,
        bounds.right - inset
      ),
      y: clamp(
        inward.y + endVector.y * leg,
        bounds.top + inset,
        bounds.bottom - inset
      )
    }
  ];
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (minimum > maximum) return (minimum + maximum) / 2;
  return Math.min(maximum, Math.max(minimum, value));
}
