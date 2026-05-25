import { expect, test } from "@playwright/test";

test.describe("Medical records", () => {
  test("patient detail page shows diagnosis section", async ({ page }) => {
    // Navigate to patients list and open first patient
    await page.goto("/dashboard/patients");
    await expect(page.getByTestId("patients-page")).toBeVisible();

    const firstRow = page.getByTestId("patient-row").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page).toHaveURL(/\/dashboard\/patients\/[0-9a-f-]+/);

    // Diagnosen section must be present
    await expect(page.getByText("Diagnosen")).toBeVisible({ timeout: 10_000 });

    // "Hinzufügen" button triggers the diagnosis form
    await page.getByRole("button", { name: "Hinzufügen" }).first().click();

    // Placeholder modal opens (form not yet implemented)
    await expect(page.getByText(/Formular folgt/i).or(page.getByRole("dialog"))).toBeVisible({ timeout: 5_000 });
  });
});
