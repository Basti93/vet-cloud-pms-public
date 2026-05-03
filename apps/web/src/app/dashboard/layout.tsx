import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { ReactNode } from "react";
import { db } from "@/lib/db/client";
import { tenantDeletionSchedules, tenants, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { generateThemeStyles } from "@/lib/theme-utils";
import DashboardContent from "./_layout-content";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { userId } = await auth();

  let tenant: { themePreference: string | null; typographyPreference: string | null } | undefined;
  let deactivationInfo:
    | {
        tenantName: string;
        scheduledFor: Date;
      }
    | undefined;

  if (userId) {
    const [user] = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (user) {
      const [found] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
          themePreference: tenants.themePreference,
          typographyPreference: tenants.typographyPreference,
        })
        .from(tenants)
        .where(eq(tenants.id, user.tenantId))
        .limit(1);
      tenant = found;

      if (found?.id) {
        const [schedule] = await db
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
  }

  const themeStyle = tenant
    ? generateThemeStyles(tenant.themePreference, tenant.typographyPreference)
    : generateThemeStyles(null, null);

  return (
    <ClerkProvider>
      <div style={themeStyle}>
        {deactivationInfo ? (
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
