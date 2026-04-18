"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { trpc } from "@/server/client";
import { useTenant } from "@/hooks/useTenant";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function UsersPage() {
  const { tenantId } = useTenant();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["admin.listUsers", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return await trpc.admin.listUsers.query({ tenantId });
    },
    enabled: !!tenantId && mounted,
  });

  const { data: roles, isLoading: rolesLoading } = useQuery({
    queryKey: ["admin.listRoles", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return await trpc.admin.listRoles.query({ tenantId });
    },
    enabled: !!tenantId && mounted,
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({
      userId,
      roleId,
    }: {
      userId: string;
      roleId: string;
    }) => {
      if (!tenantId) throw new Error("No tenant ID");
      return await trpc.admin.assignRole.mutate({
        tenantId,
        userId,
        roleId,
      });
    },
    onSuccess: () => {
      refetchUsers();
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

      <div className="border rounded-lg bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Aktuelle Rolle</TableHead>
              <TableHead>Neue Rolle</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usersLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Lädt...
                </TableCell>
              </TableRow>
            ) : users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>
                    {user.firstName} {user.lastName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {user.roleName || user.role || "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={user.roleId || ""}
                      onValueChange={(roleId) => {
                        if (roleId) {
                          assignRoleMutation.mutate({
                            userId: user.id,
                            roleId,
                          });
                        }
                      }}
                      disabled={rolesLoading || assignRoleMutation.isPending}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Rolle wählen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {user.active ? (
                      <span className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded text-sm">
                        Aktiv
                      </span>
                    ) : (
                      <span className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm">
                        Inaktiv
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-4">
                  Keine Benutzer gefunden
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
