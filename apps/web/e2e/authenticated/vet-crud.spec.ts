import { expect, test } from "@playwright/test";

test.describe("Vet team management", () => {
  test("team settings page loads and shows existing vets", async ({ page }) => {
    await page.goto("/dashboard/settings/team");
    await expect(page).toHaveURL(/\/dashboard\/settings\/team/);

    // E2E tenant has two seeded vets: "E2E Vet" and "E2E Backup"
    await expect(page.getByText(/E2E.*Vet|E2E.*Backup/).first()).toBeVisible({ timeout: 10_000 });
  });

  test("vets appear in appointment creation dropdown", async ({ page }) => {
    await page.goto("/dashboard/schedule");
    await page.getByTestId("new-appointment-button").click();

    const form = page.getByTestId("appointment-form");
    await expect(form).toBeVisible({ timeout: 10_000 });

    // Open vet dropdown and verify E2E vet appears
    await form.locator('input[placeholder*="Arzt"]').click();
    await form.locator('input[placeholder*="Arzt"]').fill("E2E");
    await expect(page.getByText(/E2E.*Vet|E2E.*Backup/).first()).toBeVisible({ timeout: 5_000 });
  });
});
