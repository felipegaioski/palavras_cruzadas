import { expect, test } from "@playwright/test";

test("cria, edita e abre a impressão de uma cruzada", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /nova cruzada/i }).click();
  await page.getByLabel("Título").fill("Fluxo Playwright");
  await page.getByRole("button", { name: /criar e abrir editor/i }).click();
  await expect(page.getByLabel("Título da cruzada")).toHaveValue(
    "Fluxo Playwright"
  );

  await page.getByRole("button", { name: "Dica" }).click();
  await page.locator("svg.crossword-grid").click({ position: { x: 25, y: 25 } });
  await page.getByLabel("Texto da dica").fill("Primeira letra");
  await page.getByLabel("Resposta").fill("A");
  await page.getByRole("button", { name: /criar palavra/i }).click();
  await expect(
    page.locator("svg.crossword-grid").getByText("A", { exact: true })
  ).toBeVisible();

  await page.getByRole("link", { name: "Imprimir" }).click();
  await expect(page.getByRole("heading", { name: "Preparar impressão" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fluxo Playwright" })
  ).toBeVisible();
});
