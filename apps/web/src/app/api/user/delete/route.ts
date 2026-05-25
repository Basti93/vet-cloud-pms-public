import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { rm } from "fs/promises";
import path from "path";
import { adminDb as db } from "@/lib/db/client";
import {
  users,
  tenants,
  auditLogs,
  appointments,
  patients,
  owners,
  voiceCalls,
  diagnoses,
  medications,
  vitals,
  vetSchedules,
  vetAbsences,
  userRoles,
  roles,
  emailSettings,
  appointmentHolds,
  appointmentEmailLogs,
  calendarAccessTokens,
  calendarAccessAudit,
  websiteAssets,
  websiteProjects,
} from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * DELETE /api/user/delete
 *
 * DSGVO Art. 17 - Right to Erasure
 * Deletes the user's account and all associated tenant data.
 *
 * This is a destructive operation. It:
 * 1. Soft-deletes the tenant (sets deletedAt timestamp)
 * 2. Deletes all associated data (cascade)
 * 3. Removes all users from Clerk
 * 4. Logs the action to auditLogs
 *
 * Authentication: Required (Clerk)
 * Request body: { confirmDelete: true } (safety confirmation)
 * Response: { success: true, message: "Account and data deleted" }
 */
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    let body: { confirmDelete?: boolean } = {};
    try {
      body = await request.json();
    } catch {
      // No body is okay
    }

    // Require explicit confirmation
    if (body.confirmDelete !== true) {
      return NextResponse.json(
        { error: "Account deletion must be confirmed with { confirmDelete: true }" },
        { status: 400 }
      );
    }

    // Get current user and their tenant
    const [currentUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const tenantId = currentUser.tenantId;

    // Get all users in the tenant to delete from Clerk
    const tenantUsers = await db
      .select({ clerkId: users.clerkId })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Log the deletion before we start
    const logId = await db
      .insert(auditLogs)
      .values({
        tenantId: tenantId,
        userId: currentUser.id,
        action: "delete",
        entityType: "tenant",
        entityId: tenantId,
        changes: {
          schemaVersion: "1.0.0",
          event: "tenant.deletion_requested",
          summary: "DSGVO Art. 17 erasure request",
          actor: {
            clerkUserId: userId,
            userId: currentUser.id,
          },
          target: {
            entityType: "tenant",
            entityId: tenantId,
          },
          diff: {
            legalBasis: "DSGVO_Art_17",
          },
          metadata: {},
          occurredAt: new Date().toISOString(),
        },
      })
      .returning({ id: auditLogs.id })
      .then((result) => result[0]?.id);

    // Delete website asset files from disk before DB cascade removes the rows
    const tenantProjects = await db
      .select({ id: websiteProjects.id })
      .from(websiteProjects)
      .where(eq(websiteProjects.ownerTenantId, tenantId));
    if (tenantProjects.length > 0) {
      const projectIds = tenantProjects.map((p) => p.id);
      const assets = await db
        .select({ storageKey: websiteAssets.storageKey })
        .from(websiteAssets)
        .where(inArray(websiteAssets.websiteProjectId, projectIds));
      const publicBase = process.env.ASSET_PUBLIC_DIR ?? path.join(process.cwd(), "public");
      await Promise.allSettled(
        assets
          .filter((a) => a.storageKey.startsWith("local:"))
          .map((a) => {
            const rel = a.storageKey.slice("local:".length);
            return rm(path.join(publicBase, "tenant-assets", "website-projects", rel), { force: true });
          })
      );
    }

    // Delete data in order of foreign key constraints
    // Start with dependent tables first

    // 1. Delete vitals
    await db.delete(vitals).where(eq(vitals.tenantId, tenantId));

    // 2. Delete medications
    await db.delete(medications).where(eq(medications.tenantId, tenantId));

    // 3. Delete diagnoses
    await db.delete(diagnoses).where(eq(diagnoses.tenantId, tenantId));

    // 4. Delete voice calls
    await db.delete(voiceCalls).where(eq(voiceCalls.tenantId, tenantId));

    // 5. Delete appointment email logs
    await db
      .delete(appointmentEmailLogs)
      .where(eq(appointmentEmailLogs.tenantId, tenantId));

    // 6. Delete calendar access audit
    await db
      .delete(calendarAccessAudit)
      .where(eq(calendarAccessAudit.tenantId, tenantId));

    // 7. Delete calendar access tokens
    await db
      .delete(calendarAccessTokens)
      .where(eq(calendarAccessTokens.tenantId, tenantId));

    // 8. Delete appointment holds
    await db
      .delete(appointmentHolds)
      .where(eq(appointmentHolds.tenantId, tenantId));

    // 9. Delete appointments
    await db.delete(appointments).where(eq(appointments.tenantId, tenantId));

    // 10. Delete patients
    await db.delete(patients).where(eq(patients.tenantId, tenantId));

    // 11. Delete owners
    await db.delete(owners).where(eq(owners.tenantId, tenantId));

    // 12. Delete vet absences
    await db
      .delete(vetAbsences)
      .where(eq(vetAbsences.tenantId, tenantId));

    // 13. Delete vet schedules
    await db
      .delete(vetSchedules)
      .where(eq(vetSchedules.tenantId, tenantId));

    // 14. Delete email settings
    await db
      .delete(emailSettings)
      .where(eq(emailSettings.tenantId, tenantId));

    // 15. Delete user roles
    await db.delete(userRoles).where(eq(userRoles.userId, currentUser.id));

    // 16. Delete users
    await db.delete(users).where(eq(users.tenantId, tenantId));

    // 17. Delete roles (if they exist)
    await db.delete(roles).where(eq(roles.tenantId, tenantId));

    // 18. Delete tenant
    await db.delete(tenants).where(eq(tenants.id, tenantId));

    // 19. Delete the audit log entry itself (to be complete with erasure)
    if (logId) {
      await db.delete(auditLogs).where(eq(auditLogs.id, logId));
    }

    // Remove all users from Clerk
    const clerk = await clerkClient();
    for (const user of tenantUsers) {
      try {
        await clerk.users.deleteUser(user.clerkId);
      } catch (error) {
        console.error(`Failed to delete Clerk user ${user.clerkId}:`, error);
        // Don't fail the entire deletion, just log the error
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account and all associated data have been permanently deleted",
        deletedUsersCount: tenantUsers.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user account:", error);
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
