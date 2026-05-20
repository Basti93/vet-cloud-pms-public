import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

const CLERK_API_BASE_URL = process.env.CLERK_API_BASE_URL ?? "https://api.clerk.com";

async function fillIfVisible(locator: Locator, value: string) {
  if (await locator.isVisible()) {
    await locator.fill(value);
  }
}

async function findClerkUserIdsByEmail(request: APIRequestContext, email: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return [];

  const headers = { Authorization: `Bearer ${secretKey}` };
  const candidates = new Set<string>();
  const urls = [
    `${CLERK_API_BASE_URL}/v1/users?limit=100&email_address=${encodeURIComponent(email)}`,
    `${CLERK_API_BASE_URL}/v1/users?limit=100&query=${encodeURIComponent(email)}`,
  ];

  for (const url of urls) {
    const res = await request.get(url, { headers });
    if (!res.ok()) continue;

    const body = (await res.json()) as Array<{
      id: string;
      email_addresses?: Array<{ email_address?: string | null }>;
    }>;
    for (const user of body ?? []) {
      const hasExactEmail = (user.email_addresses ?? []).some(
        (entry) => entry.email_address?.toLowerCase() === email.toLowerCase()
      );
      if (hasExactEmail) candidates.add(user.id);
    }
  }

  return [...candidates];
}

async function deleteClerkUsersByEmail(request: APIRequestContext, email: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;

  const headers = { Authorization: `Bearer ${secretKey}` };
  const userIds = await findClerkUserIdsByEmail(request, email);

  for (const userId of userIds) {
    await request.delete(`${CLERK_API_BASE_URL}/v1/users/${userId}`, { headers });
  }
}

async function completeSignupForm(page: Page, email: string, password: string) {
  await fillIfVisible(page.locator('input[name="emailAddress"]').first(), email);
  await fillIfVisible(page.locator('input[name="firstName"]').first(), "E2E");
  await fillIfVisible(page.locator('input[name="lastName"]').first(), "Signup");
  await fillIfVisible(page.locator('input[name="username"]').first(), `e2e_${Date.now()}`);

  await fillIfVisible(page.locator('input[name="password"]').first(), password);
  await fillIfVisible(page.locator('input[name="confirmPassword"]').first(), password);

  const termsCheckbox = page.locator('input[type="checkbox"]').first();
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.check();
  }
}

test.describe("Signup page", () => {
  test("can create a user via UI and clean it up in Clerk", async ({ page, request, isMobile }) => {
    test.skip(isMobile, "Run full signup flow on desktop only.");
    test.skip(!process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY is required for cleanup.");

    const unique = Date.now();
    const email = `user+staging-signup-${unique}@googlemail.com`;
    const password = `VetCloud!${unique}Aa`;
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await clerkSetup();
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-up/);

    try {
      await expect(page.locator('input[name="emailAddress"]').first()).toBeVisible({ timeout: 20_000 });
      await completeSignupForm(page, email, password);

      await page.locator('button[type="submit"]').first().click();

      await expect
        .poll(async () => {
          const ids = await findClerkUserIdsByEmail(request, email);
          return ids.length;
        }, { timeout: 20_000 })
        .toBeGreaterThan(0);

      const currentPath = new URL(page.url()).pathname;
      const expectedTerminalPath =
        currentPath.startsWith("/onboarding") ||
        currentPath.startsWith("/dashboard") ||
        currentPath.startsWith("/sign-up");
      expect(expectedTerminalPath).toBe(true);

      const fatalCspOrCaptchaErrors = consoleErrors.filter(
        (text) =>
          text.includes("violates the following Content Security Policy directive") ||
          text.includes("Failed to load the CAPTCHA script")
      );
      expect(fatalCspOrCaptchaErrors).toEqual([]);
    } finally {
      await deleteClerkUsersByEmail(request, email);
    }
  });
});
