import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ReactNode } from "react";
import { adminDb } from "@/lib/db/client";
import { tenantDeletionSchedules, tenants, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { generateThemeStyles } from "@/lib/theme-utils";
import { NoPraxisAssignedState } from "@/components/auth/NoPraxisAssignedState";
import DashboardContent from "./_layout-content";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const supportEmail = process.env.SUPPORT_EMAIL?.trim() || "support@example.com";

  let tenant: { themePreference: string | null; typographyPreference: string | null } | undefined;
  let hasTenantAssignment = false;
  let deactivationInfo:
    | {
        tenantName: string;
        scheduledFor: Date;
      }
    | undefined;

  const [user] = await adminDb
    .select({ tenantId: users.tenantId, active: users.active })
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  const isUserInactive = user && !user.active;

  if (user?.tenantId) {
    const [found] = await adminDb
      .select({
        id: tenants.id,
        name: tenants.name,
        themePreference: tenants.themePreference,
        typographyPreference: tenants.typographyPreference,
      })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
      .limit(1);

    if (found) {
      hasTenantAssignment = true;
      tenant = found;

      const [schedule] = await adminDb
        .select({ scheduledFor: tenantDeletionSchedules.scheduledFor })
        .from(tenantDeletionSchedules)
        .where(
          and(
            eq(tenantDeletionSchedules.tenantId, found.id),
            eq(tenantDeletionSchedules.status, "scheduled")
          )
        )
        .limit(1);

      if (schedule) {
        deactivationInfo = {
          tenantName: found.name,
          scheduledFor: schedule.scheduledFor,
        };
      }
    }
  }

  const themeStyle = tenant
    ? generateThemeStyles(tenant.themePreference, tenant.typographyPreference)
    : generateThemeStyles(null, null);

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        {!hasTenantAssignment ? (
          <NoPraxisAssignedState supportEmail={supportEmail} />
        ) : isUserInactive ? (
          <div
            className="min-h-screen flex items-center justify-center p-6"
            style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
          >
            <div className="max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-amber-800">Zugriff deaktiviert</h1>
              <p className="mt-3 text-sm text-amber-900">
                Ihr Benutzerkonto wurde deaktiviert. Sie haben keinen Zugriff mehr auf die Praxisdaten.
              </p>
              <p className="mt-2 text-sm text-amber-900">
                Kontaktieren Sie einen Administrator Ihrer Praxis, um Ihren Zugang wiederherzustellen.
              </p>
            </div>
          </div>
        ) : deactivationInfo ? (
          <div
            className="min-h-screen flex items-center justify-center p-6"
            style={{ backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
          >
            <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-red-800">Praxis deaktiviert</h1>
              <p className="mt-3 text-sm text-red-900">
                Die Praxis <strong>{deactivationInfo.tenantName}</strong> wurde deaktiviert und
                zur Löschung vorgemerkt.
              </p>
              <p className="mt-2 text-sm text-red-900">
                Geplantes Löschdatum:{" "}
                <strong>
                  {new Date(deactivationInfo.scheduledFor).toLocaleDateString("de-DE")}
                </strong>
              </p>
              <p className="mt-4 text-sm text-red-900">
                Die App ist für diese Praxis gesperrt. Für Reaktivierung nutzen Sie den Link aus
                der Deaktivierungs-E-Mail oder kontaktieren Sie den System-Admin.
              </p>
            </div>
          </div>
        ) : (
          <DashboardContent>{children}</DashboardContent>
        )}
      </div>
    </ClerkProvider>
  );
}
