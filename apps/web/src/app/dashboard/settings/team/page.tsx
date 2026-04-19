"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";

export default function TeamPage() {
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ [key: string]: string }>({});

  useEffect(() => { setMounted(true); }, []);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } =
    trpc.admin.listUsers.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: roles, isLoading: rolesLoading } =
    trpc.admin.listRoles.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const assignRoleMutation = trpc.admin.assignRole.useMutation({
    onSuccess: () => { refetchUsers(); setSelectedRole({}); },
  });

  if (!mounted) return null;

  return (
    <div className="space-y-4">
      {usersLoading ? (
        <p style={{ color: "var(--color-muted)" }}>Lädt...</p>
      ) : users && users.length > 0 ? (
        users.map((user) => (
          <div
            key={user.id}
            className="rounded-xl p-4 flex items-center justify-between"
            style={{
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ backgroundColor: "var(--color-accent)" }}
              >
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  backgroundColor: "var(--color-accent-soft)",
                  color: "var(--color-accent-text)",
                }}
              >
                {user.active ? "Aktiv" : "Inaktiv"}
              </span>

              <select
                value={selectedRole[user.id] || ""}
                onChange={(e) => {
                  const roleId = e.target.value;
                  setSelectedRole((prev) => ({ ...prev, [user.id]: roleId }));
                  if (roleId && tenantId) {
                    assignRoleMutation.mutate({ tenantId, userId: user.id, roleId });
                  }
                }}
                disabled={rolesLoading || assignRoleMutation.isPending}
                className="text-sm px-3 py-1.5 rounded-lg border"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-bg)",
                  color: "var(--color-fg)",
                }}
              >
                <option value="">{user.roleName || user.role || "Rolle wählen..."}</option>
                {roles?.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
            </div>
          </div>
        ))
      ) : (
        <p style={{ color: "var(--color-muted)" }}>Keine Benutzer gefunden</p>
      )}

      {assignRoleMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim Zuweisen der Rolle: {assignRoleMutation.error.message}
        </div>
      )}
    </div>
  );
}
