import { z } from "zod";
import { and, eq, inArray, count } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure, tenantProcedure } from "@/server/trpc";
import {
  tenants,
  appointments,
  patients,
  owners,
  voiceCalls,
  users,
  vetSchedules,
  diagnoses,
  medications,
  vitals,
  roles,
  userRoles,
  rolePermissions,
  userInvitations,
  PERMISSIONS,
} from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";
import { requirePermission } from "@/server/trpc/middleware";
import { getUserPermissions } from "@/lib/auth/permissions";
import { invalidateRolePermissionCache } from "@/lib/auth/permission-cache";
import {
  acceptInvite,
  createInvite,
  resendInvite,
  revokeInvite,
  expirePastInvitations,
} from "@/server/invitations";
import { sendUserInvitationEmail } from "@/lib/email/service";
import { getMainDomain } from "@/lib/env";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";
import { ROLE_CODES } from "@/lib/auth/roles";
import { auditedMutation, auditedProtectedMutation } from "@/server/trpc/audited-mutation";

const DEMO_TENANT_ID = process.env.NEXT_PUBLIC_DEMO_TENANT_ID!;
const DEMO_TENANT_SLUG = "demo";

export const adminRouter = createTRPCRouter({
  /**
   * Get current user's tenant ID
   * Protected: Auth required
   */
  getTenantId: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const [user] = await ctx.db
      .select({ tenantId: users.tenantId })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found in database",
      });
    }

    return { tenantId: user.tenantId };
  }),

  /**
   * Get current user's full details (id, email, role, tenantId)
   * Protected: Auth required
   * Returns null if user doesn't exist in database yet
   */
  getCurrentUser: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const [user] = await ctx.db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        email: users.email,
        firstName: users.firstName,
        tenantId: users.tenantId,
        slotDurationMin: users.slotDurationMin,
      })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);

    if (!user) return null;

    const assignedRoles = await ctx.db
      .select({ code: roles.code })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    return {
      ...user,
      roleCodes: assignedRoles.map((r) => r.code.toLowerCase()),
    };
  }),

  /**
   * Get current user's permissions
   * Protected: Auth required
   * Returns array of permission strings the user has across all their roles
   */
  getUserPermissions: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });
    }

    const permissions = await getUserPermissions(ctx.userId);
    return Array.from(permissions);
  }),

  /**
   * Set demo tenant slug (one-time setup)
   * Protected: Admin only
   */
  setDemoSlug: protectedProcedure.mutation(async ({ ctx }) => {
    const [tenant] = await ctx.db
      .update(tenants)
      .set({ slug: DEMO_TENANT_SLUG })
      .where(eq(tenants.id, DEMO_TENANT_ID))
      .returning();

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Demo tenant not found",
      });
    }

    console.log(`✅ Demo tenant slug set to: ${DEMO_TENANT_SLUG}`);
    return { success: true, slug: tenant.slug };
  }),

  /**
   * Complete reset of demo tenant (clears all bookings/patients/owners/voice calls)
   * Protected: Admin only
   * Called nightly at 23:00 for fresh demo data
   */
  resetDemoTenant: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      // Delete in order to respect foreign key constraints
      // 1. Delete vitals
      const vitalsDeleted = await ctx.db
        .delete(vitals)
        .where(eq(vitals.tenantId, DEMO_TENANT_ID));

      // 2. Delete medications
      const medicationsDeleted = await ctx.db
        .delete(medications)
        .where(eq(medications.tenantId, DEMO_TENANT_ID));

      // 3. Delete diagnoses
      const diagnosesDeleted = await ctx.db
        .delete(diagnoses)
        .where(eq(diagnoses.tenantId, DEMO_TENANT_ID));

      // 4. Delete voice calls
      const voiceCallsDeleted = await ctx.db
        .delete(voiceCalls)
        .where(eq(voiceCalls.tenantId, DEMO_TENANT_ID));

      // 5. Delete appointments
      const appointmentsDeleted = await ctx.db
        .delete(appointments)
        .where(eq(appointments.tenantId, DEMO_TENANT_ID));

      // 6. Delete patients (cascade should handle, but explicit)
      const patientsDeleted = await ctx.db
        .delete(patients)
        .where(eq(patients.tenantId, DEMO_TENANT_ID));

      // 7. Delete owners (cascade should handle, but explicit)
      const ownersDeleted = await ctx.db
        .delete(owners)
        .where(eq(owners.tenantId, DEMO_TENANT_ID));

      // 8. Delete vet schedules
      const vetSchedulesDeleted = await ctx.db
        .delete(vetSchedules)
        .where(eq(vetSchedules.tenantId, DEMO_TENANT_ID));

      console.log(
        `🔄 Demo tenant reset completed:
        - Vitals deleted: ${vitalsDeleted.count || 0}
        - Medications deleted: ${medicationsDeleted.count || 0}
        - Diagnoses deleted: ${diagnosesDeleted.count || 0}
        - Voice calls deleted: ${voiceCallsDeleted.count || 0}
        - Appointments deleted: ${appointmentsDeleted.count || 0}
        - Patients deleted: ${patientsDeleted.count || 0}
        - Owners deleted: ${ownersDeleted.count || 0}
        - Vet schedules deleted: ${vetSchedulesDeleted.count || 0}`
      );

      return {
        success: true,
        stats: {
          vitalsDeleted: vitalsDeleted.count || 0,
          medicationsDeleted: medicationsDeleted.count || 0,
          diagnosesDeleted: diagnosesDeleted.count || 0,
          voiceCallsDeleted: voiceCallsDeleted.count || 0,
          appointmentsDeleted: appointmentsDeleted.count || 0,
          patientsDeleted: patientsDeleted.count || 0,
          ownersDeleted: ownersDeleted.count || 0,
          vetSchedulesDeleted: vetSchedulesDeleted.count || 0,
        },
      };
    } catch (error) {
      console.error("❌ Error resetting demo tenant:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reset demo tenant",
      });
    }
  }),

  /**
   * List all users in tenant with their roles
   * Protected: USERS_MANAGE permission
   */
  listUsers: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get all users in the tenant
      const allUsers = await ctx.db
        .select({
          id: users.id,
          clerkId: users.clerkId,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          active: users.active,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.tenantId, input.tenantId))
        .orderBy(users.email);

      if (allUsers.length === 0) {
        return [];
      }

      // Fetch all roles for these users in a single query
      const userIds = allUsers.map((u) => u.id);
      const allUserRoles = await ctx.db
        .select({
          userId: userRoles.userId,
          id: roles.id,
          name: roles.name,
          code: roles.code,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(inArray(userRoles.userId, userIds));

      // Group roles by user ID
      const rolesByUserId = new Map<string, Array<{ id: string; name: string; code: string }>>();
      for (const ur of allUserRoles) {
        if (!rolesByUserId.has(ur.userId)) {
          rolesByUserId.set(ur.userId, []);
        }
        rolesByUserId.get(ur.userId)!.push({ id: ur.id, name: ur.name, code: ur.code });
      }

      // Merge roles into users
      const usersWithRoles = allUsers.map((user) => ({
        ...user,
        roles: rolesByUserId.get(user.id) || [],
        isAdmin: (rolesByUserId.get(user.id) || []).some((r) => r.code === ROLE_CODES.ADMIN),
      }));

      return usersWithRoles;
    }),

  /**
   * Assign a role to a user (supports multiple roles per user)
   * Protected: USERS_MANAGE permission
   * Idempotent: assigning the same role twice returns success
   */
  assignRole: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify target user is in the same tenant
      const [targetUser] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!targetUser || targetUser.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in this tenant",
        });
      }

      // Verify role exists in this tenant
      const [roleExists] = await ctx.db
        .select({
          id: roles.id,
          code: roles.code,
          isSystem: roles.isSystem,
          isEditableByTenant: roles.isEditableByTenant,
        })
        .from(roles)
        .where(and(eq(roles.id, input.roleId), eq(roles.tenantId, input.tenantId)))
        .limit(1);

      if (!roleExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found in this tenant",
        });
      }
      // Try to insert the role assignment
      // If it already exists (unique constraint), the database will reject it
      try {
        await ctx.db.insert(userRoles).values({
          userId: input.userId,
          roleId: input.roleId,
          assignedBy: ctx.dbUserId,
        });
        // Invalidate role permission cache since user's roles changed
        invalidateRolePermissionCache(input.roleId);
        return { success: true, message: "Role assigned" };
      } catch (error: unknown) {
        const duplicate =
          error &&
          typeof error === "object" &&
          ("code" in error || "message" in error) &&
          ((error as { code?: string }).code === "23505" ||
            (error as { message?: string }).message?.includes("duplicate key"));
        // Check if this is a unique constraint violation (role already assigned)
        if (duplicate) {
          // Even if duplicate, invalidate cache to be safe
          invalidateRolePermissionCache(input.roleId);
          return { success: true, message: "Role already assigned" };
        }
        // Re-throw other errors
        throw error;
      }
    }),

  /**
   * Remove a role from a user
   * Protected: USERS_MANAGE permission
   * Constraint: User must always have at least one role
   */
  removeUserRole: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's current roles
      const userRolesList = await ctx.db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, input.userId));

      // Prevent removing all roles (user must have at least one)
      if (userRolesList.length === 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "User must have at least one role",
        });
      }

      // Delete the role assignment
      await ctx.db
        .delete(userRoles)
        .where(
          eq(userRoles.userId, input.userId) &&
          eq(userRoles.roleId, input.roleId)
        );

      // Invalidate role permission cache since user's roles changed
      invalidateRolePermissionCache(input.roleId);

      return { success: true, message: "Role removed" };
    }),

  /**
   * Get all roles for a tenant
   * Protected: USERS_MANAGE permission
   */
  listRoles: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const allRoles = await ctx.db
        .select()
        .from(roles)
        .where(eq(roles.tenantId, input.tenantId))
        .orderBy(roles.name);

      if (allRoles.length === 0) {
        return [];
      }

      // Fetch all permissions for these roles in a single query
      const roleIds = allRoles.map((r) => r.id);
      const allPerms = await ctx.db
        .select({
          roleId: rolePermissions.roleId,
          permission: rolePermissions.permission,
        })
        .from(rolePermissions)
        .where(inArray(rolePermissions.roleId, roleIds));

      // Group permissions by role ID
      const permsByRoleId = new Map<string, string[]>();
      for (const perm of allPerms) {
        if (!permsByRoleId.has(perm.roleId)) {
          permsByRoleId.set(perm.roleId, []);
        }
        permsByRoleId.get(perm.roleId)!.push(perm.permission);
      }

      // Merge permissions into roles
      const rolesWithPerms = allRoles.map((role) => ({
        ...role,
        permissions: permsByRoleId.get(role.id) || [],
      }));

      return rolesWithPerms;
    }),

  /**
   * Add a permission to a role
   * Protected: USERS_MANAGE permission
   * Idempotent: Adding same permission twice is safe
   */
  addPermissionToRole: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        roleId: z.string().uuid(),
        permission: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify role exists in this tenant
      const [roleExists] = await ctx.db
        .select({
          id: roles.id,
          code: roles.code,
          isSystem: roles.isSystem,
          isEditableByTenant: roles.isEditableByTenant,
        })
        .from(roles)
        .where(and(eq(roles.id, input.roleId), eq(roles.tenantId, input.tenantId)))
        .limit(1);

      if (!roleExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found in this tenant",
        });
      }
      if (roleExists.isSystem && !roleExists.isEditableByTenant) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "System role permissions are locked for this tenant.",
        });
      }

      try {
        await ctx.db.insert(rolePermissions).values({
          roleId: input.roleId,
          permission: input.permission,
        });
        // Invalidate role permission cache since permissions changed
        invalidateRolePermissionCache(input.roleId);
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined;
        // Ignore duplicate key errors (permission already assigned)
        if (code !== "23505") {
          throw error;
        }
        // Even if duplicate, invalidate cache to be safe
        invalidateRolePermissionCache(input.roleId);
      }

      return { success: true };
    }),

  /**
   * Remove a permission from a role
   * Protected: USERS_MANAGE permission
   */
  removePermissionFromRole: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        roleId: z.string().uuid(),
        permission: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify role exists in this tenant
      const [roleExists] = await ctx.db
        .select({ id: roles.id, code: roles.code, isSystem: roles.isSystem })
        .from(roles)
        .where(and(eq(roles.id, input.roleId), eq(roles.tenantId, input.tenantId)))
        .limit(1);

      if (!roleExists) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Role not found in this tenant",
        });
      }

      const CRITICAL_ADMIN_PERMISSIONS = [
        PERMISSIONS.USERS_MANAGE,
        PERMISSIONS.ROLES_MANAGE,
        PERMISSIONS.SETTINGS_MANAGE,
      ];
      if (
        roleExists.isSystem &&
        roleExists.code === ROLE_CODES.ADMIN &&
        CRITICAL_ADMIN_PERMISSIONS.includes(input.permission as (typeof CRITICAL_ADMIN_PERMISSIONS)[number])
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Critical permissions cannot be removed from the system Admin role.",
        });
      }

      // Self-lockout guard should only apply to critical management permissions.
      if (CRITICAL_ADMIN_PERMISSIONS.includes(input.permission as (typeof CRITICAL_ADMIN_PERMISSIONS)[number])) {
        const [currentDbUser] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.clerkId, ctx.userId!))
          .limit(1);
        if (!currentDbUser) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Current user not found" });
        }
        const currentAssignments = await ctx.db
          .select({ roleId: userRoles.roleId })
          .from(userRoles)
          .where(eq(userRoles.userId, currentDbUser.id));
        const assignedRoleIds = currentAssignments.map((r) => r.roleId);
        if (assignedRoleIds.includes(input.roleId)) {
          const permsRows = assignedRoleIds.length
            ? await ctx.db
                .select({
                  roleId: rolePermissions.roleId,
                  permission: rolePermissions.permission,
                })
                .from(rolePermissions)
                .where(inArray(rolePermissions.roleId, assignedRoleIds))
            : [];
          const stillHasPermissionAfterRemoval = permsRows.some(
            (row) => row.permission === input.permission && row.roleId !== input.roleId
          );
          if (!stillHasPermissionAfterRemoval) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message:
                "Cannot remove this permission because it would lock you out from managing roles.",
            });
          }
        }
      }

      await ctx.db
        .delete(rolePermissions)
        .where(and(eq(rolePermissions.roleId, input.roleId), eq(rolePermissions.permission, input.permission)));

      // Invalidate role permission cache since permissions changed
      invalidateRolePermissionCache(input.roleId);

      return { success: true };
    }),

  listInvitations: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await expirePastInvitations(input.tenantId);

      return ctx.db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          status: userInvitations.status,
          expiresAt: userInvitations.expiresAt,
          createdAt: userInvitations.createdAt,
          updatedAt: userInvitations.updatedAt,
        })
        .from(userInvitations)
        .where(eq(userInvitations.tenantId, input.tenantId))
        .orderBy(userInvitations.createdAt);
    }),

  createInvitation: auditedMutation({
    entity: "user_invitation",
    event: "user.invitation_created",
    action: "create",
    summary: "User invitation created",
    entityId: (result) => (result as { invitationId: string }).invitationId,
    changes: (result, input) => {
      const data = result as { inviteEmail: string; expiresAt: string };
      return {
        email: data.inviteEmail,
        role: (input as { role: string }).role,
        expiresAt: data.expiresAt,
      };
    },
  })
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "vet", "reception"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ name: tenants.name, maxUsers: tenants.maxUsers })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      // Enforce seat limit: count active users before allowing invite
      const [{ activeUsers }] = await ctx.db
        .select({ activeUsers: count() })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)));

      if (activeUsers >= (tenant.maxUsers ?? 5)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Seat limit reached. Your plan allows ${tenant.maxUsers ?? 5} users. Upgrade your subscription to invite more.`,
        });
      }

      const invite = await createInvite({
        tenantId: input.tenantId,
        invitedByUserId: ctx.dbUserId,
        email: input.email,
        role: input.role,
      });

      const acceptUrl = `${getMainDomain()}/invite/accept?token=${invite.token}`;
      // Fire-and-forget — invitation is created; email delivery is best-effort
      sendUserInvitationEmail({
        to: invite.email,
        practiceName: tenant.name,
        role: input.role,
        acceptUrl,
        expiresAt: invite.expiresAt.toLocaleString("de-DE"),
      }).then((emailResult) => {
        if (!emailResult.success) {
          const serialized = serializeLogError(emailResult.error);
          logEventAsync({
            level: "error",
            category: "email",
            eventType: "user_invitation_email_failed",
            message: "Invitation created but email delivery failed",
            tenantId: input.tenantId,
            userId: ctx.dbUserId,
            metadata: {
              operation: "create_invitation",
              recipient: invite.email,
              invitationId: invite.invitationId,
              ...serialized,
            },
          });
        }
      }).catch(() => {});

      return {
        success: true,
        invitationId: invite.invitationId,
        emailSent: true,
        inviteEmail: invite.email,
        acceptUrl,
        expiresAt: invite.expiresAt.toISOString(),
      };
    }),

  resendInvitation: auditedMutation({
    entity: "user_invitation",
    event: "user.invitation_resent",
    action: "update",
    summary: "User invitation resent",
    entityId: (result) => (result as { invitationId: string }).invitationId,
    changes: (result) => ({ expiresAt: (result as { expiresAt: string }).expiresAt }),
  })
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      const resent = await resendInvite({
        tenantId: input.tenantId,
        invitationId: input.invitationId,
        invitedByUserId: ctx.dbUserId,
      });

      const acceptUrl = `${getMainDomain()}/invite/accept?token=${resent.token}`;
      // Fire-and-forget — email delivery is best-effort
      sendUserInvitationEmail({
        to: resent.invitation.email,
        practiceName: tenant.name,
        role: resent.invitation.role,
        acceptUrl,
        expiresAt: resent.expiresAt.toLocaleString("de-DE"),
      }).then((emailResult) => {
        if (!emailResult.success) {
          const serialized = serializeLogError(emailResult.error);
          logEventAsync({
            level: "error",
            category: "email",
            eventType: "user_invitation_email_failed",
            message: "Invitation resent but email delivery failed",
            tenantId: input.tenantId,
            userId: ctx.dbUserId,
            metadata: {
              operation: "resend_invitation",
              recipient: resent.invitation.email,
              invitationId: resent.invitation.id,
              ...serialized,
            },
          });
        }
      }).catch(() => {});

      return {
        success: true,
        emailSent: true,
        invitationId: resent.invitation.id,
        expiresAt: resent.expiresAt.toISOString(),
      };
    }),

  revokeInvitation: auditedMutation({
    entity: "user_invitation",
    event: "user.invitation_revoked",
    action: "update",
    summary: "User invitation revoked",
    entityId: (result) => (result as { invitationId: string }).invitationId,
    changes: (result) => ({ email: (result as { email: string }).email }),
  })
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const invitation = await revokeInvite({ tenantId: input.tenantId, invitationId: input.invitationId });

      return { success: true, invitationId: invitation.id, email: invitation.email };
    }),

  getSeatInfo: tenantProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [tenant] = await ctx.db
        .select({ maxUsers: tenants.maxUsers })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);

      const [{ activeUsers }] = await ctx.db
        .select({ activeUsers: count() })
        .from(users)
        .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)));

      const [{ totalUsers }] = await ctx.db
        .select({ totalUsers: count() })
        .from(users)
        .where(eq(users.tenantId, input.tenantId));

      return {
        maxUsers: tenant?.maxUsers ?? 5,
        activeUsers,
        totalUsers,
        seatsAvailable: (tenant?.maxUsers ?? 5) - activeUsers,
      };
    }),

  toggleUserActive: auditedMutation({
    entity: "user",
    event: (_result, input) =>
      (input as { active: boolean }).active ? "user.activated" : "user.deactivated",
    action: "update",
    entityId: (_result, input) => (input as { userId: string }).userId,
    summary: (_result: unknown, input: unknown) =>
      (input as { active: boolean }).active ? "User activated" : "User deactivated",
    changes: (_result, input) => ({ active: (input as { active: boolean }).active }),
  })
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({
      tenantId: z.string().uuid(),
      userId: z.string().uuid(),
      active: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [targetUser] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId, active: users.active, clerkId: users.clerkId })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!targetUser || targetUser.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found in this tenant" });
      }

      if (targetUser.active === input.active) {
        return { success: true, message: "No change needed" };
      }

      if (input.active) {
        const [tenant] = await ctx.db
          .select({ maxUsers: tenants.maxUsers })
          .from(tenants)
          .where(eq(tenants.id, input.tenantId))
          .limit(1);
        const [{ activeUsers }] = await ctx.db
          .select({ activeUsers: count() })
          .from(users)
          .where(and(eq(users.tenantId, input.tenantId), eq(users.active, true)));
        if (activeUsers >= (tenant?.maxUsers ?? 5)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Cannot activate user. Seat limit reached (${tenant?.maxUsers ?? 5} users). Upgrade your plan first.`,
          });
        }
      }

      if (!input.active && targetUser.clerkId === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot deactivate yourself" });
      }

      const targetRoles = await ctx.db
        .select({ code: roles.code })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, targetUser.id));
      const isTargetAdmin = targetRoles.some((r) => r.code === ROLE_CODES.ADMIN);

      if (!input.active && isTargetAdmin) {
        const [{ adminCount }] = await ctx.db
          .select({ adminCount: count() })
          .from(userRoles)
          .innerJoin(roles, eq(userRoles.roleId, roles.id))
          .where(and(eq(roles.tenantId, input.tenantId), eq(roles.code, ROLE_CODES.ADMIN)));
        if (adminCount <= 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Cannot deactivate the last admin user. Assign another admin first.",
          });
        }
      }

      await ctx.db
        .update(users)
        .set({ active: input.active, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  acceptInvitation: auditedProtectedMutation({
    entity: "user_invitation",
    event: "user.invitation_accepted",
    action: "update",
    summary: "User invitation accepted",
    tenantId: (result) => (result as { tenantId: string }).tenantId,
    entityId: (result) => (result as { invitationId: string }).invitationId,
    changes: (result) => {
      const data = result as { role: string; userId: string };
      return { role: data.role, userId: data.userId };
    },
  })
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const accepted = await acceptInvite({ token: input.token, clerkUserId: ctx.userId });

      return {
        success: true,
        tenantId: accepted.tenantId,
        invitationId: accepted.invitationId,
        role: accepted.role,
        userId: accepted.userId,
      };
    }),
});
