import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { owners } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * GET /api/unsubscribe?token=<signed_token>
 *
 * Verifies the HMAC-signed token, marks the owner as opted out of
 * reminder emails, and returns a confirmation page.
 *
 * DSGVO Art. 21 — right to object to direct marketing processing.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(htmlPage("Ungültiger Link", "Der Abmelde-Link ist ungültig oder fehlt."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const ownerId = verifyUnsubscribeToken(token);

  if (!ownerId) {
    return new NextResponse(
      htmlPage("Ungültiger Link", "Der Abmelde-Link ist ungültig oder abgelaufen. Bitte kontaktieren Sie Ihre Tierarztpraxis direkt."),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  try {
    const [owner] = await db
      .select({ id: owners.id, emailOptOut: owners.emailOptOut })
      .from(owners)
      .where(eq(owners.id, ownerId))
      .limit(1);

    if (!owner) {
      return new NextResponse(
        htmlPage("Nicht gefunden", "Der Datensatz wurde nicht gefunden."),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    if (!owner.emailOptOut) {
      await db
        .update(owners)
        .set({ emailOptOut: true, updatedAt: new Date() })
        .where(eq(owners.id, ownerId));
    }

    return new NextResponse(
      htmlPage(
        "Abgemeldet",
        "Sie wurden erfolgreich von allen automatischen Erinnerungs-E-Mails abgemeldet. Diese Änderung gilt für alle zukünftigen Nachrichten."
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return new NextResponse(
      htmlPage("Fehler", "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f9fafb; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; border-radius: 12px; padding: 2rem; max-width: 420px; width: 100%; box-shadow: 0 1px 4px rgba(0,0,0,.08); text-align: center; }
    h1 { font-size: 1.25rem; font-weight: 700; color: #111; margin: 0 0 .75rem; }
    p { font-size: .9rem; color: #555; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
