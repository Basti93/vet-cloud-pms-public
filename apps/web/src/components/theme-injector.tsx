import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateCSSVariables, ColorPresetKey, TypographyPairingKey } from '@/lib/theme';

export async function ThemeInjector() {
  const cookieStore = await cookies();
  const practiceSlug = cookieStore.get('practice_slug')?.value;

  if (!practiceSlug) {
    return null;
  }

  const [tenant] = await db
    .select({
      themePreference: tenants.themePreference,
      typographyPreference: tenants.typographyPreference,
    })
    .from(tenants)
    .where(eq(tenants.slug, practiceSlug))
    .limit(1);

  if (!tenant) {
    return null;
  }

  const cssVariables = generateCSSVariables(
    (tenant.themePreference as ColorPresetKey) || 'sage',
    (tenant.typographyPreference as TypographyPairingKey) || 'modern'
  );

  return (
    <style suppressHydrationWarning>
      {`:root { ${cssVariables} }`}
    </style>
  );
}
