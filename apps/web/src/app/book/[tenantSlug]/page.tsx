import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { adminDb } from '@/lib/db/client';
import { tenants, users } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import BookingClient from './BookingClient';

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params;
  const { preview: previewToken } = await searchParams;

  const [tenant] = await adminDb
    .select({ id: tenants.id, websiteEnabled: tenants.websiteEnabled, previewToken: tenants.previewToken })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug))
    .limit(1);

  if (!tenant) notFound();

  if (!tenant.websiteEnabled) {
    const isPreviewValid = previewToken && tenant.previewToken && previewToken === tenant.previewToken;
    if (!isPreviewValid) {
      const { userId } = await auth();
      if (!userId) notFound();
      const [member] = await adminDb
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.clerkId, userId), eq(users.tenantId, tenant.id)))
        .limit(1);
      if (!member) notFound();
    }
  }

  return <BookingClient tenantSlug={tenantSlug} previewToken={previewToken} />;
}
