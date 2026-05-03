import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc";
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
import {
  acceptInvite,
  createInvite,
  resendInvite,
  revokeInvite,
  expirePastInvitations,
} from "@/server/invitations";
import { sendUserInvitationEmail } from "@/lib/email/service";
import { getMainDomain } from "@/lib/env";
import { writeAuditLog } from "@/server/audit";
import { logEventAsync, serializeLogError } from "@/server/trpc/logging-middleware";
import { ROLE_CODES } from "@/lib/auth/roles";

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

    return user || null;
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
  listUsers: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify current user is in this tenant
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot list users from other tenants",
        });
      }

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

      // For each user, fetch all their assigned roles
      const usersWithRoles = await Promise.all(
        allUsers.map(async (user) => {
          const assignedRoles = await ctx.db
            .select({
              id: roles.id,
              name: roles.name,
            })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.userId, user.id));

          return {
            ...user,
            roles: assignedRoles,
          };
        })
      );

      return usersWithRoles;
    }),

  /**
   * Assign a role to a user (supports multiple roles per user)
   * Protected: USERS_MANAGE permission
   * Idempotent: assigning the same role twice returns success
   */
  assignRole: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify current user is admin in the target tenant
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId, id: users.id })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot assign roles in other tenants",
        });
      }

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
        .where(eq(roles.id, input.roleId) && eq(roles.tenantId, input.tenantId))
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

      // Try to insert the role assignment
      // If it already exists (unique constraint), the database will reject it
      try {
        await ctx.db.insert(userRoles).values({
          userId: input.userId,
          roleId: input.roleId,
          assignedBy: currentUser!.id,
        });
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
  removeUserRole: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        roleId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify current user is admin in the target tenant
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot manage roles in other tenants",
        });
      }

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

      return { success: true, message: "Role removed" };
    }),

  /**
   * Get all roles for a tenant
   * Protected: USERS_MANAGE permission
   */
  listRoles: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot list roles from other tenants",
        });
      }

      const allRoles = await ctx.db
        .select()
        .from(roles)
        .where(eq(roles.tenantId, input.tenantId))
        .orderBy(roles.name);

      // For each role, fetch its permissions
      const rolesWithPerms = await Promise.all(
        allRoles.map(async (role) => {
          const perms = await ctx.db
            .select({ permission: rolePermissions.permission })
            .from(rolePermissions)
            .where(eq(rolePermissions.roleId, role.id));

          return {
            ...role,
            permissions: perms.map((p) => p.permission),
          };
        })
      );

      return rolesWithPerms;
    }),

  /**
   * Add a permission to a role
   * Protected: USERS_MANAGE permission
   * Idempotent: Adding same permission twice is safe
   */
  addPermissionToRole: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        roleId: z.string().uuid(),
        permission: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify current user is in this tenant
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot manage roles in other tenants",
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
        .where(eq(roles.id, input.roleId) && eq(roles.tenantId, input.tenantId))
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
      } catch (error: unknown) {
        const code =
          error && typeof error === "object" && "code" in error
            ? (error as { code?: string }).code
            : undefined;
        // Ignore duplicate key errors (permission already assigned)
        if (code !== "23505") {
          throw error;
        }
      }

      return { success: true };
    }),

  /**
   * Remove a permission from a role
   * Protected: USERS_MANAGE permission
   */
  removePermissionFromRole: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        roleId: z.string().uuid(),
        permission: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify current user is in this tenant
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);

      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot manage roles in other tenants",
        });
      }

      // Verify role exists in this tenant
      const [roleExists] = await ctx.db
        .select({ id: roles.id, code: roles.code, isSystem: roles.isSystem })
        .from(roles)
        .where(eq(roles.id, input.roleId) && eq(roles.tenantId, input.tenantId))
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

      // Self-lockout guard: current tenant admin must not remove their own last grant
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

      await ctx.db
        .delete(rolePermissions)
        .where(
          eq(rolePermissions.roleId, input.roleId) &&
          eq(rolePermissions.permission, input.permission)
        );

      return { success: true };
    }),

  listInvitations: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);
      if (currentUser?.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot list invitations from other tenants" });
      }

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

  createInvitation: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(
      z.object({
        tenantId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(["admin", "vet", "reception"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId, email: users.email })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);
      if (!currentUser || currentUser.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot invite users for other tenants" });
      }

      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      const invite = await createInvite({
        tenantId: input.tenantId,
        invitedByUserId: currentUser.id,
        email: input.email,
        role: input.role,
      });

      const acceptUrl = `${getMainDomain()}/invite/accept?token=${invite.token}`;
      const emailResult = await sendUserInvitationEmail({
        to: invite.email,
        practiceName: tenant.name,
        role: input.role,
        acceptUrl,
        expiresAt: invite.expiresAt.toLocaleString("de-DE"),
      });

      if (!emailResult.success) {
        const serialized = serializeLogError(emailResult.error);
        logEventAsync({
          level: "error",
          category: "email",
          eventType: "user_invitation_email_failed",
          message: "Invitation created but email delivery failed",
          tenantId: input.tenantId,
          userId: currentUser.id,
          metadata: {
            operation: "create_invitation",
            recipient: invite.email,
            invitationId: invite.invitationId,
            ...serialized,
          },
        });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "create",
        entity: { type: "user_invitation", id: invite.invitationId },
        event: "user.invitation_created",
        summary: "User invitation created",
        changes: { email: invite.email, role: input.role, expiresAt: invite.expiresAt.toISOString() },
      });

      return { success: true, invitationId: invite.invitationId, emailSent: emailResult.success };
    }),

  resendInvitation: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);
      if (!currentUser || currentUser.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot resend invitations for other tenants" });
      }
      const [tenant] = await ctx.db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, input.tenantId))
        .limit(1);
      if (!tenant) throw new TRPCError({ code: "NOT_FOUND", message: "Tenant not found" });

      const resent = await resendInvite({
        tenantId: input.tenantId,
        invitationId: input.invitationId,
        invitedByUserId: currentUser.id,
      });

      const acceptUrl = `${getMainDomain()}/invite/accept?token=${resent.token}`;
      const emailResult = await sendUserInvitationEmail({
        to: resent.invitation.email,
        practiceName: tenant.name,
        role: resent.invitation.role,
        acceptUrl,
        expiresAt: resent.expiresAt.toLocaleString("de-DE"),
      });

      if (!emailResult.success) {
        const serialized = serializeLogError(emailResult.error);
        logEventAsync({
          level: "error",
          category: "email",
          eventType: "user_invitation_email_failed",
          message: "Invitation resent but email delivery failed",
          tenantId: input.tenantId,
          userId: currentUser.id,
          metadata: {
            operation: "resend_invitation",
            recipient: resent.invitation.email,
            invitationId: resent.invitation.id,
            ...serialized,
          },
        });
      }

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "user_invitation", id: resent.invitation.id },
        event: "user.invitation_resent",
        summary: "User invitation resent",
        changes: { expiresAt: resent.expiresAt.toISOString() },
      });

      return { success: true, emailSent: emailResult.success };
    }),

  revokeInvitation: protectedProcedure
    .use(requirePermission(PERMISSIONS.USERS_MANAGE))
    .input(z.object({ tenantId: z.string().uuid(), invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [currentUser] = await ctx.db
        .select({ id: users.id, tenantId: users.tenantId })
        .from(users)
        .where(eq(users.clerkId, ctx.userId!))
        .limit(1);
      if (!currentUser || currentUser.tenantId !== input.tenantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Cannot revoke invitations for other tenants" });
      }

      const invitation = await revokeInvite({ tenantId: input.tenantId, invitationId: input.invitationId });

      await writeAuditLog(ctx, {
        tenantId: input.tenantId,
        action: "update",
        entity: { type: "user_invitation", id: invitation.id },
        event: "user.invitation_revoked",
        summary: "User invitation revoked",
        changes: { email: invitation.email },
      });

      return { success: true };
    }),

  acceptInvitation: protectedProcedure
    .input(z.object({ token: z.string().min(20) }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      const accepted = await acceptInvite({ token: input.token, clerkUserId: ctx.userId });

      await writeAuditLog(ctx, {
        tenantId: accepted.tenantId,
        action: "update",
        entity: { type: "user_invitation", id: accepted.invitationId },
        event: "user.invitation_accepted",
        summary: "User invitation accepted",
        changes: { role: accepted.role, userId: accepted.userId },
      });

      return { success: true, tenantId: accepted.tenantId };
    }),
});
