"use client";

import { useUser } from "@clerk/nextjs";
import { trpc } from "@/lib/trpc/client";

/**
 * Returns the current tenant ID from the database.
 *
 * The tenantId is fetched from the users table based on the current Clerk user.
 * If the user hasn't completed onboarding, no tenantId will be available.
 *
 * Usage:
 *   const { tenantId, isReady } = useTenant();
 *   if (!tenantId) return <OnboardingRequired />;
 */
export function useTenant() {
  const { user, isLoaded: clerkLoaded } = useUser();

  // Fetch current tenant from database via TRPC
  const { data: tenant, isLoading: tenantLoading } = trpc.tenant.getCurrent.useQuery(
    undefined,
    { enabled: !!user && clerkLoaded }
  );

  const resolvedTenantId = tenant?.id ?? null;

  return {
    tenantId: resolvedTenantId,
    isReady: clerkLoaded && !tenantLoading,
    isOnboarded: !!resolvedTenantId,
  };
}
