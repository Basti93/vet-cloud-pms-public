"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Card } from "@/components/ui/card";
import { PERMISSIONS } from "@/lib/db/schema";

// Map permission keys to human-readable labels and categories
const PERMISSION_LABELS: Record<string, { label: string; category: string }> = {
  [PERMISSIONS.MEDICAL_READ]: {
    label: "Krankengeschichte lesen",
    category: "Medizinisch",
  },
  [PERMISSIONS.MEDICAL_CREATE]: {
    label: "Krankengeschichte erstellen",
    category: "Medizinisch",
  },
  [PERMISSIONS.MEDICAL_UPDATE]: {
    label: "Krankengeschichte bearbeiten",
    category: "Medizinisch",
  },
  [PERMISSIONS.APPOINTMENTS_READ]: {
    label: "Termine lesen",
    category: "Termine",
  },
  [PERMISSIONS.APPOINTMENTS_CREATE]: {
    label: "Termine erstellen",
    category: "Termine",
  },
  [PERMISSIONS.APPOINTMENTS_UPDATE]: {
    label: "Termine bearbeiten",
    category: "Termine",
  },
  [PERMISSIONS.APPOINTMENTS_CANCEL]: {
    label: "Termine absagen",
    category: "Termine",
  },
  [PERMISSIONS.PATIENTS_READ]: { label: "Patienten lesen", category: "Patienten" },
  [PERMISSIONS.PATIENTS_CREATE]: {
    label: "Patienten erstellen",
    category: "Patienten",
  },
  [PERMISSIONS.PATIENTS_UPDATE]: {
    label: "Patienten bearbeiten",
    category: "Patienten",
  },
  [PERMISSIONS.SCHEDULE_MANAGE]: {
    label: "Verfügbarkeitszeiten verwalten",
    category: "Planung",
  },
  [PERMISSIONS.USERS_MANAGE]: {
    label: "Benutzer verwalten",
    category: "Verwaltung",
  },
  [PERMISSIONS.SETTINGS_MANAGE]: {
    label: "Einstellungen verwalten",
    category: "Verwaltung",
  },
};

// Get all unique permission categories
const PERMISSION_CATEGORIES = Array.from(
  new Set(Object.values(PERMISSION_LABELS).map((p) => p.category))
).sort();

interface RoleWithPermissions {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  isEditableByTenant: boolean;
  tenantId: string;
  permissions: string[];
}

export default function RolesPage() {
  const { data: tenant } = trpc.tenant.getCurrent.useQuery();
  const { data: roles = [] } = trpc.admin.listRoles.useQuery(
    { tenantId: tenant?.id || "" },
    { enabled: !!tenant?.id }
  );

  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loadingPermission, setLoadingPermission] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const addPermissionMutation = trpc.admin.addPermissionToRole.useMutation({
    onSuccess: () => {
      void utils.admin.listRoles.invalidate();
      setLoadingPermission(null);
    },
    onError: (err) => {
      setMessage({ type: "error", text: err.message });
      setLoadingPermission(null);
    },
  });

  const removePermissionMutation = trpc.admin.removePermissionFromRole.useMutation({
    onSuccess: () => {
      void utils.admin.listRoles.invalidate();
      setLoadingPermission(null);
    },
    onError: (err) => {
      setMessage({ type: "error", text: err.message });
      setLoadingPermission(null);
    },
  });

  const handleTogglePermission = async (
    role: RoleWithPermissions,
    permission: string
  ) => {
    if (!tenant?.id) return;

    const permissionId = `${role.id}-${permission}`;
    setLoadingPermission(permissionId);
    setMessage(null);

    const hasPermission = role.permissions.includes(permission);

    if (hasPermission) {
      await removePermissionMutation.mutateAsync({
        tenantId: tenant.id,
        roleId: role.id,
        permission,
      });
    } else {
      await addPermissionMutation.mutateAsync({
        tenantId: tenant.id,
        roleId: role.id,
        permission,
      });
    }
  };

  if (!tenant?.id) {
    return <div>Laden...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {message && (
        <div
          className="p-4 rounded-lg border flex items-start gap-3"
          style={{
            backgroundColor:
              message.type === "error"
                ? "var(--color-error-soft)"
                : "var(--color-success-soft)",
            borderColor:
              message.type === "error"
                ? "var(--color-error)"
                : "var(--color-success)",
          }}
        >
          {message.type === "error" ? (
            <AlertCircle
              size={20}
              style={{ color: "var(--color-error)", flexShrink: 0 }}
            />
          ) : (
            <CheckCircle2
              size={20}
              style={{ color: "var(--color-success)", flexShrink: 0 }}
            />
          )}
          <p className="text-sm">{message.text}</p>
        </div>
      )}

      {/* Header */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-2">Rollenverwaltung</h2>
        <p style={{ color: "var(--color-muted)" }} className="text-sm">
          Verwalten Sie die Berechtigungen für jede Rolle. Deaktivieren Sie
          Berechtigungen, um den Zugriff zu beschränken.
        </p>
      </Card>

      {/* Roles */}
      <div className="space-y-4">
        {(roles as RoleWithPermissions[]).map((role) => (
          <Card key={role.id} className="p-6 border" style={{ borderColor: "var(--color-border)" }}>
            {role.isSystem && !role.isEditableByTenant && (
              <div
                className="mb-4 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: "var(--color-border)",
                  backgroundColor: "var(--color-surface)",
                  color: "var(--color-muted)",
                }}
              >
                Diese Systemrolle ist für Ihren Mandanten gesperrt. Änderungen sind nur möglich,
                wenn ein Systemadministrator die Bearbeitung freischaltet.
              </div>
            )}
            {/* Role Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="font-semibold text-base">{role.name}</h3>
                <p style={{ color: "var(--color-muted)" }} className="text-sm">
                  {role.description}
                </p>
              </div>
              {role.isSystem && (
                <span
                  className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                  style={{
                    backgroundColor: "var(--color-accent-soft)",
                    color: "var(--color-accent-text)",
                  }}
                >
                  System
                </span>
              )}
            </div>

            {/* Permissions by Category */}
            <div className="space-y-4">
              {PERMISSION_CATEGORIES.map((category) => {
                const categoryPermissions = Object.entries(PERMISSION_LABELS)
                  .filter(([_, p]) => p.category === category)
                  .map(([key]) => key);

                return (
                  <div key={category}>
                    <p className="text-sm font-medium mb-3">{category}</p>
                    <div className="space-y-2">
                      {categoryPermissions.map((permission) => {
                        const isEnabled = role.permissions.includes(permission);
                        const permissionId = `${role.id}-${permission}`;
                        const isLoading = loadingPermission === permissionId;
                        const isLockedSystemRole = role.isSystem && !role.isEditableByTenant;
                        const isDisabled = isLoading || isLockedSystemRole;

                        return (
                          <label
                            key={permission}
                            className="flex items-center gap-3 p-3 rounded-lg transition-opacity"
                            style={{
                              backgroundColor: "var(--color-surface)",
                              opacity: isDisabled ? 0.7 : 1,
                              cursor: isDisabled ? "not-allowed" : "pointer",
                            }}
                            title={
                              isLockedSystemRole
                                ? "Systemrolle ist gesperrt. Bearbeitung kann nur durch einen Systemadministrator aktiviert werden."
                                : undefined
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              disabled={isDisabled}
                              onChange={() =>
                                handleTogglePermission(role, permission)
                              }
                              className="w-4 h-4 rounded"
                              style={{
                                accentColor: "var(--color-accent)",
                              }}
                            />
                            <span className="text-sm flex-1">
                              {
                                PERMISSION_LABELS[permission]?.label ||
                                  permission
                              }
                            </span>
                            {isLoading && (
                              <Loader2
                                size={16}
                                className="animate-spin"
                                style={{ color: "var(--color-accent)" }}
                              />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* Info Box */}
      <Card
        className="p-4 border"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          <strong>Hinweis:</strong> Änderungen an Berechtigungen werden sofort
          gespeichert und beeinflussen die Zugriffskontrolle aller Benutzer mit
          dieser Rolle.
        </p>
      </Card>
    </div>
  );
}
