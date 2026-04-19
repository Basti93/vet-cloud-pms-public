import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST() {
  try {
    const demoTenantId = process.env.DEMO_TENANT_ID;
    if (!demoTenantId) {
      return Response.json(
        { error: "DEMO_TENANT_ID environment variable not set" },
        { status: 500 }
      );
    }

    const { userId } = await auth();

    if (!userId) {
      return Response.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get current user from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);

    if (!clerkUser) {
      return Response.json(
        { error: "User not found in Clerk" },
        { status: 404 }
      );
    }

    // Check if user exists in DB
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, userId))
      .limit(1);

    let user;

    if (existingUser) {
      // Update existing user to admin
      const [updated] = await db
        .update(users)
        .set({ role: "admin" })
        .where(eq(users.clerkId, userId))
        .returning();
      user = updated;
    } else {
      // Create new user as admin in demo tenant
      const [created] = await db
        .insert(users)
        .values({
          clerkId: userId,
          email: clerkUser.emailAddresses[0]?.emailAddress || "",
          firstName: clerkUser.firstName || "",
          lastName: clerkUser.lastName || "",
          tenantId: demoTenantId,
          role: "admin",
          active: true,
        })
        .returning();
      user = created;
    }

    return Response.json(
      {
        success: true,
        message: existingUser ? "User updated to admin" : "User created as admin",
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Setup first admin error:", error);
    return Response.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    );
  }
}
