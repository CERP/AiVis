import type { Page } from "@playwright/test";

/** Every journey needs a signed-in account; a fresh email per test run avoids collisions
 * with real backend uniqueness constraints when tests are re-run against the same DB. */
export async function signUp(page: Page, label: string) {
  const email = `e2e-${label}-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Organization name").fill(`E2E ${label}`);
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password").fill("TestPass123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL("**/projects");
}

export async function createProject(page: Page, name: string) {
  // Both the header button and the empty-state CTA render "New project" when the account has
  // zero projects -- not a bug, just two entry points to the same action.
  await page.getByRole("button", { name: "New project" }).first().click();
  await page.getByLabel("Project name").fill(name);
  await page.getByRole("button", { name: "Create project" }).click();
  await page.getByRole("link", { name: new RegExp(name) }).click();
}

/** Uploads via the hidden file input directly -- works for both the first-dataset dropzone
 * and the "Upload dataset" toolbar button, since both feed the same input. */
export async function uploadDataset(page: Page, fixturePath: string) {
  await page.locator('input[type="file"]').setInputFiles(fixturePath);
}
