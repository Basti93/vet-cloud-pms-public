import { expect, request as playwrightRequest, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { clerkSetup, setupClerkTestingToken } from "@clerk/testing/playwright";

// clerkSetup must run in the same worker process as setupClerkTestingToken because
// it writes CLERK_FAPI to process.env which does not cross worker process boundaries.

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
    let res;
    try {
      res = await request.get(url, { headers, timeout: 8_000 });
    } catch {
      continue;
    }
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
    try {
      await request.delete(`${CLERK_API_BASE_URL}/v1/users/${userId}`, { headers, timeout: 8_000 });
    } catch {
      // Best-effort cleanup only.
    }
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

async function completeEmailVerification(page: Page, email: string) {
  const codeInput = page
    .getByRole("textbox", { name: /verification code|bestätigungscode|code/i })
    .or(page.locator('input[name="code"]'))
    .first();

  await expect(page.getByRole("heading", { name: /bestätigen.*e-mail|verify.*email/i })).toBeVisible({
    timeout: 15_000,
  });
  await expect(codeInput).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(email)).toBeVisible();

  await codeInput.pressSequentially("424242", { delay: 50 });

  const verifyButton = page.locator('[data-localization-key="formButtonPrimary"]').last();
  await expect(verifyButton).toBeEnabled({ timeout: 5_000 });
  await verifyButton.click();
}

test.describe("Signup page", () => {
  test("can create a user via UI and clean it up in Clerk", async ({ page, isMobile }) => {
    test.setTimeout(150_000);
    test.skip(isMobile, "Run full signup flow on desktop only.");
    test.skip(!process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY is required for cleanup.");

    const unique = Date.now();
    const email = `staging-signup-${unique}+clerk_test@staging.example.com`;
    const password = `VetCloud!${unique}Aa`;
    const consoleErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    const cleanupRequest = await playwrightRequest.newContext();

    await clerkSetup();
    await setupClerkTestingToken({ page });
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-up/);

    try {
      await expect(page.locator('input[name="emailAddress"]').first()).toBeVisible({ timeout: 20_000 });
      await completeSignupForm(page, email, password);

      const signUpRequestPromise = page.waitForRequest(
        (req) =>
          req.url().includes("/v1/client/sign_ups") &&
          ["POST", "PUT"].includes(req.method()),
        { timeout: 25_000 }
      );

      const submitButton = page.locator('[data-localization-key="formButtonPrimary"]');
      await expect(submitButton).toBeVisible({ timeout: 10_000 });
      await expect(submitButton).toBeEnabled({ timeout: 10_000 });
      await submitButton.click();
      await expect(signUpRequestPromise).resolves.toBeTruthy();

      await completeEmailVerification(page, email);

      // Reaching onboarding/dashboard proves Clerk auth succeeded — no need to poll Clerk API
      await expect(page).toHaveURL(/\/(onboarding|dashboard)/, { timeout: 20_000 });

      const fatalCspOrCaptchaErrors = consoleErrors.filter(
        (text) =>
          text.includes("violates the following Content Security Policy directive") ||
          text.includes("Failed to load the CAPTCHA script")
      );
      expect(fatalCspOrCaptchaErrors).toEqual([]);
    } finally {
      await deleteClerkUsersByEmail(cleanupRequest, email);
      await cleanupRequest.dispose();
    }
  });
});
