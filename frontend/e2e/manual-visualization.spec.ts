import { expect, test } from "@playwright/test";

import { createProject, signUp, uploadDataset } from "./helpers";

test.setTimeout(180_000);

test("manual visualization: dataset -> explorer with context -> chart created in Studio", async ({ page }) => {
  await signUp(page, "manual-viz");
  await createProject(page, "Manual Visualization Journey");

  await uploadDataset(page, "e2e/fixtures/clean_sales.csv");
  const datasetLink = page.getByRole("link", { name: /Open dataset clean_sales\.csv/ });
  await expect(datasetLink).toBeVisible({ timeout: 30_000 });
  await datasetLink.click();

  await expect(page.getByRole("button", { name: /Continue to Analysis|Review Cleaning/ })).toBeVisible({
    timeout: 180_000,
  });
  await page.getByRole("link", { name: "Analysis" }).click();

  await page.getByRole("button", { name: "Explore charts" }).click();
  await expect(page).toHaveURL(/\/explorer\?datasetId=/);

  await page.getByRole("button", { name: /^Bar\b/i }).first().click();
  await page.getByRole("button", { name: "Use this chart" }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/visualizations\/.+$/, { timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible();
});
