"use client";

import { useUser } from "@clerk/nextjs";

/**
 * Returns the current tenant ID.
 *
 * Priority:
 *  1. Clerk publicMetadata.tenantId  (set during onboarding)
 *  2. NEXT_PUBLIC_DEMO_TENANT_ID     (for local dev / demos)
 *
 * Usage:
 *   const { tenantId, isReady } = useTenant();
 *   if (!tenantId) return <OnboardingRequired />;
 */
export function useTenant() {
  const { user, isLoaded } = useUser();

  const tenantIdFromClerk =
    (user?.publicMetadata?.tenantId as string | undefined) ?? null;

  const tenantIdFromEnv =
    process.env.NEXT_PUBLIC_DEMO_TENANT_ID?.trim() || null;

  const tenantId = tenantIdFromClerk ?? tenantIdFromEnv;

  return {
    tenantId,
    isReady: isLoaded,
    isOnboarded: !!tenantId,
  };
}
