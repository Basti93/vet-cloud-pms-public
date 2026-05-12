import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run against the staging environment.
 * Set PLAYWRIGHT_BASE_URL to override (e.g. for local testing).
 *
 * CI: triggered on PR to main via .github/workflows/e2e.yml
 * Credentials: E2E_EMAIL + E2E_PASSWORD in GitHub secrets / local .env.test
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Fail the build on CI if test.only is accidentally left in source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ?? "https://staging.example.com",
    // Capture screenshot + trace only on failure — keeps CI artifacts small.
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
