import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, tenants } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";

// Helper function to generate a unique slug
async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = baseName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  if (!slug) slug = "temp-user";

  let finalSlug = slug;
  let counter = 1;
  while (true) {
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, finalSlug))
      .limit(1);

    if (!existing.length) break;
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

export async function POST(req: Request) {
  // Get the Svix headers for verification
  const headersList = await headers();
  const svixId = headersList.get("svix-id");
  const svixTimestamp = headersList.get("svix-timestamp");
  const svixSignature = headersList.get("svix-signature");

  // If any headers are missing, error out
  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Missing svix headers");
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  // Get the body
  const body = await req.text();

  // Create a new Webhook instance with your secret
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || "");
  let evt: { type: string; data: unknown };

  // Verify the webhook
  try {
    evt = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as { type: string; data: unknown };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown verification error";
    console.error("Webhook verification failed:", message);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Handle the user.created event
  if (evt.type === "user.created") {
    try {
      const clerkUser = evt.data as {
        id: string;
        email?: string;
        email_addresses?: Array<{ email_address?: string }>;
        first_name?: string;
        last_name?: string;
      };
      const clerkId = clerkUser.id;
      const email =
        clerkUser.email_addresses?.[0]?.email_address || clerkUser.email;
      const firstName = clerkUser.first_name || "";
      const lastName = clerkUser.last_name || "";

      if (!email) {
        console.error("User created event missing email");
        return NextResponse.json(
          { error: "User email required" },
          { status: 400 }
        );
      }

      // Check if user already exists (idempotency)
      const existingUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.clerkId, clerkId))
        .limit(1);

      if (existingUser.length > 0) {
        console.log(`User already exists: ${clerkId} (${email})`);
        return NextResponse.json({ success: true, alreadyExists: true });
      }

      // Create a temporary tenant for this user (they'll create their practice tenant on onboarding)
      const tempTenantId = randomUUID();
      const placeholderName = `${firstName || "User"} ${lastName || "Placeholder"}`;
      const uniqueSlug = await generateUniqueSlug(`temp-${placeholderName}`);

      // Create the user record in the database
      // Note: tenantId will be set by the onboarding flow when they create their practice
      // For now, we create a placeholder tenant so the user record can be created
      const [tempTenant] = await db
        .insert(tenants)
        .values({
          id: tempTenantId,
          name: `Placeholder for ${firstName || "User"}`,
          slug: uniqueSlug,
          email,
          country: "DE",
          timezone: "Europe/Berlin",
          subscriptionStatus: "trial",
          subscriptionPlan: "starter",
        })
        .returning();

      await db.insert(users).values({
        id: randomUUID(),
        tenantId: tempTenant.id,
        clerkId,
        email,
        firstName,
        lastName,
        active: true,
      });

      console.log(`User created: ${clerkId} (${email})`);
      return NextResponse.json({ success: true });
    } catch (error: unknown) {
      const errObj =
        error && typeof error === "object"
          ? (error as { message?: string; code?: string; detail?: string; stack?: string })
          : {};
      console.error("Error handling user.created webhook:", {
        message: errObj.message,
        code: errObj.code,
        detail: errObj.detail,
        stack: errObj.stack,
        fullError: JSON.stringify(error, null, 2)
      });
      return NextResponse.json(
        { error: "Internal server error", details: errObj.message },
        { status: 500 }
      );
    }
  }

  // For other event types, just acknowledge them
  console.log(`Received webhook event: ${evt.type}`);
  return NextResponse.json({ success: true });
}
