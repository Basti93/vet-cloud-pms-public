import { test, expect } from "@playwright/test";

/**
 * Authenticated dashboard tests.
 *
 * storageState (Clerk session) is injected by playwright.config.ts —
 * no sign-in step needed here.
 *
 * Selectors: data-testid only. Never hardcode copy or German strings.
 * Scope: happy path only — confirms auth works and key pages load.
 */

test.describe("Dashboard", () => {
  test("loads after authentication", async ({ page }) => {
    await page.goto("/dashboard");

    // Confirms we are NOT redirected back to sign-in — auth is working.
    await expect(page).toHaveURL(/\/dashboard/);

    // Main dashboard wrapper must be present.
    await expect(page.getByTestId("dashboard-home")).toBeVisible();
  });
});
