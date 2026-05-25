import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { adminDb as db } from "@/lib/db/client";
import { users, tenants, userInvitations } from "@/lib/db/schema";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { TRIAL_DAYS } from "@/lib/stripe/prices";

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

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Create a new Webhook instance with your secret
  const wh = new Webhook(webhookSecret);
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

      // Check for a pending invitation for this email.
      // Invited users must NOT get their own placeholder tenant — they belong
      // to the practice that invited them.  acceptInvite() will assign the
      // correct role and (idempotently) set tenantId after sign-up.
      const normalizedEmail = email.trim().toLowerCase();
      const [pendingInvite] = await db
        .select({ tenantId: userInvitations.tenantId })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.email, normalizedEmail),
            eq(userInvitations.status, "pending")
          )
        )
        .limit(1);

      let assignedTenantId: string;

      if (pendingInvite) {
        // Invited user — use the destination tenant directly, no placeholder needed.
        assignedTenantId = pendingInvite.tenantId;
        console.log(`Invited user ${clerkId} (${email}) assigned to tenant ${assignedTenantId}`);
      } else {
        // Organic signup — create a temporary placeholder tenant.
        // The onboarding flow will replace this with the real practice tenant.
        const placeholderName = `${firstName || "User"} ${lastName || "Placeholder"}`;
        const uniqueSlug = await generateUniqueSlug(`temp-${placeholderName}`);

        const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        const [tempTenant] = await db
          .insert(tenants)
          .values({
            id: randomUUID(),
            name: `Placeholder for ${firstName || "User"}`,
            slug: uniqueSlug,
            email,
            country: "DE",
            timezone: "Europe/Berlin",
            subscriptionStatus: "trial",
            subscriptionPlan: "solo",
            trialEndsAt,
            originalTrialEndsAt: trialEndsAt,
          })
          .returning();

        assignedTenantId = tempTenant.id;
        console.log(`Organic signup ${clerkId} (${email}) — placeholder tenant ${assignedTenantId} created`);
      }

      await db.insert(users).values({
        id: randomUUID(),
        tenantId: assignedTenantId,
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
