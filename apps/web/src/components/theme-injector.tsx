import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db/client';
import { tenants, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateCSSVariables, ColorPresetKey, TypographyPairingKey } from '@/lib/theme';

export async function ThemeInjector() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      // Not authenticated - use default theme
      return null;
    }

    // Get user's tenant from database
    const [user] = await db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!user) {
      return null;
    }

    // Get tenant's theme preferences
    const [tenant] = await db
      .select({
        themePreference: tenants.themePreference,
        typographyPreference: tenants.typographyPreference,
      })
      .from(tenants)
      .where(eq(tenants.id, user.tenantId))
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
  } catch (error) {
    // Silently fail - use default theme from globals.css
    return null;
  }
}
