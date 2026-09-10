import { expect, test } from "@playwright/test";

import { createProject, signUp, uploadDataset } from "./helpers";

test.setTimeout(120_000);

test("existing visualization: created chart is listed on the project and reopens in Studio", async ({ page }) => {
  await signUp(page, "existing-viz");
  await createProject(page, "Existing Visualization Journey");

  await uploadDataset(page, "e2e/fixtures/clean_sales.csv");
  const datasetLink = page.getByRole("link", { name: /Open dataset clean_sales\.csv/ });
  await expect(datasetLink).toBeVisible({ timeout: 30_000 });
  await datasetLink.click();

  await page.getByRole("button", { name: /Continue to Analysis|Review Cleaning/ }).click();
  await page.getByRole("button", { name: "Explore charts" }).click();
  await page.getByRole("button", { name: /^Bar\b/i }).first().click();
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page).toHaveURL(/\/projects\/.+\/visualizations\/.+$/);

  const projectId = page.url().match(/\/projects\/([^/]+)\//)?.[1];
  await page.goto(`/projects/${projectId}`);

  const vizLink = page.getByRole("link", { name: /Bar/i }).first();
  await expect(vizLink).toBeVisible({ timeout: 15_000 });
  await vizLink.click();

  await expect(page).toHaveURL(/\/visualizations\/.+$/);
  await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible({ timeout: 15_000 });
});
