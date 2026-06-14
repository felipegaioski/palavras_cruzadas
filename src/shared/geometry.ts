import type { Point } from "./types.js";

const EPSILON = 0.0001;
const MIN_REGION_SIZE = 0.12;

export interface Rectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Divider {
  id: string;
  axis: "vertical" | "horizontal";
  position: number;
  start: number;
  end: number;
  before: number[];
  after: number[];
}

export type SplitOrientation = "auto" | "vertical" | "horizontal";

export function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points: Point[]): Point {
  const total = points.reduce(
    (value, point) => ({ x: value.x + point.x, y: value.y + point.y }),
    { x: 0, y: 0 }
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

export function isPointInsideUnit(point: Point): boolean {
  return (
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

export function isSimplePolygon(points: Point[]): boolean {
  if (points.length < 3 || points.some((point) => !isPointInsideUnit(point))) {
    return false;
  }
  for (let a = 0; a < points.length; a += 1) {
    const a1 = points[a];
    const a2 = points[(a + 1) % points.length];
    for (let b = a + 1; b < points.length; b += 1) {
      if (
        b === a ||
        b === (a + 1) % points.length ||
        (b + 1) % points.length === a
      ) {
        continue;
      }
      const b1 = points[b];
      const b2 = points[(b + 1) % points.length];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return polygonArea(points) > EPSILON;
}

function orientation(a: Point, b: Point, c: Point): number {
  return (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);
  return first * second < -EPSILON && third * fourth < -EPSILON;
}

export function rectangleToPolygon(rectangle: Rectangle): Point[] {
  return [
    { x: rectangle.left, y: rectangle.top },
    { x: rectangle.right, y: rectangle.top },
    { x: rectangle.right, y: rectangle.bottom },
    { x: rectangle.left, y: rectangle.bottom }
  ];
}

export function polygonToRectangle(points: Point[]): Rectangle | null {
  if (points.length !== 4) return null;
  const xs = [...new Set(points.map((point) => round(point.x)))].sort();
  const ys = [...new Set(points.map((point) => round(point.y)))].sort();
  if (xs.length !== 2 || ys.length !== 2) return null;
  const expected = new Set([
    `${xs[0]}:${ys[0]}`,
    `${xs[1]}:${ys[0]}`,
    `${xs[1]}:${ys[1]}`,
    `${xs[0]}:${ys[1]}`
  ]);
  if (points.some((point) => !expected.has(`${round(point.x)}:${round(point.y)}`))) {
    return null;
  }
  return { left: xs[0], top: ys[0], right: xs[1], bottom: ys[1] };
}

export function generatePolygons(
  contents: string[],
  aspectRatio = 1,
  firstOrientation: SplitOrientation = "auto"
): Point[][] {
  const weights = contents.map((content) =>
    Math.max(1, Math.sqrt(content.trim().length + 4))
  );
  const indexed = contents.map((_content, index) => index);
  const rectangles = new Array<Rectangle>(contents.length);

  splitRectangles(
    indexed,
    { left: 0, top: 0, right: 1, bottom: 1 },
    weights,
    Math.max(0.2, aspectRatio),
    rectangles,
    firstOrientation
  );

  return rectangles.map(rectangleToPolygon);
}

function splitRectangles(
  indices: number[],
  rectangle: Rectangle,
  weights: number[],
  aspectRatio: number,
  output: Rectangle[],
  forcedOrientation: SplitOrientation = "auto"
): void {
  if (indices.length === 1) {
    output[indices[0]] = rectangle;
    return;
  }

  const total = indices.reduce((sum, index) => sum + weights[index], 0);
  let firstTotal = 0;
  let splitIndex = 1;
  let smallestDifference = Number.POSITIVE_INFINITY;
  for (let index = 1; index < indices.length; index += 1) {
    firstTotal += weights[indices[index - 1]];
    const difference = Math.abs(total / 2 - firstTotal);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitIndex = index;
    }
  }

  const before = indices.slice(0, splitIndex);
  const after = indices.slice(splitIndex);
  const beforeWeight = before.reduce((sum, index) => sum + weights[index], 0);
  const ratio = clamp(beforeWeight / total, 0.22, 0.78);
  const physicalWidth = (rectangle.right - rectangle.left) * aspectRatio;
  const physicalHeight = rectangle.bottom - rectangle.top;

  const useVerticalCut =
    forcedOrientation === "vertical" ||
    (forcedOrientation === "auto" && physicalWidth >= physicalHeight);

  if (useVerticalCut) {
    const cut =
      rectangle.left + (rectangle.right - rectangle.left) * ratio;
    splitRectangles(
      before,
      { ...rectangle, right: cut },
      weights,
      aspectRatio,
      output,
      "auto"
    );
    splitRectangles(
      after,
      { ...rectangle, left: cut },
      weights,
      aspectRatio,
      output,
      "auto"
    );
  } else {
    const cut =
      rectangle.top + (rectangle.bottom - rectangle.top) * ratio;
    splitRectangles(
      before,
      { ...rectangle, bottom: cut },
      weights,
      aspectRatio,
      output,
      "auto"
    );
    splitRectangles(
      after,
      { ...rectangle, top: cut },
      weights,
      aspectRatio,
      output,
      "auto"
    );
  }
}

export function findDividers(polygons: Point[][]): Divider[] {
  const rectangles = polygons.map(polygonToRectangle);
  if (rectangles.some((rectangle) => rectangle === null)) return [];
  const valid = rectangles as Rectangle[];
  const dividers = new Map<string, Divider>();

  valid.forEach((first, firstIndex) => {
    valid.forEach((second, secondIndex) => {
      if (firstIndex >= secondIndex) return;
      if (Math.abs(first.right - second.left) < EPSILON) {
        addDivider(
          dividers,
          "vertical",
          first.right,
          Math.max(first.top, second.top),
          Math.min(first.bottom, second.bottom),
          firstIndex,
          secondIndex
        );
      } else if (Math.abs(second.right - first.left) < EPSILON) {
        addDivider(
          dividers,
          "vertical",
          first.left,
          Math.max(first.top, second.top),
          Math.min(first.bottom, second.bottom),
          secondIndex,
          firstIndex
        );
      }
      if (Math.abs(first.bottom - second.top) < EPSILON) {
        addDivider(
          dividers,
          "horizontal",
          first.bottom,
          Math.max(first.left, second.left),
          Math.min(first.right, second.right),
          firstIndex,
          secondIndex
        );
      } else if (Math.abs(second.bottom - first.top) < EPSILON) {
        addDivider(
          dividers,
          "horizontal",
          first.top,
          Math.max(first.left, second.left),
          Math.min(first.right, second.right),
          secondIndex,
          firstIndex
        );
      }
    });
  });

  return [...dividers.values()].filter(
    (divider) => divider.end - divider.start > EPSILON
  );
}

function addDivider(
  dividers: Map<string, Divider>,
  axis: Divider["axis"],
  position: number,
  start: number,
  end: number,
  beforeIndex: number,
  afterIndex: number
): void {
  if (end - start <= EPSILON) return;
  const id = `${axis}:${round(position)}`;
  const existing = dividers.get(id);
  if (existing) {
    existing.start = Math.min(existing.start, start);
    existing.end = Math.max(existing.end, end);
    if (!existing.before.includes(beforeIndex)) existing.before.push(beforeIndex);
    if (!existing.after.includes(afterIndex)) existing.after.push(afterIndex);
  } else {
    dividers.set(id, {
      id,
      axis,
      position,
      start,
      end,
      before: [beforeIndex],
      after: [afterIndex]
    });
  }
}

export function moveDivider(
  polygons: Point[][],
  divider: Divider,
  position: number
): Point[][] {
  const rectangles = polygons.map(polygonToRectangle);
  if (rectangles.some((rectangle) => rectangle === null)) return polygons;
  const candidate = (rectangles as Rectangle[]).map((rectangle) => ({
    ...rectangle
  }));

  const minimum = Math.max(
    ...divider.before.map((index) =>
      divider.axis === "vertical"
        ? candidate[index].left + MIN_REGION_SIZE
        : candidate[index].top + MIN_REGION_SIZE
    )
  );
  const maximum = Math.min(
    ...divider.after.map((index) =>
      divider.axis === "vertical"
        ? candidate[index].right - MIN_REGION_SIZE
        : candidate[index].bottom - MIN_REGION_SIZE
    )
  );
  const safePosition = clamp(position, minimum, maximum);

  divider.before.forEach((index) => {
    if (divider.axis === "vertical") candidate[index].right = safePosition;
    else candidate[index].bottom = safePosition;
  });
  divider.after.forEach((index) => {
    if (divider.axis === "vertical") candidate[index].left = safePosition;
    else candidate[index].top = safePosition;
  });

  const result = candidate.map(rectangleToPolygon);
  return regionsCoverUnit(result) ? result : polygons;
}

export function regionsCoverUnit(polygons: Point[][]): boolean {
  if (
    !polygons.length ||
    polygons.some(
      (polygon) => !isSimplePolygon(polygon) || !polygonToRectangle(polygon)
    )
  ) {
    return false;
  }
  const total = polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  return Math.abs(total - 1) < 0.001;
}

export function textLikelyFits(
  content: string,
  polygon: Point[],
  areaWidth: number,
  areaHeight: number
): boolean {
  const capacity = polygonArea(polygon) * areaWidth * areaHeight * 0.18;
  return content.trim().length <= Math.max(8, capacity);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
