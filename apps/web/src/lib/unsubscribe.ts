import { createHmac } from "crypto";

const SECRET = process.env.UNSUBSCRIBE_SECRET ?? process.env.CRON_SECRET ?? "fallback-secret";

/**
 * Create a signed unsubscribe token for an owner.
 * Format: base64url(ownerId).<base64url(hmac)>
 */
export function createUnsubscribeToken(ownerId: string): string {
  const payload = Buffer.from(ownerId).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/**
 * Verify and decode an unsubscribe token.
 * Returns the ownerId if valid, null otherwise.
 */
export function verifyUnsubscribeToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (expected !== sig) return null;

  try {
    return Buffer.from(payload, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Build a full unsubscribe URL for embedding in emails.
 */
export function buildUnsubscribeUrl(ownerId: string, baseUrl?: string): string {
  const token = createUnsubscribeToken(ownerId);
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://app.example.com";
  return `${base}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}
