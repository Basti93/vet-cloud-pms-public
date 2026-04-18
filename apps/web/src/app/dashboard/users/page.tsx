"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";

export default function UsersPage() {
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } =
    trpc.admin.listUsers.useQuery(
      { tenantId: tenantId! },
      { enabled: !!tenantId && mounted }
    );

  const { data: roles, isLoading: rolesLoading } =
    trpc.admin.listRoles.useQuery(
      { tenantId: tenantId! },
      { enabled: !!tenantId && mounted }
    );

  const assignRoleMutation = trpc.admin.assignRole.useMutation({
    onSuccess: () => {
      refetchUsers();
      setSelectedRole({});
    },
  });

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Benutzerverwaltung</h1>
        <p className="text-gray-600 mt-2">
          Verwalten Sie Benutzer und weisen Sie Rollen zu
        </p>
      </div>

      <div className="space-y-4">
        {usersLoading ? (
          <p className="text-gray-600">Lädt...</p>
        ) : users && users.length > 0 ? (
          users.map((user) => (
            <div
              key={user.id}
              className="border rounded-lg p-4 bg-white flex items-center justify-between"
            >
              <div className="flex-1">
                <p className="font-semibold">{user.email}</p>
                <p className="text-sm text-gray-600">
                  {user.firstName} {user.lastName}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-gray-500 mb-1">Aktuelle Rolle</p>
                  <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-medium">
                    {user.roleName || user.role || "—"}
                  </span>
                </div>

                <select
                  value={selectedRole[user.id] || ""}
                  onChange={(e) => {
                    const roleId = e.target.value;
                    setSelectedRole((prev) => ({
                      ...prev,
                      [user.id]: roleId,
                    }));
                    if (roleId && tenantId) {
                      assignRoleMutation.mutate({
                        tenantId,
                        userId: user.id,
                        roleId,
                      });
                    }
                  }}
                  disabled={rolesLoading || assignRoleMutation.isPending}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="">Rolle wählen...</option>
                  {roles?.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>

                <span
                  className={`text-sm px-3 py-1 rounded ${
                    user.active
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {user.active ? "Aktiv" : "Inaktiv"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600">Keine Benutzer gefunden</p>
        )}
      </div>

      {assignRoleMutation.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Fehler beim Zuweisen der Rolle:{" "}
          {assignRoleMutation.error.message}
        </div>
      )}
    </div>
  );
}
