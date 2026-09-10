import { defineConfig, devices } from "@playwright/test";

/**
 * E2E core-journey tests against a real running app + backend (no mocked network) -- these
 * exercise the same command/version/staged-processing engine unit tests can't reach because
 * they never leave the browser. `webServer` is left unset deliberately: these tests are run
 * against a dev server (and its backend/DB/object-store dependencies) that the operator starts
 * explicitly, since Playwright starting `next dev` itself would still leave the backend down.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
