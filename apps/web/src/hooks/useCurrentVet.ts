import { trpc } from "@/lib/trpc/client";

/**
 * Returns the current user's DB ID if they are a vet, otherwise null.
 * Use this on pages that should prioritize the current user's appointments.
 */
export function useCurrentVet() {
  const { data: currentUser, isError } = trpc.admin.getCurrentUser.useQuery(undefined, {
    retry: false,
  });

  // Return null if user doesn't exist in database or is not a vet
  if (isError || !currentUser?.role || currentUser.role !== "vet") {
    return null;
  }

  return currentUser.id;
}
