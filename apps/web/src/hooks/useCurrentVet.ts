import { trpc } from "@/lib/trpc/client";
import { ROLE_CODES } from "@/lib/auth/roles";

/**
 * Returns the current user's DB ID if they are a vet, otherwise null.
 * Use this on pages that should prioritize the current user's appointments.
 */
export function useCurrentVet() {
  const { data: currentUser, isError } = trpc.admin.getCurrentUser.useQuery(undefined, {
    retry: false,
  });

  // Return null unless this is explicitly a vet user.
  if (
    isError ||
    !currentUser?.id ||
    !currentUser.roleCodes?.includes(ROLE_CODES.VET)
  ) {
    return null;
  }

  return currentUser.id;
}
