import {
  findDividers,
  generatePolygons,
  moveDivider,
  polygonToRectangle,
  regionsCoverUnit
} from "../src/shared/geometry";

describe("motor de subdivisão", () => {
  it.each([2, 3, 4, 5, 6])(
    "gera cobertura válida para %i dicas",
    (count) => {
      const polygons = generatePolygons(
        Array.from({ length: count }, (_, index) =>
          index === 0 ? "Uma dica bem mais comprida" : `Dica ${index + 1}`
        )
      );
      expect(polygons).toHaveLength(count);
      expect(polygons.every((polygon) => polygon.length === 4)).toBe(true);
      expect(polygons.every((polygon) => polygonToRectangle(polygon))).toBe(true);
      expect(regionsCoverUnit(polygons)).toBe(true);
    }
  );

  it.each([0.5, 1, 2])(
    "mantém retângulos em áreas com proporção %s",
    (aspectRatio) => {
      const polygons = generatePolygons(
        ["Curta", "Uma dica mais comprida", "Média", "Outra"],
        aspectRatio
      );
      expect(polygons.every((polygon) => polygonToRectangle(polygon))).toBe(true);
      expect(regionsCoverUnit(polygons)).toBe(true);
    }
  );

  it("respeita a orientação horizontal escolhida em uma área larga", () => {
    const polygons = generatePolygons(["Em cima", "Embaixo"], 2, "horizontal");
    const first = polygonToRectangle(polygons[0])!;
    const second = polygonToRectangle(polygons[1])!;

    expect(first.left).toBe(0);
    expect(first.right).toBe(1);
    expect(second.left).toBe(0);
    expect(second.right).toBe(1);
    expect(first.bottom).toBe(second.top);
  });

  it("respeita a orientação vertical escolhida", () => {
    const polygons = generatePolygons(["Esquerda", "Direita"], 0.5, "vertical");
    const first = polygonToRectangle(polygons[0])!;
    const second = polygonToRectangle(polygons[1])!;

    expect(first.top).toBe(0);
    expect(first.bottom).toBe(1);
    expect(second.top).toBe(0);
    expect(second.bottom).toBe(1);
    expect(first.right).toBe(second.left);
  });

  it("move uma divisória ortogonal sem abrir lacunas", () => {
    const polygons = generatePolygons(["Primeira", "Segunda", "Terceira"]);
    const divider = findDividers(polygons)[0];
    const moved = moveDivider(polygons, divider, divider.position + 0.08);
    expect(moved).not.toEqual(polygons);
    expect(moved.every((polygon) => polygonToRectangle(polygon))).toBe(true);
    expect(regionsCoverUnit(moved)).toBe(true);
  });

  it("limita a divisória para preservar o tamanho mínimo", () => {
    const polygons = generatePolygons(["A", "B"]);
    const divider = findDividers(polygons)[0];
    const moved = moveDivider(polygons, divider, 5);
    const rectangles = moved.map(polygonToRectangle);
    expect(rectangles.every(Boolean)).toBe(true);
    expect(rectangles[1]?.right! - rectangles[1]?.left!).toBeGreaterThanOrEqual(
      0.119
    );
    expect(regionsCoverUnit(moved)).toBe(true);
  });
});
