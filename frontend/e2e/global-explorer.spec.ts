import { expect, test } from "@playwright/test";

import { signUp } from "./helpers";

test.setTimeout(60_000);

test("global explorer: browse chart types and search without a dataset in context", async ({ page }) => {
  await signUp(page, "global-explorer");
  await page.goto("/explorer");

  await expect(page).toHaveURL(/\/explorer$/);
  await page.getByRole("button", { name: /^Bar\b/i }).first().click();
  await expect(page.getByRole("button", { name: "Use this chart" })).toBeVisible();

  await page.getByLabel("Search charts").fill("scatter");
  await expect(page.getByRole("button", { name: /^Scatter\b/i }).first()).toBeVisible();
});
