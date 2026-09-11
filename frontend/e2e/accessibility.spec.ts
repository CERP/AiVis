import { expect, test } from "@playwright/test";

import { checkA11y } from "./axe-helper";
import { createProject, signUp, uploadDataset } from "./helpers";

test.setTimeout(180_000);

test.describe("axe: serious/critical violations on key screens", () => {
  test("Projects, Project Detail, Dataset Overview, Cleaning, Analysis, Explorer, Studio, Settings", async ({
    page,
  }, testInfo) => {
    await signUp(page, "axe");
    await expect(page).toHaveURL(/\/projects$/);
    const projectsViolations = await checkA11y(page, testInfo, "projects");

    await createProject(page, "Axe Journey");
    const projectDetailViolations = await checkA11y(page, testInfo, "project-detail");

    await uploadDataset(page, "e2e/fixtures/messy_sales.csv");
    await page.getByRole("link", { name: /Open dataset messy_sales\.csv/ }).click();
    await page.getByText("Analyzing dataset…").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await expect(page.getByText("Analyzing dataset…")).toHaveCount(0, { timeout: 180_000 });
    const overviewViolations = await checkA11y(page, testInfo, "dataset-overview");

    const cta = page.getByRole("button", { name: /Continue to Analysis|Review Cleaning/ });
    const onCleaningPath = (await cta.textContent())?.includes("Review Cleaning");
    await cta.click();

    let cleaningViolations: Awaited<ReturnType<typeof checkA11y>> = [];
    if (onCleaningPath) {
      await expect(page).toHaveURL(/\/cleaning$/);
      await expect(
        page.getByText(/Accept all|Potential score|Couldn't generate a cleaning proposal/i)
      ).toBeVisible({ timeout: 120_000 });
      cleaningViolations = await checkA11y(page, testInfo, "cleaning");
      await page.getByRole("link", { name: "Analysis" }).click();
    }

    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByText("Build your own chart")).toBeVisible({ timeout: 120_000 });
    const analysisViolations = await checkA11y(page, testInfo, "analysis");

    await page.getByRole("button", { name: "Explore charts" }).click();
    await expect(page).toHaveURL(/\/explorer/);
    const explorerViolations = await checkA11y(page, testInfo, "explorer");

    await page.getByRole("button", { name: /^Bar\b/i }).first().click();
    await page.getByRole("button", { name: "Use this chart" }).click();
    await expect(page).toHaveURL(/\/visualizations\/.+$/, { timeout: 30_000 });
    await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible();
    const studioViolations = await checkA11y(page, testInfo, "studio");

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    const settingsViolations = await checkA11y(page, testInfo, "settings");

    const all = {
      projects: projectsViolations,
      "project-detail": projectDetailViolations,
      "dataset-overview": overviewViolations,
      cleaning: cleaningViolations,
      analysis: analysisViolations,
      explorer: explorerViolations,
      studio: studioViolations,
      settings: settingsViolations,
    };
    await testInfo.attach("axe-summary", { body: JSON.stringify(all, null, 2), contentType: "application/json" });

    const total = Object.values(all).flat().length;
    console.log("AXE SERIOUS/CRITICAL SUMMARY:", JSON.stringify(all, null, 2));
    expect(total, `serious/critical axe violations found: ${JSON.stringify(all)}`).toBe(0);
  });
});
