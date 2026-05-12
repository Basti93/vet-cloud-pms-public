import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

/**
 * Auth state file — committed path, actual file is gitignored.
 * Consumed by the "authenticated" Playwright project via storageState.
 */
export const AUTH_FILE = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  // Enables Clerk's test mode — bypasses bot detection on the sign-in form.
  // Requires CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in env.
  await clerkSetup();

  await page.goto("/sign-in");

  // Clerk's <SignIn /> renders standard HTML inputs — stable across Clerk versions.
  await page.locator('input[name="identifier"]').fill(process.env.E2E_EMAIL!);
  await page.getByRole("button", { name: /continue/i }).click();

  await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: /continue/i }).click();

  // fallbackRedirectUrl="/dashboard" configured on the SignIn component —
  // wait for that redirect to confirm auth succeeded.
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
