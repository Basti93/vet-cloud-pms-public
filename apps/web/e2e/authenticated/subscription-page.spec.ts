import { expect, test } from "@playwright/test";

test.describe("Subscription page", () => {
  test("loads subscription page with plan cards", async ({ page }) => {
    await page.goto("/dashboard/settings/subscription");
    await expect(page.getByTestId("subscription-page")).toBeVisible();

    // All three tier cards must be present
    await expect(page.getByTestId("subscription-tier-solo")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("subscription-tier-praxis")).toBeVisible();
    await expect(page.getByTestId("subscription-tier-klinik")).toBeVisible();
  });

  test("shows current subscription status", async ({ page }) => {
    await page.goto("/dashboard/settings/subscription");
    await expect(page.getByTestId("subscription-page")).toBeVisible();

    // E2E tenant has subscriptionPlan: "solo" and subscriptionStatus: "active"
    // Status section should display current info
    await expect(page.getByTestId("subscription-status")).toBeVisible({ timeout: 10_000 });
  });
});
