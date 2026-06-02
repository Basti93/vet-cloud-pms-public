import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import BookingClient from "./BookingClient";
import { canAccessPublicBookingTenant } from "@/lib/public-route/booking-access";

interface Props {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

export default async function BookingPage({ params, searchParams }: Props) {
  const { tenantSlug } = await params;
  const { preview: previewToken } = await searchParams;
  const { userId } = await auth();
  const allowed = await canAccessPublicBookingTenant({ tenantSlug, previewToken, userId });
  if (!allowed) notFound();

  return <BookingClient tenantSlug={tenantSlug} previewToken={previewToken} />;
}
