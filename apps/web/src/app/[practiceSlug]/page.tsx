import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { type WebsiteTemplateKey } from '@/lib/theme';
import { getTemplateComponent } from '@/lib/website-generator';

interface Props {
  params: Promise<{ practiceSlug: string }>;
}

export default async function PracticeWebsitePage({ params }: Props) {
  const { practiceSlug } = await params;

  const [tenant] = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      email: tenants.email,
      phone: tenants.phone,
      address: tenants.address,
      city: tenants.city,
      tagline: tenants.tagline,
      monogram: tenants.monogram,
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
      websiteTemplate: tenants.websiteTemplate,
    })
    .from(tenants)
    .where(eq(tenants.slug, practiceSlug))
    .limit(1);

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Praxis nicht gefunden</h1>
          <p className="text-gray-500">Die angeforderte Praxis existiert nicht.</p>
        </div>
      </div>
    );
  }

  const TemplateComponent = getTemplateComponent(
    (tenant.websiteTemplate as WebsiteTemplateKey) || 'modern'
  );

  return (
    <TemplateComponent
      brandName={tenant.name}
      tagline={tenant.tagline || ''}
      monogram={tenant.monogram || tenant.name.slice(0, 2).toUpperCase()}
      phone={tenant.phone || undefined}
      email={tenant.email || undefined}
      address={tenant.address || undefined}
      city={tenant.city || undefined}
    />
  );
}
