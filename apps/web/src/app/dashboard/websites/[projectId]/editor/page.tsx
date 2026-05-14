import { db } from '@/lib/db/client';
import { tenants, websiteProjects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { openingHoursToDisplayRows, normalizeWeekSchedule, type DaySchedule } from '@/lib/schedule-types';
import { WebsiteEditorShell } from '@/components/website-platform/studio/WebsiteEditorShell';

interface Props { params: Promise<{ projectId: string }> }

type TenantSpecialHours = Array<{ id: string; title: string; startsOn?: string; endsOn?: string; rows: { days: string; time: string }[]; note?: string }>;

function normalizeSpecialHours(value: unknown): TenantSpecialHours | null {
  if (!Array.isArray(value)) return null;
  const entries = value.flatMap((entry, index): TenantSpecialHours => {
    if (!entry || typeof entry !== 'object') return [];
    const raw = entry as { id?: unknown; title?: unknown; startsOn?: unknown; endsOn?: unknown; note?: unknown; rows?: unknown };
    const rows = Array.isArray(raw.rows)
      ? raw.rows.flatMap((row): { days: string; time: string }[] => {
          if (!row || typeof row !== 'object') return [];
          const candidate = row as { days?: unknown; time?: unknown };
          return typeof candidate.days === 'string' && typeof candidate.time === 'string'
            ? [{ days: candidate.days, time: candidate.time }]
            : [];
        })
      : [];
    if (rows.length === 0) return [];
    return [{
      id: typeof raw.id === 'string' ? raw.id : `special-hours-${index}`,
      title: typeof raw.title === 'string' ? raw.title : 'Abweichende Öffnungszeiten',
      startsOn: typeof raw.startsOn === 'string' ? raw.startsOn : undefined,
      endsOn: typeof raw.endsOn === 'string' ? raw.endsOn : undefined,
      note: typeof raw.note === 'string' ? raw.note : undefined,
      rows,
    }];
  });
  return entries.length > 0 ? entries : null;
}

export default async function WebsiteEditorPage({ params }: Props) {
  const { projectId } = await params;

  const [project] = await db
    .select({ tenantId: websiteProjects.ownerTenantId })
    .from(websiteProjects)
    .where(eq(websiteProjects.id, projectId))
    .limit(1);

  let tenantHoursRows: { days: string; time: string }[] | null = null;
  let tenantSpecialHours: TenantSpecialHours | null = null;
  let tenantContactInfo: { address?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null = null;

  if (project?.tenantId) {
    const [tenant] = await db
      .select({ openingHours: tenants.openingHours, specialOpeningHours: tenants.specialOpeningHours, address: tenants.address, city: tenants.city, phone: tenants.phone, email: tenants.email })
      .from(tenants)
      .where(eq(tenants.id, project.tenantId))
      .limit(1);
    if (tenant?.openingHours) {
      tenantHoursRows = openingHoursToDisplayRows(normalizeWeekSchedule(tenant.openingHours as DaySchedule[]))
        .map((r) => ({ days: r.day, time: r.time }));
    }
    tenantSpecialHours = normalizeSpecialHours(tenant?.specialOpeningHours);
    if (tenant) {
      tenantContactInfo = { address: tenant.address, city: tenant.city, phone: tenant.phone, email: tenant.email };
    }
  }

  return <WebsiteEditorShell projectId={projectId} tenantHoursRows={tenantHoursRows} tenantSpecialHours={tenantSpecialHours} tenantContactInfo={tenantContactInfo} />;
}
