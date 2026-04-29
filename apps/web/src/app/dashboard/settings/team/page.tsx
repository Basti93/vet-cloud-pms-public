"use client";

import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { trpc } from "@/lib/trpc/client";
import { useToast } from "@/lib/toast/context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface UserWithRoles {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  roles: Array<{ id: string; name: string }>;
}

interface ConfirmRemoveRoleState {
  userId: string;
  roleId: string;
  roleName: string;
  isOwnRole: boolean;
}

export default function TeamPage() {
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);
  const [showAddRoleModal, setShowAddRoleModal] = useState<string | null>(null);
  const [confirmRemoveRole, setConfirmRemoveRole] = useState<ConfirmRemoveRoleState | null>(null);
  const { addToast } = useToast();

  useEffect(() => { setMounted(true); }, []);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } =
    trpc.admin.listUsers.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: roles, isLoading: rolesLoading } =
    trpc.admin.listRoles.useQuery({ tenantId: tenantId! }, { enabled: !!tenantId && mounted });

  const { data: currentUser } = trpc.admin.getCurrentUser.useQuery();

  const assignRoleMutation = trpc.admin.assignRole.useMutation({
    onSuccess: async (data) => {
      addToast(data.message, "success");
      await refetchUsers();
      setShowAddRoleModal(null);
    },
    onError: (error) => {
      addToast(error.message, "error");
    },
  });

  const removeRoleMutation = trpc.admin.removeUserRole.useMutation({
    onSuccess: async (data) => {
      addToast(data.message, "success");
      await refetchUsers();
      setConfirmRemoveRole(null);
    },
    onError: (error) => {
      console.error("removeUserRole error:", error);
      addToast(error.message, "error");
    },
  });

  if (!mounted) return null;

  const handleAssignRole = (userId: string, roleId: string) => {
    if (!tenantId) return;
    assignRoleMutation.mutate({ tenantId, userId, roleId });
  };

  const handleInitiateRemoveRole = (userId: string, roleId: string, roleName: string) => {
    const isOwnRole = userId === currentUser?.id;
    setConfirmRemoveRole({ userId, roleId, roleName, isOwnRole });
  };

  const handleConfirmRemoveRole = () => {
    if (!tenantId || !confirmRemoveRole) return;
    removeRoleMutation.mutate({
      tenantId,
      userId: confirmRemoveRole.userId,
      roleId: confirmRemoveRole.roleId,
    });
  };

  return (
    <div className="space-y-4">
      {usersLoading ? (
        <p className="text-muted-foreground">Lädt...</p>
      ) : users && users.length > 0 ? (
        users.map((user: UserWithRoles) => (
          <div
            key={user.id}
            className="rounded-xl p-4 flex items-center justify-between border"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 bg-accent">
                {(user.firstName?.[0] || user.email[0]).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={user.active ? "success" : "warning"}>
                {user.active ? "Aktiv" : "Inaktiv"}
              </Badge>

              {/* Display assigned roles as badges */}
              <div className="flex flex-wrap gap-2 items-center max-w-xs">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <div
                      key={role.id}
                      className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent-text"
                    >
                      <span>{role.name}</span>
                      <button
                        onClick={() => handleInitiateRemoveRole(user.id, role.id, role.name)}
                        className="ml-1 hover:opacity-70 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Rolle entfernen"
                        disabled={removeRoleMutation.isPending || user.roles.length === 1}
                      >
                        ×
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">Keine Rollen</span>
                )}

                {/* Add Role button */}
                <Button
                  onClick={() => setShowAddRoleModal(user.id)}
                  variant="outline"
                  size="sm"
                  disabled={rolesLoading || usersLoading || assignRoleMutation.isPending}
                  className="text-xs border-dashed"
                >
                  + Rolle
                </Button>
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="text-muted-foreground">Keine Benutzer gefunden</p>
      )}

      {/* Add Role Dialog */}
      <Dialog open={!!showAddRoleModal} onOpenChange={(open) => !open && setShowAddRoleModal(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rolle hinzufügen</DialogTitle>
            <DialogDescription>
              Wählen Sie eine Rolle, um sie diesem Benutzer zuzuweisen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-64 overflow-y-auto py-4">
            {roles && roles.length > 0 ? (
              roles
                .filter(
                  (role) =>
                    !users
                      ?.find((u: UserWithRoles) => u.id === showAddRoleModal)
                      ?.roles?.some((r) => r.id === role.id)
                )
                .map((role) => (
                  <Button
                    key={role.id}
                    onClick={() => handleAssignRole(showAddRoleModal!, role.id)}
                    variant="outline"
                    className="w-full justify-start text-left"
                    disabled={assignRoleMutation.isPending}
                  >
                    {role.name}
                  </Button>
                ))
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">Keine Rollen verfügbar</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Role Confirmation Dialog */}
      <AlertDialog open={!!confirmRemoveRole} onOpenChange={(open) => !open && setConfirmRemoveRole(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rolle entfernen?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                Sie entfernen die Rolle <strong>{confirmRemoveRole?.roleName}</strong>.
              </div>
              {confirmRemoveRole?.isOwnRole && confirmRemoveRole.roleName === "Admin" && (
                <div className="text-yellow-600 font-medium">
                  ⚠️ Sie entfernen Ihre eigene Admin-Rolle. Sie verlieren dadurch Zugriff auf die Benutzerverwaltung.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveRole}
              disabled={removeRoleMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeRoleMutation.isPending ? "Entfernen..." : "Entfernen"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
