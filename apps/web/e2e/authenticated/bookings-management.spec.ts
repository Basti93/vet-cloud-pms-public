import { expect, test } from "@playwright/test";

test.describe("Booking management", () => {
  test("loads booking requests and appointments views", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await expect(page).toHaveURL(/\/dashboard\/bookings/);
    await expect(page.getByTestId("bookings-page")).toBeVisible();

    await page.goto("/dashboard/appointments");
    await expect(page).toHaveURL(/\/dashboard\/appointments/);
    await expect(page.getByTestId("appointments-page")).toBeVisible();
  });

  test("can confirm the first pending online booking request when present", async ({ page }) => {
    await page.goto("/dashboard/bookings");
    await expect(page.getByTestId("bookings-page")).toBeVisible();

    const firstRequest = page.getByTestId("booking-request-row").first();
    if ((await firstRequest.count()) === 0) {
      test.skip(true, "No seeded booking requests available to confirm");
    }

    await firstRequest.waitFor({ state: "visible" });
    const confirmButton = firstRequest.getByTestId("booking-request-confirm");
    if ((await confirmButton.count()) === 0) {
      test.skip(true, "First booking request is not pending confirmation");
    }

    await confirmButton.click();
    await expect(confirmButton).toBeHidden({ timeout: 15_000 });

    await page.goto("/dashboard/appointments");
    await expect(page.getByTestId("appointments-page")).toBeVisible();
  });
});
