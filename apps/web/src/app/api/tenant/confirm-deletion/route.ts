import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { accountDeletionRequests, tenants, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";

/**
 * GET /api/tenant/confirm-deletion?token=xxxxx
 *
 * Confirms account deletion via email link (DSGVO Art. 17)
 * This is a public endpoint that processes the deletion token
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.redirect(
        new URL(
          `/deletion-confirmed?success=false&message=${encodeURIComponent("Deletion token is required")}`,
          request.url
        )
      );
    }

    // Find valid deletion request
    const [deletionRequest] = await db
      .select()
      .from(accountDeletionRequests)
      .where(eq(accountDeletionRequests.token, token))
      .limit(1);

    if (!deletionRequest) {
      return NextResponse.redirect(
        new URL(
          `/deletion-confirmed?success=false&message=${encodeURIComponent("Invalid or expired deletion token")}`,
          request.url
        )
      );
    }

    // Check if request is still pending
    if (deletionRequest.status !== "pending") {
      return NextResponse.redirect(
        new URL(
          `/deletion-confirmed?success=false&message=${encodeURIComponent("This deletion request has already been processed")}`,
          request.url
        )
      );
    }

    // Check if token has expired
    if (new Date() > deletionRequest.expiresAt) {
      return NextResponse.redirect(
        new URL(
          `/deletion-confirmed?success=false&message=${encodeURIComponent("Deletion token has expired")}`,
          request.url
        )
      );
    }

    // Mark request as confirmed
    await db
      .update(accountDeletionRequests)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(eq(accountDeletionRequests.id, deletionRequest.id));

    // Delete all Clerk users in the tenant
    const tenantUsers = await db
      .select({ clerkId: users.clerkId })
      .from(users)
      .where(eq(users.tenantId, deletionRequest.tenantId));

    const clerk = await clerkClient();
    for (const user of tenantUsers) {
      if (user.clerkId) {
        await clerk.users.deleteUser(user.clerkId).catch((e) => {
          console.error(`Failed to delete Clerk user ${user.clerkId}:`, e);
        });
      }
    }

    // Delete the tenant (cascade deletes all related data per schema)
    await db
      .delete(tenants)
      .where(eq(tenants.id, deletionRequest.tenantId));

    console.log(`✅ Tenant ${deletionRequest.tenantId} deleted successfully`);

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/deletion-confirmed?success=true&message=${encodeURIComponent("Ihr Konto wurde erfolgreich gelöscht.")}`,
        request.url
      )
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error processing deletion request";
    console.error("Deletion error:", error);

    // Redirect to error page
    return NextResponse.redirect(
      new URL(
        `/deletion-confirmed?success=false&message=${encodeURIComponent(message)}`,
        request.url
      )
    );
  }
}
