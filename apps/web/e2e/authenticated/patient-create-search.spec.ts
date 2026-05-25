import { expect, test } from "@playwright/test";

test.describe("Patient create and search", () => {
  test("searches for existing patient by name", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByTestId("patients-page")).toBeVisible();

    // Search for "Bella" (seeded patient)
    await page.getByTestId("patient-search-input").fill("Bella");
    await expect(page.getByTestId("patient-row").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Bella")).toBeVisible();
  });

  test("opens new patient modal", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByTestId("patients-page")).toBeVisible();

    await page.getByTestId("new-patient-button").click();

    // Modal should open — look for the owner search input
    await expect(page.getByPlaceholder(/Tier- oder Halter/i).or(page.getByRole("dialog"))).toBeVisible({ timeout: 5_000 });
  });

  test("patient row links to patient detail page", async ({ page }) => {
    await page.goto("/dashboard/patients");
    await expect(page.getByTestId("patients-page")).toBeVisible();

    // Click on first patient row
    const firstRow = page.getByTestId("patient-row").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    // Should navigate to patient detail
    await expect(page).toHaveURL(/\/dashboard\/patients\/[0-9a-f-]+/);
  });
});
