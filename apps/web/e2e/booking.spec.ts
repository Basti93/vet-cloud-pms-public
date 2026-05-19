import { test, expect } from "@playwright/test";

/**
 * Booking flow E2E tests.
 *
 * Selectors: always data-testid. Never hardcode copy/German strings.
 * Scope: happy path only. Runs against staging (PLAYWRIGHT_BASE_URL).
 *
 * Step order: vet → date → details → confirm → success
 */

// E2E tenant has 0 vets → vet step is never auto-skipped (demo has 1 vet → skips).
const DEMO_SLUG = "REDACTED";
const E2E_PREVIEW_TOKEN = process.env.E2E_PREVIEW_TOKEN;

function bookingUrl() {
  if (!E2E_PREVIEW_TOKEN) {
    throw new Error("E2E_PREVIEW_TOKEN is required for booking preview tests");
  }

  return `/book/${DEMO_SLUG}?preview=${encodeURIComponent(E2E_PREVIEW_TOKEN)}`;
}

test.describe("Booking page", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
    });
  });

  test("loads and shows vet-selection step", async ({ page }) => {
    await page.goto(bookingUrl());

    // Main card must be visible — confirms page rendered, not a 404/error
    await page.getByTestId("booking-page").waitFor({ state: "visible" });
    // Wait for vets query to settle (prevents flaky step auto-skip mid-render)
    await page.waitForLoadState("networkidle");

    // Step indicator must report we are on the 'vet' step
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "vet"
    );

    // Auto-assign button must be present (always rendered on vet step)
    await expect(page.getByTestId("booking-vet-auto")).toBeVisible();
  });

  test("clicking auto-assign advances to date step", async ({ page }) => {
    await page.goto(bookingUrl());
    await page.getByTestId("booking-page").waitFor({ state: "visible" });
    await page.waitForLoadState("networkidle");

    await page.getByTestId("booking-vet-auto").click();

    // After click the step indicator must update to 'date'
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "date"
    );
  });

  test("completes public booking request happy path", async ({ page }) => {
    await page.goto(bookingUrl());
    await page.getByTestId("booking-page").waitFor({ state: "visible" });

    await page.getByTestId("booking-vet-auto").click();
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "date"
    );

    let selectedSlot = false;
    for (let pageIndex = 0; pageIndex < 3 && !selectedSlot; pageIndex += 1) {
      const dayCount = await page.getByTestId("booking-date-day").count();
      for (let dayIdx = 0; dayIdx < dayCount && !selectedSlot; dayIdx += 1) {
        // force: true bypasses WebKit stability check that hangs on transition-all buttons
        await page.getByTestId("booking-date-day").nth(dayIdx).click({ force: true });
        // Wait for slot list to render — networkidle resolves too early on WebKit
        await page.getByTestId("booking-date-slot").first().waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
        const slotCount = await page.getByTestId("booking-date-slot").count();
        for (let slotIdx = 0; slotIdx < slotCount; slotIdx += 1) {
          try {
            const slot = page.getByTestId("booking-date-slot").nth(slotIdx);
            await slot.waitFor({ state: "visible", timeout: 2_000 });
            await slot.click();
            // A slot is only valid once the hold was acquired and "next" is enabled.
            await expect(page.getByTestId("booking-date-next")).toBeEnabled({ timeout: 3_000 });
            selectedSlot = true;
            break;
          } catch {
            continue;
          }
        }
      }

      if (!selectedSlot) {
        const nextPage = page.getByTestId("booking-date-next-page");
        if (await nextPage.isDisabled()) break;
        await nextPage.click();
      }
    }

    expect(selectedSlot).toBe(true);
    await expect(page.getByTestId("booking-date-next")).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId("booking-date-next").click();
    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "details"
    );

    const unique = Date.now();
    await page.getByTestId("booking-patient-name").fill(`E2E Pet ${unique}`);
    await page.getByTestId("booking-patient-reason").fill("E2E Kontrolltermin");
    await page.getByTestId("booking-owner-first-name").fill("E2E");
    await page.getByTestId("booking-owner-last-name").fill("Booking");
    await page.getByTestId("booking-owner-email").fill(`user+booking-${unique}@googlemail.com`);
    await page.getByTestId("booking-owner-phone").fill("+491234567890");
    await page.getByTestId("booking-details-next").click();

    await expect(page.getByTestId("booking-step-indicator")).toHaveAttribute(
      "data-step",
      "confirm"
    );
    await page.getByTestId("booking-confirm-submit").click();
    await expect(page.getByTestId("booking-success")).toBeVisible({ timeout: 20_000 });
  });
});
