import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load .env.test when running locally (CI injects secrets via environment).
// Does nothing if file is absent.
// import.meta.dirname requires Node 20.11+ (CI runs Node 22).
dotenv.config({ path: path.resolve(import.meta.dirname, ".env.test") });

/**
 * E2E tests run against the staging environment.
 * Set PLAYWRIGHT_BASE_URL to override (e.g. for local testing).
 *
 * CI: triggered on PR to main via .github/workflows/e2e.yml
 *
 * Credentials (GitHub secrets / local .env.test):
 *   E2E_EMAIL          — test user email (user@example.com)
 *   E2E_PASSWORD       — test user password
 *   CLERK_SECRET_KEY   — needed by @clerk/testing clerkSetup()
 *   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY — needed by @clerk/testing
 *
 * Projects:
 *   setup              — logs in once, writes e2e/.auth/user.json
 *   chromium           — public pages (no auth), Desktop Chrome
 *   mobile-safari      — public pages (no auth), iPhone 14
 *   authenticated      — dashboard + protected pages, reuses setup session
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: !process.env.CI,
  // Fail the build on CI if test.only is accidentally left in source.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",

  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ?? "https://staging.example.com",
    // Capture screenshot + trace only on failure — keeps CI artifacts small.
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },

  projects: [
    // ── 1. Auth setup ────────────────────────────────────────────────────────
    // Runs once before any authenticated project. Logs in via Clerk UI and
    // saves cookies + localStorage to e2e/.auth/user.json.
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // ── 2. Public tests — no auth ─────────────────────────────────────────────
    // Booking page and other public routes. Skips the authenticated/ directory.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /authenticated\//,
      testMatch: [/booking\.spec\.ts/, /signup\.spec\.ts/],
    },

    // ── 3. Authenticated tests ────────────────────────────────────────────────
    // Runs after setup. Injects the saved session — no sign-in step in tests.
    {
      name: "authenticated",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
      testMatch: [
        /authenticated\/appointment-lifecycle\.spec\.ts/,
        /authenticated\/dashboard\.spec\.ts/,
        /authenticated\/invite-flow\.spec\.ts/,
        /authenticated\/patient-create-search\.spec\.ts/,
      ],
    },
    ...(process.env.E2E_INCLUDE_WEBKIT === "true"
      ? [
          {
            name: "mobile-safari",
            use: { ...devices["iPhone 14"] },
            testIgnore: /authenticated\//,
            testMatch: [/booking\.spec\.ts/, /signup\.spec\.ts/],
          },
        ]
      : []),
  ],
});
