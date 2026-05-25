import { expect, test } from "@playwright/test";

test.describe("Vet team management", () => {
  test("team settings page loads and shows existing vets", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    await expect(page).toHaveURL(/\/dashboard\/settings\/team/);

    // E2E tenant has two seeded vets visible as team-user-row entries
    await expect(page.getByTestId("team-user-row").first()).toBeVisible({ timeout: 10_000 });
  });

  test("vets appear in appointment creation dropdown", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.getByTestId("new-appointment-button").click();

    const form = page.getByTestId("appointment-form");
    await expect(form).toBeVisible({ timeout: 10_000 });

    // Open vet dropdown and verify E2E vet appears
    await page.getByTestId("appointment-vet-input").click();
    await page.getByTestId("appointment-vet-input").fill("E2E");
    await expect(page.getByTestId("appointment-vet-option").first()).toBeVisible({ timeout: 10_000 });
  });
});
