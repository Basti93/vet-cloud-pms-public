"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";
import { PERMISSIONS } from "@/lib/db/schema";

interface UserWithRoles {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  roles: Array<{ id: string; name: string }>;
}

export default function TeamPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState<string | null>(null);

  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();

  useEffect(() => { setMounted(true); }, []);

  // Check permissions and redirect if user doesn't have access
  useEffect(() => {
    if (mounted && permissions && !permissions.includes(PERMISSIONS.USERS_MANAGE)) {
      router.push("/dashboard/settings/practice");
    }
  }, [permissions, mounted, router]);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } =
    trpc.admin.listUsers.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: roles, isLoading: rolesLoading } =
    trpc.admin.listRoles.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const assignRoleMutation = trpc.admin.assignRole.useMutation({
    onSuccess: () => { refetchUsers(); setShowAddRoleModal(null); },
  });

  const removeRoleMutation = trpc.admin.removeUserRole.useMutation({
    onSuccess: () => { refetchUsers(); },
  });

  if (!mounted) return null;

  const handleAssignRole = (userId: string, roleId: string) => {
    if (!tenantId) return;
    assignRoleMutation.mutate({ tenantId, userId, roleId });
  };

  const handleRemoveRole = (userId: string, roleId: string) => {
    if (!tenantId) return;
    removeRoleMutation.mutate({ tenantId, userId, roleId });
  };

  return (
    <div className="space-y-4">
      {usersLoading ? (
        <p style={{ color: "var(--color-muted)" }}>Lädt...</p>
      ) : users && users.length > 0 ? (
        users.map((user: UserWithRoles) => (
          <div
            key={user.id}
            className="rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            {/* User Info */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>
                  {user.email}
                </p>
              </div>
            </div>

            {/* Status and Roles - Stack on mobile */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <span
                className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
                style={{
                  backgroundColor: "var(--color-accent-soft)",
                  color: "var(--color-accent-text)",
                }}
              >
                {user.active ? "Aktiv" : "Inaktiv"}
              </span>

              {/* Display assigned roles as badges - wrap on mobile */}
              <div className="flex flex-wrap gap-2 items-center">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: "var(--color-accent-soft)",
                        color: "var(--color-accent-text)",
                      }}
                    >
                      <span>{role.name}</span>
                      <button
                        onClick={() => handleRemoveRole(user.id, role.id)}
                        className="ml-1 hover:opacity-70 cursor-pointer"
                        title="Rolle entfernen"
                        disabled={removeRoleMutation.isPending || user.roles.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <span style={{ color: "var(--color-muted)" }}>Keine Rollen</span>
                )}

                {/* Add Role button */}
                <button
                  onClick={() => setShowAddRoleModal(user.id)}
                  className="px-2 py-1 rounded-lg border border-dashed text-xs font-medium hover:bg-opacity-50 flex-shrink-0"
                  style={{
                    borderColor: "var(--color-border)",
                    backgroundColor: "var(--color-bg)",
                    color: "var(--color-fg)",
                  }}
                  disabled={rolesLoading || assignRoleMutation.isPending}
                >
                  + Rolle
                </button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: "var(--color-muted)" }}>Keine Benutzer gefunden</p>
      )}

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowAddRoleModal(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: "var(--color-surface)" }}
          >
            <h3 className="font-bold mb-4" style={{ color: "var(--color-fg)" }}>
              Rolle hinzufügen
            </h3>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {roles && roles.length > 0 ? (
                roles
                  .filter(
                    (role) =>
                      !users
                        ?.find((u: UserWithRoles) => u.id === showAddRoleModal)
                        ?.roles?.some((r) => r.id === role.id)
                  )
                  .map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleAssignRole(showAddRoleModal, role.id)}
                      className="w-full text-left px-4 py-2 rounded hover:opacity-70"
                      style={{
                        backgroundColor: "var(--color-bg)",
                        color: "var(--color-fg)",
                        border: "1px solid var(--color-border)",
                      }}
                      disabled={assignRoleMutation.isPending}
                    >
                      {role.name}
                    </button>
                  ))
              ) : (
                <p style={{ color: "var(--color-muted)" }}>Keine Rollen verfügbar</p>
              )}
            </div>

            <button
              onClick={() => setShowAddRoleModal(null)}
              className="w-full px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--color-border)",
                color: "var(--color-fg)",
              }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Error messages */}
      {assignRoleMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim Zuweisen der Rolle: {assignRoleMutation.error.message}
        </div>
      )}

      {removeRoleMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim Entfernen der Rolle: {removeRoleMutation.error.message}
        </div>
      )}
    </div>
  );
}
