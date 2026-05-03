import { trpc } from "@/lib/trpc/client";

/**
 * Returns the current user's DB ID if they are a vet, otherwise null.
 * Use this on pages that should prioritize the current user's appointments.
 */
export function useCurrentVet() {
  const { data: currentUser, isError } = trpc.admin.getCurrentUser.useQuery(undefined, {
    retry: false,
  });
  const { data: permissions } = trpc.admin.getUserPermissions.useQuery(undefined, {
    retry: false,
  });

  // Return null if user doesn't exist in database or cannot manage schedule
  if (isError || !currentUser?.id || !permissions?.includes("schedule:manage")) {
    return null;
  }

  return currentUser.id;
}
