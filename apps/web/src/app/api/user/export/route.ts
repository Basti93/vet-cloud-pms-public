import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { adminDb as db } from "@/lib/db/client";
import {
  users,
  tenants,
  userRoles,
  owners,
  patients,
  appointments,
  voiceCalls,
  diagnoses,
  medications,
  vitals,
  vetSchedules,
  emailSettings,
  appointmentHolds,
  roles,
  rolePermissions,
  auditLogs,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/db/schema";

/**
 * GET /api/user/export
 *
 * DSGVO Art. 20 - Right to Data Portability
 * Returns all data belonging to the authenticated user's tenant as JSON.
 *
 * Authentication: Required (Clerk)
 * Response: JSON file with all tenant data
 */
export async function GET(_request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
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

    const canManageSettings = await hasPermission(
      userId,
      PERMISSIONS.SETTINGS_MANAGE
    );
    if (!canManageSettings) {
      return NextResponse.json(
        { error: "Forbidden: settings_manage permission required" },
        { status: 403 }
      );
    }

    const tenantId = currentUser.tenantId;

    // Fetch all tenant data
    const tenantData = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const userData = await db
      .select()
      .from(users)
      .where(eq(users.tenantId, tenantId));

    const userRolesData = await db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, currentUser.id));

    const rolesData = await db
      .select()
      .from(roles)
      .where(eq(roles.tenantId, tenantId));

    const rolePermissionsData = await db
      .select()
      .from(rolePermissions)
      .where(
        eq(
          rolePermissions.roleId,
          rolesData.length > 0 ? rolesData[0].id : ""
        )
      );

    const ownerData = await db
      .select()
      .from(owners)
      .where(eq(owners.tenantId, tenantId));

    const patientData = await db
      .select()
      .from(patients)
      .where(eq(patients.tenantId, tenantId));

    const appointmentData = await db
      .select()
      .from(appointments)
      .where(eq(appointments.tenantId, tenantId));

    const voiceCallData = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.tenantId, tenantId));

    const diagnosisData = await db
      .select()
      .from(diagnoses)
      .where(eq(diagnoses.tenantId, tenantId));

    const medicationData = await db
      .select()
      .from(medications)
      .where(eq(medications.tenantId, tenantId));

    const vitalData = await db
      .select()
      .from(vitals)
      .where(eq(vitals.tenantId, tenantId));

    const vetScheduleData = await db
      .select()
      .from(vetSchedules)
      .where(eq(vetSchedules.tenantId, tenantId));

    const emailSettingsData = await db
      .select()
      .from(emailSettings)
      .where(eq(emailSettings.tenantId, tenantId));

    const appointmentHoldsData = await db
      .select()
      .from(appointmentHolds)
      .where(eq(appointmentHolds.tenantId, tenantId));

    // Compile all data
    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: userId,
      tenantId: tenantId,
      data: {
        tenants: tenantData,
        users: userData,
        userRoles: userRolesData,
        roles: rolesData,
        rolePermissions: rolePermissionsData,
        owners: ownerData,
        patients: patientData,
        appointments: appointmentData,
        voiceCalls: voiceCallData,
        diagnoses: diagnosisData,
        medications: medicationData,
        vitals: vitalData,
        vetSchedules: vetScheduleData,
        emailSettings: emailSettingsData,
        appointmentHolds: appointmentHoldsData,
      },
    };

    // Log the export for audit purposes
    await db.insert(auditLogs).values({
      tenantId: tenantId,
      userId: currentUser.id,
      action: "export",
      entityType: "tenant",
      entityId: tenantId,
      changes: {
        schemaVersion: "1.0.0",
        event: "tenant.data_exported",
        summary: "DSGVO Art. 20 data export",
        actor: {
          clerkUserId: userId,
          userId: currentUser.id,
        },
        target: {
          entityType: "tenant",
          entityId: tenantId,
        },
        diff: {
          legalBasis: "DSGVO_Art_20",
        },
        metadata: {
          exportScope: "full_tenant",
        },
        occurredAt: new Date().toISOString(),
      },
    });

    // Return as JSON file download
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="example-export-${new Date().toISOString().split("T")[0]}.json"`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error exporting user data:", error);
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    );
  }
}
