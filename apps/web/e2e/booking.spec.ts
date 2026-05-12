import { test, expect } from "@playwright/test";

/**
 * Booking flow E2E tests.
 *
 * Selectors: always data-testid. Never hardcode copy/German strings.
 * Scope: happy path only. Runs against staging (PLAYWRIGHT_BASE_URL).
 *
 * Step order: vet → date → details → confirm → success
 */

const DEMO_SLUG = "demo";

test.describe("Booking page", () => {
  test("loads and shows vet-selection step", async ({ page }) => {
    await page.goto(`/book/${DEMO_SLUG}`);

    // Main card must be visible — confirms page rendered, not a 404/error
    await page.getByTestId("booking-page").waitFor({ state: "visible" });

    // Step indicator must report we are on the 'vet' step
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "vet"
    );

    // Auto-assign button must be present (always rendered on vet step)
    await expect(page.getByTestId("booking-vet-auto")).toBeVisible();
  });

  test("clicking auto-assign advances to date step", async ({ page }) => {
    await page.goto(`/book/${DEMO_SLUG}`);
    await page.getByTestId("booking-page").waitFor({ state: "visible" });

    await page.getByTestId("booking-vet-auto").click();

    // After click the step indicator must update to 'date'
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "date"
    );
  });
});
