import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { tenants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

type Params = Promise<{ tenantId: string }>;

export async function GET(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { tenantId } = await params;

    const tenant = await db
      .select({
        themePreference: tenants.themePreference,
        typographyPreference: tenants.typographyPreference,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant.length) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      colorPreset: tenant[0].themePreference,
      typographyPairing: tenant[0].typographyPreference,
    });
  } catch (error) {
    console.error('Error fetching theme preference:', error);
    return NextResponse.json(
      { error: 'Failed to fetch theme preference' },
      { status: 500 }
    );
  }
}
