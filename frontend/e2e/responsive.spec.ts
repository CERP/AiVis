import { expect, test, type Page } from "@playwright/test";

import { createProject, signUp, uploadDataset } from "./helpers";

test.setTimeout(300_000);

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "900x800", width: 900, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "375x812", width: 375, height: 812 },
];

async function overflowInfo(page: Page) {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

test("live responsive sweep across 6 viewports", async ({ page }, testInfo) => {
  await signUp(page, "responsive");
  await createProject(page, "Responsive Journey");
  await uploadDataset(page, "e2e/fixtures/clean_sales.csv");
  await page.getByRole("link", { name: /Open dataset clean_sales\.csv/ }).click();

  const overviewUrl = page.url();
  await expect(page.getByRole("button", { name: /Continue to Analysis|Review Cleaning/ })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole("link", { name: "Cleaning" }).click();
  const cleaningUrl = page.url();
  await page.getByRole("link", { name: "Analysis" }).click();
  await expect(page.getByText("Build your own chart")).toBeVisible({ timeout: 120_000 });
  const analysisUrl = page.url();

  await page.getByRole("button", { name: "Explore charts" }).click();
  const explorerUrl = page.url();
  await page.getByRole("button", { name: /^Bar\b/i }).first().click();
  await page.getByRole("button", { name: "Use this chart" }).click();
  await expect(page).toHaveURL(/\/visualizations\/.+$/, { timeout: 30_000 });
  await expect(page.getByRole("tab", { name: "Mapping" })).toBeVisible();
  const studioUrl = page.url();

  const screens: { name: string; url: string }[] = [
    { name: "projects", url: "/projects" },
    { name: "project-detail", url: `/projects/${overviewUrl.match(/projects\/([^/]+)/)?.[1]}` },
    { name: "dataset-overview", url: overviewUrl },
    { name: "cleaning", url: cleaningUrl },
    { name: "analysis", url: analysisUrl },
    { name: "explorer", url: explorerUrl },
    { name: "studio", url: studioUrl },
  ];

  const findings: string[] = [];

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const screen of screens) {
      await page.goto(screen.url);
      await page.waitForLoadState("networkidle").catch(() => {});
      const { scrollWidth, clientWidth } = await overflowInfo(page);
      if (scrollWidth > clientWidth + 1) {
        findings.push(
          `${screen.name} @ ${viewport.name}: horizontal overflow (scrollWidth=${scrollWidth} > clientWidth=${clientWidth})`
        );
      }
    }
  }

  await testInfo.attach("responsive-findings", { body: findings.join("\n") || "none", contentType: "text/plain" });
  console.log("RESPONSIVE OVERFLOW FINDINGS:\n" + (findings.join("\n") || "none"));

  expect(findings, findings.join("\n")).toEqual([]);
});
