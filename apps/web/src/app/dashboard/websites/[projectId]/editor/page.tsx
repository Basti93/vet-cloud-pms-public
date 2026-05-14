import { db } from '@/lib/db/client';
import { tenants, websiteProjects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openingHoursToDisplayRows, normalizeWeekSchedule, type DaySchedule } from '@/lib/schedule-types';
import { WebsiteEditorShell } from '@/components/website-platform/studio/WebsiteEditorShell';

interface Props { params: Promise<{ projectId: string }> }

export default async function WebsiteEditorPage({ params }: Props) {
  const { projectId } = await params;

  const [project] = await db
    .select({ tenantId: websiteProjects.ownerTenantId })
    .from(websiteProjects)
    .where(eq(websiteProjects.id, projectId))
    .limit(1);

  let tenantHoursRows: { days: string; time: string }[] | null = null;
  let tenantContactInfo: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null = null;

  if (project?.tenantId) {
    const [tenant] = await db
      .select({ openingHours: tenants.openingHours, address: tenants.address, city: tenants.city, phone: tenants.phone, email: tenants.email })
      .from(tenants)
      .where(eq(tenants.id, project.tenantId))
      .limit(1);
    if (tenant?.openingHours) {
      tenantHoursRows = openingHoursToDisplayRows(normalizeWeekSchedule(tenant.openingHours as DaySchedule[]))
        .map((r) => ({ days: r.day, time: r.time }));
    }
    if (tenant) {
      tenantContactInfo = { address: tenant.address, city: tenant.city, phone: tenant.phone, email: tenant.email };
    }
  }

  return <WebsiteEditorShell projectId={projectId} tenantHoursRows={tenantHoursRows} tenantContactInfo={tenantContactInfo} />;
}
