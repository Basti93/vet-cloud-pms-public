import { expect, test } from "@playwright/test";

test.describe("Medical records", () => {
  test("patient detail page shows diagnosis section", async ({ page }) => {
    test.setTimeout(60_000);
    // Navigate to patients list and open first patient
    await page.goto("/dashboard/patients");
    await expect(page.getByTestId("patients-page")).toBeVisible();

    const firstRow = page.getByTestId("patient-row").first();
    await expect(firstRow).toBeVisible({ timeout: 10_000 });
    await firstRow.click();

    await expect(page).toHaveURL(/\/dashboard\/patients\/[0-9a-f-]+/);

    await expect(page.getByRole("heading", { name: "Diagnosen" })).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("add-diagnosis-button").click();
    await expect(page.getByTestId("medical-record-modal")).toBeVisible({ timeout: 10_000 });
  });
});
