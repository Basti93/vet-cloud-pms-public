import { expect, request as playwrightRequest, test, type Browser, type Page } from "@playwright/test";
import { setupClerkTestingToken } from "@clerk/testing/playwright";

const CLERK_API_BASE_URL = process.env.CLERK_API_BASE_URL ?? "https://api.clerk.com";

function findAcceptUrl(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;

  if ("acceptUrl" in value && typeof value.acceptUrl === "string") {
    return value.acceptUrl;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findAcceptUrl(item);
      if (match) return match;
    }
    return null;
  }

  for (const item of Object.values(value)) {
    const match = findAcceptUrl(item);
    if (match) return match;
  }

  return null;
}

async function findClerkUserIdsByEmail(email: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return [];

  const request = await playwrightRequest.newContext();
  try {
    const headers = { Authorization: `Bearer ${secretKey}` };
    const candidates = new Set<string>();
    const urls = [
      `${CLERK_API_BASE_URL}/v1/users?limit=100&email_address=${encodeURIComponent(email)}`,
      `${CLERK_API_BASE_URL}/v1/users?limit=100&query=${encodeURIComponent(email)}`,
    ];

    for (const url of urls) {
      const res = await request.get(url, { headers, timeout: 8_000 }).catch(() => null);
      if (!res?.ok()) continue;

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
  } finally {
    await request.dispose();
  }
}

async function deleteClerkUsersByEmail(email: string) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return;

  const request = await playwrightRequest.newContext();
  try {
    const headers = { Authorization: `Bearer ${secretKey}` };
    const userIds = await findClerkUserIdsByEmail(email);

    for (const userId of userIds) {
      await request.delete(`${CLERK_API_BASE_URL}/v1/users/${userId}`, { headers, timeout: 8_000 }).catch(() => null);
    }
  } finally {
    await request.dispose();
  }
}

async function completeSignup(page: Page, email: string, password: string) {
  await expect(page.locator('input[name="emailAddress"]').first()).toBeVisible({ timeout: 10_000 });
  await page.locator('input[name="emailAddress"]').first().fill(email);
  await page.locator('input[name="firstName"]').first().fill("Invite");
  await page.locator('input[name="lastName"]').first().fill("E2E");
  await page.locator('input[name="password"]').first().fill(password);

  const submitButton = page.locator('[data-localization-key="formButtonPrimary"]');
  await expect(submitButton).toBeEnabled({ timeout: 5_000 });
  await submitButton.click();
}

async function completeEmailVerification(page: Page, email: string) {
  const codeInput = page
    .getByRole("textbox", { name: /verification code|bestätigungscode|code/i })
    .or(page.locator('input[name="code"]'))
    .first();

  await expect(page.getByRole("heading", { name: /bestätigen.*e-mail|verify.*email/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(email)).toBeVisible();
  await codeInput.pressSequentially("424242", { delay: 50 });

  const verifyButton = page.locator('[data-localization-key="formButtonPrimary"]').last();
  await expect(verifyButton).toBeEnabled({ timeout: 5_000 });
  await verifyButton.click();
}

async function createInvitation(page: Page, email: string) {
  await page.goto("/dashboard/settings/team");
  await expect(page.getByTestId("team-invite-form")).toBeVisible({ timeout: 8_000 });

  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/trpc/admin.createInvitation") &&
      response.request().method() === "POST",
    { timeout: 15_000 }
  );

  await page.getByTestId("team-invite-email").fill(email);
  await page.getByTestId("team-invite-role").selectOption("reception");
  // Wait for tenantId to load — button stays disabled until useTenant() resolves
  await expect(page.getByTestId("team-invite-submit")).toBeEnabled({ timeout: 5_000 });
  await page.getByTestId("team-invite-submit").click();

  const response = await responsePromise;
  expect(response.ok()).toBe(true);

  const acceptUrl = findAcceptUrl(await response.json());
  expect(acceptUrl).toContain("/invite/accept?token=");
  await expect(page.getByText(email)).toBeVisible({ timeout: 6_000 });

  return acceptUrl!;
}

async function deactivateInvitedUser(page: Page, email: string) {
  await page.goto("/dashboard/settings/team");
  const userRow = page.getByTestId("team-user-row").filter({ hasText: email }).first();

  if (!(await userRow.isVisible({ timeout: 8_000 }).catch(() => false))) {
    return;
  }

  page.once("dialog", (dialog) => dialog.accept());
  await userRow.getByTestId("team-user-deactivate").click();
  await expect(userRow.getByText("Inaktiv")).toBeVisible({ timeout: 8_000 });
}

test.describe("Invitation flow", () => {
  test.skip("invited user can sign up and accept invitation", async ({ page, browser }: { page: Page; browser: Browser }) => {
    test.setTimeout(90_000);
    test.skip(!process.env.CLERK_SECRET_KEY, "CLERK_SECRET_KEY is required for Clerk cleanup.");

    const unique = Date.now();
    const email = `staging-invite-${unique}+clerk_test@staging.example.com`;
    const password = `VetCloud!${unique}Aa`;
    let acceptPage: Page | null = null;

    try {
      const acceptUrl = await createInvitation(page, email);

      const acceptContext = await browser.newContext();
      acceptPage = await acceptContext.newPage();
      await setupClerkTestingToken({ page: acceptPage });
      await acceptPage.goto(acceptUrl);

      await expect(acceptPage.getByTestId("invite-accept-title")).toBeVisible({ timeout: 8_000 });
      await acceptPage.getByTestId("invite-accept-register").click();
      await expect(acceptPage).toHaveURL(/\/sign-up/);

      await completeSignup(acceptPage, email, password);
      await completeEmailVerification(acceptPage, email);
      // Clerk auth + acceptInvitation mutation + router.replace — allow 20s for the chain
      await expect(acceptPage).toHaveURL(/\/dashboard/, { timeout: 20_000 });

      await expect
        .poll(async () => (await findClerkUserIdsByEmail(email)).length, {
          timeout: 12_000,
          intervals: [2_000, 3_000, 5_000],
        })
        .toBeGreaterThan(0);

      await deactivateInvitedUser(page, email);
    } finally {
      await acceptPage?.context().close();
      await deleteClerkUsersByEmail(email);
    }
  });
});
