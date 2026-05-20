import { expect, test } from "@playwright/test";

test.describe("Production smoke", () => {
  test("homepage loads and primary CTA is present", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/example\.de/);
    await expect(page.getByRole("link", { name: /demo buchen|unverbindliche demo buchen/i }).first()).toBeVisible();
  });

  test("sign-in page renders clerk form shell", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(
      page.getByRole("heading", { name: /willkommen zurück|welcome back|einloggen/i }).first()
    ).toBeVisible();
  });

  test("sign-up page renders without fatal CSP/captcha console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-up/);
    await expect(
      page.getByRole("heading", { name: /erstellen sie ihr konto|create your account|sign up/i }).first()
    ).toBeVisible();

    await page.waitForTimeout(2_000);
    const fatalErrors = consoleErrors.filter(
      (text) =>
        text.includes("violates the following Content Security Policy directive") ||
        text.includes("Failed to load the CAPTCHA script")
    );
    expect(fatalErrors).toEqual([]);
  });
});
