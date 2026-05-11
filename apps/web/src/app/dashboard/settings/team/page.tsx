"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";
import { PERMISSIONS } from "@/lib/db/schema";
import { Users, Shield, UserCheck, UserX } from "lucide-react";

interface UserWithRoles {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  isAdmin: boolean;
  roles: Array<{ id: string; name: string; code: string }>;
}

interface InvitationItem {
  id: string;
  email: string;
  role: "admin" | "vet" | "reception";
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string | Date;
  createdAt: string | Date;
}

export default function TeamPage() {
  const { tenantId } = useTenant();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "vet" | "reception">("reception");
  const [toggleError, setToggleError] = useState("");

  const { data: permissions } = trpc.admin.getUserPermissions.useQuery();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && permissions && !permissions.includes(PERMISSIONS.USERS_MANAGE)) {
      router.push("/dashboard/settings/practice");
    }
  }, [permissions, mounted, router]);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } =
    trpc.admin.listUsers.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: seatInfo, refetch: refetchSeatInfo } =
    trpc.admin.getSeatInfo.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: roles, isLoading: rolesLoading } =
    trpc.admin.listRoles.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const assignRoleMutation = trpc.admin.assignRole.useMutation({
    onSuccess: () => { refetchUsers(); setShowAddRoleModal(null); },
  });

  const removeRoleMutation = trpc.admin.removeUserRole.useMutation({
    onSuccess: () => { refetchUsers(); },
  });
  const { data: invitations, isLoading: invitationsLoading, refetch: refetchInvitations } =
    trpc.admin.listInvitations.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });
  const createInvitationMutation = trpc.admin.createInvitation.useMutation({
    onSuccess: () => {
      setInviteEmail("");
      void refetchInvitations();
      void refetchSeatInfo();
    },
  });
  const resendInvitationMutation = trpc.admin.resendInvitation.useMutation({
    onSuccess: () => {
      void refetchInvitations();
    },
  });
  const revokeInvitationMutation = trpc.admin.revokeInvitation.useMutation({
    onSuccess: () => {
      void refetchInvitations();
    },
  });

  const toggleUserActiveMutation = trpc.admin.toggleUserActive.useMutation({
    onSuccess: () => {
      setToggleError("");
      void refetchUsers();
      void refetchSeatInfo();
    },
    onError: (error) => {
      setToggleError(error.message);
    },
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
  const assignableRoles = roles?.filter(
    (role) =>
      !users
        ?.find((u: UserWithRoles) => u.id === showAddRoleModal)
        ?.roles?.some((r) => r.id === role.id)
  ) ?? [];

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId || !inviteEmail.trim()) return;
    createInvitationMutation.mutate({
      tenantId,
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  const handleToggleActive = (userId: string, currentActive: boolean) => {
    if (!tenantId) return;
    setToggleError("");
    const action = currentActive ? "deaktivieren" : "aktivieren";
    const confirmed = window.confirm(
      currentActive
        ? "Möchten Sie diesen Benutzer wirklich deaktivieren? Er kann sich danach nicht mehr anmelden."
        : "Möchten Sie diesen Benutzer aktivieren? Er erhält wieder Zugriff und belegt einen Nutzerplatz."
    );
    if (!confirmed) return;
    toggleUserActiveMutation.mutate({ tenantId, userId, active: !currentActive });
  };

  const activeUsers = (users as UserWithRoles[] | undefined)?.filter((u) => u.active) ?? [];
  const inactiveUsers = (users as UserWithRoles[] | undefined)?.filter((u) => !u.active) ?? [];
  const maxUsers = seatInfo?.maxUsers ?? 5;
  const seatsUsed = seatInfo?.activeUsers ?? activeUsers.length;
  const seatsAvailable = seatInfo?.seatsAvailable ?? (maxUsers - seatsUsed);
  const seatPercentage = Math.min(100, (seatsUsed / maxUsers) * 100);

  return (
    <div className="space-y-4">
      {/* Seat Counter Card */}
      {seatInfo && (
        <div
          className="rounded-xl p-4"
          style={{
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: "var(--color-accent)" }} />
              <h3 className="text-base font-semibold">Nutzerplätze</h3>
            </div>
            <span className="text-sm font-medium">
              {seatsUsed}/{maxUsers} belegt
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="h-2.5 rounded-full overflow-hidden mb-3"
            style={{ backgroundColor: "var(--color-bg)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${seatPercentage}%`,
                backgroundColor:
                  seatsAvailable <= 0
                    ? "#ef4444"
                    : seatsAvailable <= 1
                    ? "#f59e0b"
                    : "var(--color-accent)",
              }}
            />
          </div>

          <div className="flex items-center gap-4 text-xs" style={{ color: "var(--color-muted)" }}>
            <span className="flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" style={{ color: "#22c55e" }} />
              {seatsUsed} aktiv
            </span>
            <span className="flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" style={{ color: "#9ca3af" }} />
              {inactiveUsers.length} inaktiv
            </span>
            <span>
              {seatsAvailable > 0
                ? `${seatsAvailable} ${seatsAvailable === 1 ? "Platz" : "Plätze"} verfügbar`
                : "Keine Plätze verfügbar"}
            </span>
          </div>

          {seatsAvailable <= 0 && (
            <p className="mt-2 text-xs" style={{ color: "#ef4444" }}>
              Alle Plätze sind belegt. Deaktivieren Sie Benutzer oder upgraden Sie den Tarif, um weitere einzuladen.
            </p>
          )}
        </div>
      )}

      {/* Active Users */}
      {usersLoading ? (
        <p style={{ color: "var(--color-muted)" }}>Lädt...</p>
      ) : activeUsers.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
            <UserCheck className="w-4 h-4" style={{ color: "#22c55e" }} />
            Aktiv ({activeUsers.length})
          </h3>
          <div className="space-y-2">
            {activeUsers.map((user: UserWithRoles) => (
              <div
                key={user.id}
                className="rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: user.isAdmin ? "#6366f1" : "var(--color-accent)" }}
                  >
                    {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate flex items-center gap-1.5">
                      {user.firstName} {user.lastName}
                      {user.isAdmin && (
                        <Shield className="w-3.5 h-3.5" style={{ color: "#6366f1" }} />
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    {user.roles && user.roles.length > 0 ? (
                      user.roles.map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: role.code === "admin" ? "#eef2ff" : "var(--color-accent-soft)",
                            color: role.code === "admin" ? "#4338ca" : "var(--color-accent-text)",
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

                  {!user.isAdmin && (
                    <button
                      onClick={() => handleToggleActive(user.id, true)}
                      disabled={toggleUserActiveMutation.isPending}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: "#fef2f2",
                        color: "#991b1b",
                        border: "1px solid #fecaca",
                      }}
                      title="Benutzer deaktivieren"
                    >
                      {toggleUserActiveMutation.isPending ? "..." : "Deaktivieren"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !usersLoading && inactiveUsers.length === 0 ? (
        <p style={{ color: "var(--color-muted)" }}>Keine Benutzer gefunden</p>
      ) : null}

      {/* Inactive Users */}
      {inactiveUsers.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: "var(--color-muted)" }}>
            <UserX className="w-4 h-4" style={{ color: "#9ca3af" }} />
            Inaktiv ({inactiveUsers.length})
          </h3>
          <div className="space-y-2">
            {inactiveUsers.map((user: UserWithRoles) => (
              <div
                key={user.id}
                className="rounded-xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 opacity-60"
                style={{
                  backgroundColor: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: "#9ca3af" }}
                  >
                    {(user.firstName?.[0] || user.email[0]).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate flex items-center gap-1.5">
                      {user.firstName} {user.lastName}
                      {user.isAdmin && (
                        <Shield className="w-3.5 h-3.5" style={{ color: "#6366f1" }} />
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: "var(--color-muted)" }}>
                      {user.email}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
                    style={{
                      backgroundColor: "#f3f4f6",
                      color: "#6b7280",
                    }}
                  >
                    Inaktiv
                  </span>

                  <button
                    onClick={() => handleToggleActive(user.id, false)}
                    disabled={toggleUserActiveMutation.isPending || seatsAvailable <= 0}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #bbf7d0",
                    }}
                    title={seatsAvailable <= 0 ? "Kein Platz verfügbar — upgraden Sie den Tarif" : "Benutzer aktivieren"}
                  >
                    {toggleUserActiveMutation.isPending ? "..." : "Aktivieren"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {toggleError && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          {toggleError}
        </div>
      )}

      <div
        className="rounded-xl p-4 space-y-3"
        style={{
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        <h3 className="text-base font-semibold">Einladungen</h3>
        <form onSubmit={handleCreateInvitation} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="name@beispiel.de"
            className="rounded-lg px-3 py-2 border"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "admin" | "vet" | "reception")}
            className="rounded-lg px-3 py-2 border"
            style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg)", color: "var(--color-fg)" }}
          >
            <option value="admin">Admin</option>
            <option value="vet">Vet</option>
            <option value="reception">Reception</option>
          </select>
          <button
            type="submit"
            disabled={createInvitationMutation.isPending || seatsAvailable <= 0}
            className="px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--color-accent)" }}
            title={seatsAvailable <= 0 ? "Keine Plätze verfügbar" : undefined}
          >
            {createInvitationMutation.isPending ? "Sendet..." : "Einladen"}
          </button>
        </form>

        {seatsAvailable <= 0 && (
          <p className="text-xs" style={{ color: "#ef4444" }}>
            Alle Nutzerplätze sind belegt. Upgraden Sie den Tarif, um weitere Benutzer einzuladen.
          </p>
        )}

        {invitationsLoading ? (
          <p style={{ color: "var(--color-muted)" }}>Einladungen laden...</p>
        ) : invitations && invitations.length > 0 ? (
          <div className="space-y-2">
            {(invitations as InvitationItem[]).map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                style={{ border: "1px solid var(--color-border)" }}
              >
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                    Rolle: {inv.role} · Status: {inv.status} · Gültig bis:{" "}
                    {new Date(inv.expiresAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {(inv.status === "pending" || inv.status === "expired") && (
                    <button
                      onClick={() => tenantId && resendInvitationMutation.mutate({ tenantId, invitationId: inv.id })}
                      className="px-3 py-1.5 rounded text-xs"
                      style={{ backgroundColor: "var(--color-bg)", border: "1px solid var(--color-border)" }}
                      disabled={resendInvitationMutation.isPending}
                    >
                      Erneut senden
                    </button>
                  )}
                  {(inv.status === "pending" || inv.status === "expired") && (
                    <button
                      onClick={() => tenantId && revokeInvitationMutation.mutate({ tenantId, invitationId: inv.id })}
                      className="px-3 py-1.5 rounded text-xs"
                      style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}
                      disabled={revokeInvitationMutation.isPending}
                    >
                      Widerrufen
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "var(--color-muted)" }}>Noch keine Einladungen.</p>
        )}
      </div>

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
          onClick={() => setShowAddRoleModal(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border p-5 shadow-xl mx-4"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--color-fg)" }}>
              Rolle hinzufügen
            </h3>
            <p className="text-sm mb-4" style={{ color: "var(--color-muted)" }}>
              Wählen Sie eine Rolle für diesen Benutzer aus.
            </p>

            <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
              {assignableRoles.length > 0 ? (
                assignableRoles.map((role) => (
                    <button
                      key={role.id}
                      onClick={() => handleAssignRole(showAddRoleModal, role.id)}
                      className="w-full text-left px-3 py-2.5 rounded-lg hover:opacity-80 transition-opacity"
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
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Keine weiteren Rollen verfügbar.
                </p>
              )}
            </div>

            <button
              onClick={() => setShowAddRoleModal(null)}
              className="w-full px-4 py-2 rounded-lg"
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
      {createInvitationMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim Erstellen der Einladung: {createInvitationMutation.error.message}
        </div>
      )}
      {resendInvitationMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim erneuten Senden: {resendInvitationMutation.error.message}
        </div>
      )}
      {revokeInvitationMutation.error && (
        <div className="rounded-lg p-4 text-sm" style={{ backgroundColor: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" }}>
          Fehler beim Widerrufen: {revokeInvitationMutation.error.message}
        </div>
      )}
    </div>
  );
}
