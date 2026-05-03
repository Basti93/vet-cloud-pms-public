import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { tenantDeletionSchedules, tenants } from "@/lib/db/schema";
import { sendTenantLifecycleEmail } from "@/lib/email/service";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const baseUrl = new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(
      `${baseUrl}/deletion-confirmed?flow=reactivation&success=false&message=${encodeURIComponent("Reaktivierungs-Token fehlt")}`
    );
  }

  try {
    const [schedule] = await db
      .select({
        id: tenantDeletionSchedules.id,
        tenantId: tenantDeletionSchedules.tenantId,
        previousSubscriptionStatus: tenantDeletionSchedules.previousSubscriptionStatus,
        tenantName: tenants.name,
        tenantEmail: tenants.email,
      })
      .from(tenantDeletionSchedules)
      .innerJoin(tenants, eq(tenants.id, tenantDeletionSchedules.tenantId))
      .where(
        and(
          eq(tenantDeletionSchedules.reactivationToken, token),
          eq(tenantDeletionSchedules.status, "scheduled"),
          gt(tenantDeletionSchedules.reactivationTokenExpiresAt, new Date())
        )
      )
      .limit(1);

    if (!schedule) {
      return NextResponse.redirect(
        `${baseUrl}/deletion-confirmed?flow=reactivation&success=false&message=${encodeURIComponent("Token ungültig oder abgelaufen")}`
      );
    }

    await db
      .update(tenantDeletionSchedules)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
        reactivationToken: null,
        reactivationTokenExpiresAt: null,
      })
      .where(eq(tenantDeletionSchedules.id, schedule.id));

    const restoredStatus = schedule.previousSubscriptionStatus ?? "active";

    await db
      .update(tenants)
      .set({ subscriptionStatus: restoredStatus, updatedAt: new Date() })
      .where(eq(tenants.id, schedule.tenantId));

    if (schedule.tenantEmail) {
      await sendTenantLifecycleEmail({
        to: schedule.tenantEmail,
        practiceName: schedule.tenantName,
        subject: `Praxis reaktiviert: ${schedule.tenantName}`,
        body: "Die geplante Löschung wurde per Reaktivierungslink abgebrochen. Ihre Praxis ist wieder aktiv.",
      });
    }

    return NextResponse.redirect(
      `${baseUrl}/deletion-confirmed?flow=reactivation&success=true&message=${encodeURIComponent("Praxis wurde erfolgreich reaktiviert")}`
    );
  } catch (error) {
    const serializedError = serializeLogError(error);
    logEventAsync({
      level: "error",
      category: "tenant",
      eventType: "tenant_reactivation_failed",
      message: "Tenant reactivation failed",
      metadata: {
        operation: "tenant_reactivation_via_token",
        ...serializedError,
      },
    });
    return NextResponse.redirect(
      `${baseUrl}/deletion-confirmed?flow=reactivation&success=false&message=${encodeURIComponent("Fehler bei der Reaktivierung. Bitte kontaktieren Sie den Support.")}`
    );
  }
}
