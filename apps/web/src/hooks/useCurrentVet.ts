import { trpc } from "@/lib/trpc/client";

/**
 * Returns the current user's DB ID if they are a vet, otherwise null.
 * Use this on pages that should prioritize the current user's appointments.
 */
export function useCurrentVet() {
  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();

  if (currentUser?.role === "vet") {
    return currentUser.id;
  }

  return null;
}
