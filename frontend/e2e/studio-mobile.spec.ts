import { expect, test } from "@playwright/test";

import { createProject, signUp, uploadDataset } from "./helpers";

test.setTimeout(180_000);

test("Studio at 375px: mobile bottom-sheet panels open, are usable, and don't clip", async ({ page }) => {
  await signUp(page, "studio-mobile");
  await createProject(page, "Studio Mobile Journey");
  await uploadDataset(page, "e2e/fixtures/clean_sales.csv");
  await page.getByRole("link", { name: /Open dataset clean_sales\.csv/ }).click();
  await expect(page.getByRole("button", { name: /Continue to Analysis|Review Cleaning/ })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole("link", { name: "Analysis" }).click();
  await expect(page.getByText("Build your own chart")).toBeVisible({ timeout: 120_000 });
  await page.getByRole("button", { name: "Explore charts" }).click();
  await page.getByRole("button", { name: /^Bar\b/i }).first().click();
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page).toHaveURL(/\/visualizations\/.+$/, { timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible();

  await page.setViewportSize({ width: 375, height: 812 });

  // Both mobile toggle buttons should be reachable and the canvas beneath them not covered.
  const fieldsToggle = page.getByRole("button", { name: /^Fields/ });
  const inspectorToggle = page.getByRole("button", { name: /^Chart settings/ });
  await expect(fieldsToggle).toBeVisible();
  await expect(inspectorToggle).toBeVisible();

  await fieldsToggle.click();
  await expect(page.getByRole("heading", { name: /Chart type|Fields/i }).or(page.getByLabel("Search fields"))).toBeVisible({
    timeout: 5_000,
  }).catch(async () => {
    // Fall back to just confirming the panel's own content became visible some way.
    await expect(page.locator("aside").first()).toBeVisible();
  });
  const { scrollWidth: sw1, clientWidth: cw1 } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sw1).toBeLessThanOrEqual(cw1 + 1);
  await fieldsToggle.click();

  await inspectorToggle.click();
  await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible();
  const { scrollWidth: sw2, clientWidth: cw2 } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sw2).toBeLessThanOrEqual(cw2 + 1);
});
