import { clerkSetup } from "@clerk/testing/playwright";
import { test as setup } from "@playwright/test";
import path from "path";
import fs from "fs";

const CLERK_API_BASE_URL = process.env.CLERK_API_BASE_URL ?? "https://api.clerk.com";

async function findClerkUserIdByEmail(email: string, secretKey: string) {
  const url = `${CLERK_API_BASE_URL}/v1/users?limit=100&email_address=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) return null;

  const users = (await response.json()) as Array<{
    id: string;
    email_addresses?: Array<{ email_address?: string | null }>;
  }>;

  const match = users.find((u) =>
    (u.email_addresses ?? []).some(
      (entry) => entry.email_address?.toLowerCase() === email.toLowerCase()
    )
  );

  return match?.id ?? null;
}

async function disableMfaForE2EUser() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  const email = process.env.E2E_EMAIL;
  if (!secretKey || !email) return;

  const userId = await findClerkUserIdByEmail(email, secretKey);
  if (!userId) return;

  await fetch(`${CLERK_API_BASE_URL}/v1/users/${userId}/mfa`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secretKey}` },
  });
}

/**
 * Auth state file — committed path, actual file is gitignored.
 * Consumed by the "authenticated" Playwright project via storageState.
 */
export const AUTH_FILE = path.join(import.meta.dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  try {
    await disableMfaForE2EUser();
  } catch {
    // Non-fatal hardening step: auth flow can still proceed without this.
  }

  // Enables Clerk's test mode — bypasses bot detection on the sign-in form.
  // Requires CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY in env.
  await clerkSetup();

  await page.goto("/sign-in");

  // Clerk's <SignIn /> renders standard HTML inputs — stable across Clerk versions.
  await page.locator('input[name="identifier"]').fill(process.env.E2E_EMAIL!);
  await page.locator('input[name="identifier"]').press("Enter");

  await page.locator('input[name="password"]').waitFor({ state: "visible", timeout: 10_000 });
  await page.locator('input[name="password"]').fill(process.env.E2E_PASSWORD!);
  await page.locator('input[name="password"]').press("Enter");

  // fallbackRedirectUrl="/dashboard" configured on the SignIn component —
  // wait for that redirect to confirm auth succeeded.
  await page.waitForURL("**/dashboard**", { timeout: 15_000 });

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
});
