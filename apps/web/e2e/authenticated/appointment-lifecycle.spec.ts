import { expect, test } from "@playwright/test";

// Tomorrow (weekday) at 10:00 — must be in the future and not on weekend
function nextWeekdayDatetimeLocal() {
  const d = new Date();
  d.setDate(d.getDate() + 7); // +7 days = definitely a future weekday
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
}

test.describe("Appointment lifecycle", () => {
  test("creates appointment manually and transitions status to completed", async ({ page }) => {
    test.setTimeout(60_000);
    // Open schedule page → click Neuer Termin
    await page.goto("/dashboard/schedule");
    await page.getByTestId("new-appointment-button").click();

    // Wait for modal form
    const form = page.getByTestId("appointment-form");
    await expect(form).toBeVisible({ timeout: 10_000 });

    // Select patient — search "Bella" (first seeded patient)
    await page.getByTestId("appointment-patient-input").click();
    await page.getByTestId("appointment-patient-input").fill("Bella");
    const patientOption = page.getByTestId("appointment-patient-option").first();
    await expect(patientOption).toBeVisible({ timeout: 10_000 });
    await patientOption.click();

    // Select vet — search "E2E"
    await page.getByTestId("appointment-vet-input").click();
    await page.getByTestId("appointment-vet-input").fill("E2E");
    const vetOption = page.getByTestId("appointment-vet-option").first();
    await expect(vetOption).toBeVisible({ timeout: 10_000 });
    await vetOption.click();

    // Fill title
    await page.getByTestId("appointment-title-input").fill("E2E Lifecycle Test");

    // Fill start time
    await form.locator('input[type="datetime-local"]').first().fill(nextWeekdayDatetimeLocal());

    // Submit
    await page.getByTestId("appointment-submit").click();

    // Modal should close → navigate to appointments
    await page.goto("/dashboard/appointments");
    await expect(page.getByTestId("appointments-page")).toBeVisible();

    // Find and open the appointment we just created
    const row = page.getByTestId("appointment-row").filter({ hasText: "E2E Lifecycle Test" }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.click();

    // Change status to confirmed
    const statusSelect = page.getByTestId("appointment-status-select");
    await expect(statusSelect).toBeVisible({ timeout: 5_000 });
    await statusSelect.selectOption("confirmed");

    await page.getByTestId("appointment-submit").click();
    await expect(statusSelect).toBeHidden({ timeout: 10_000 });

    // Re-open and change to completed
    await row.click();
    await expect(statusSelect).toBeVisible({ timeout: 5_000 });
    await statusSelect.selectOption("completed");
    await page.getByTestId("appointment-submit").click();
    await expect(statusSelect).toBeHidden({ timeout: 10_000 });
  });
});
