import { expect, test } from "@playwright/test";

test.describe("Clinic settings", () => {
  test("loads practice settings page", async ({ page }) => {
    await page.goto("/dashboard/settings/practice");
    await expect(page.getByTestId("practice-settings-page")).toBeVisible();
    await expect(page.getByTestId("practice-name-input")).toBeVisible();
  });

  test("updates clinic name and persists after reload", async ({ page }) => {
    await page.goto("/dashboard/settings/practice");
    await expect(page.getByTestId("practice-settings-page")).toBeVisible();

    const nameInput = page.getByTestId("practice-name-input");
    await nameInput.clear();
    await nameInput.fill("E2E Test Praxis Updated");

    await page.getByTestId("practice-save-button").click();

    // Wait for save confirmation
    await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 10_000 });

    // Reload and verify persistence
    await page.reload();
    await expect(page.getByTestId("practice-name-input")).toHaveValue("E2E Test Praxis Updated");

    // Restore original name
    await page.getByTestId("practice-name-input").clear();
    await page.getByTestId("practice-name-input").fill("E2E Test Praxis");
    await page.getByTestId("practice-save-button").click();
    await expect(page.getByText("Gespeichert")).toBeVisible({ timeout: 10_000 });
  });
});
