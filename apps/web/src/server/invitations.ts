import { randomBytes, createHash } from "crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { db } from "@/lib/db/client";
import { roles, userInvitations, userRoles, users } from "@/lib/db/schema";
import { INVITE_ROLE_TO_CODE } from "@/lib/auth/roles";

const INVITE_EXPIRY_DAYS = 7;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInviteToken() {
  return randomBytes(32).toString("hex");
}

function inviteExpiryDate() {
  return new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
}

export async function expirePastInvitations(tenantId: string) {
  await db
    .update(userInvitations)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(userInvitations.tenantId, tenantId),
        eq(userInvitations.status, "pending"),
        lt(userInvitations.expiresAt, new Date())
      )
    );
}

export async function createInvite(params: {
  tenantId: string;
  invitedByUserId: string;
  email: string;
  role: "admin" | "vet" | "reception";
}) {
  const email = normalizeEmail(params.email);
  await expirePastInvitations(params.tenantId);

  const [existingPending] = await db
    .select({ id: userInvitations.id })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.tenantId, params.tenantId),
        eq(userInvitations.email, email),
        eq(userInvitations.status, "pending")
      )
    )
    .limit(1);

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiryDate();

  if (existingPending) {
    await db
      .update(userInvitations)
      .set({
        role: params.role,
        tokenHash,
        expiresAt,
        invitedByUserId: params.invitedByUserId,
        updatedAt: new Date(),
      })
      .where(eq(userInvitations.id, existingPending.id));

    return { invitationId: existingPending.id, token, expiresAt, email, created: false };
  }

  const [created] = await db
    .insert(userInvitations)
    .values({
      tenantId: params.tenantId,
      invitedByUserId: params.invitedByUserId,
      email,
      role: params.role,
      status: "pending",
      tokenHash,
      expiresAt,
    })
    .returning({ id: userInvitations.id });

  return { invitationId: created.id, token, expiresAt, email, created: true };
}

export async function resendInvite(params: {
  tenantId: string;
  invitationId: string;
  invitedByUserId: string;
}) {
  const [invitation] = await db
    .select({
      id: userInvitations.id,
      email: userInvitations.email,
      role: userInvitations.role,
      status: userInvitations.status,
    })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.id, params.invitationId),
        eq(userInvitations.tenantId, params.tenantId)
      )
    )
    .limit(1);

  if (!invitation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
  }

  if (invitation.status !== "pending" && invitation.status !== "expired") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation cannot be resent" });
  }

  const token = createInviteToken();
  const tokenHash = hashInviteToken(token);
  const expiresAt = inviteExpiryDate();

  await db
    .update(userInvitations)
    .set({
      status: "pending",
      tokenHash,
      expiresAt,
      invitedByUserId: params.invitedByUserId,
      updatedAt: new Date(),
    })
    .where(eq(userInvitations.id, invitation.id));

  return { invitation, token, expiresAt };
}

export async function revokeInvite(params: { tenantId: string; invitationId: string }) {
  const [invitation] = await db
    .select({
      id: userInvitations.id,
      status: userInvitations.status,
      email: userInvitations.email,
    })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.id, params.invitationId),
        eq(userInvitations.tenantId, params.tenantId)
      )
    )
    .limit(1);

  if (!invitation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
  }
  if (invitation.status !== "pending" && invitation.status !== "expired") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation cannot be revoked" });
  }

  await db
    .update(userInvitations)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(eq(userInvitations.id, invitation.id));

  return invitation;
}

export async function acceptInvite(params: { token: string; clerkUserId: string }) {
  const tokenHash = hashInviteToken(params.token);
  const now = new Date();

  const [invitation] = await db
    .select({
      id: userInvitations.id,
      tenantId: userInvitations.tenantId,
      email: userInvitations.email,
      role: userInvitations.role,
      status: userInvitations.status,
      expiresAt: userInvitations.expiresAt,
    })
    .from(userInvitations)
    .where(eq(userInvitations.tokenHash, tokenHash))
    .limit(1);

  if (!invitation) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Invitation not found" });
  }

  if (invitation.status !== "pending") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation already used" });
  }

  if (invitation.expiresAt <= now) {
    await db
      .update(userInvitations)
      .set({ status: "expired", updatedAt: now })
      .where(eq(userInvitations.id, invitation.id));
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation expired" });
  }

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
    })
    .from(users)
    .where(eq(users.clerkId, params.clerkUserId))
    .limit(1);

  if (!user) {
    throw new TRPCError({ code: "NOT_FOUND", message: "User not found in database" });
  }

  if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Invitation email does not match signed-in account",
    });
  }

  const roleCode = INVITE_ROLE_TO_CODE[invitation.role];
  const [targetRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, invitation.tenantId), eq(roles.code, roleCode)))
    .limit(1);
  if (!targetRole) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Target role not found for tenant" });
  }

  await db.transaction(async (tx) => {
    const claimed = await tx
      .update(userInvitations)
      .set({
        status: "accepted",
        acceptedByUserId: user.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(userInvitations.id, invitation.id),
          eq(userInvitations.status, "pending"),
          gt(userInvitations.expiresAt, now)
        )
      )
      .returning({ id: userInvitations.id });

    if (claimed.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invitation already used or expired" });
    }

    await tx
      .update(users)
      .set({
        tenantId: invitation.tenantId,
        active: true,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    await tx.delete(userRoles).where(eq(userRoles.userId, user.id));

    await tx.insert(userRoles).values({
      userId: user.id,
      roleId: targetRole.id,
      assignedBy: null,
    });
  });

  return {
    invitationId: invitation.id,
    tenantId: invitation.tenantId,
    role: invitation.role,
    userId: user.id,
  };
}
