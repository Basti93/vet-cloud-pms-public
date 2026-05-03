import { NextRequest, NextResponse } from "next/server";

/**
 * Legacy endpoint kept for backwards compatibility.
 * Deletion now uses 30-day deactivation with reactivation links.
 */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(
    new URL(
      `/deletion-confirmed?success=false&message=${encodeURIComponent(
        "Dieser Bestätigungslink ist veraltet. Verwenden Sie den Reaktivierungslink aus der Deaktivierungs-Email."
      )}`,
      request.url
    )
  );
}
