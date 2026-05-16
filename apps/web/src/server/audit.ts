/**
 * Immutable audit log writer — DSGVO compliance layer.
 *
 * Every mutation that touches patient data, permissions, or configuration must
 * call `writeAuditLog`. Audit records are append-only (no update/delete on the
 * `auditLogs` table) and include the actor's IP address and user agent so that
 * access can be reconstructed for regulatory requests.
 *
 * The `changes` JSONB column follows `AUDIT_SCHEMA_VERSION` and contains:
 *   - schemaVersion  — bumped when the shape of `changes` changes
 *   - event          — dot-namespaced event name (e.g. "diagnosis.created")
 *   - actor          — { clerkUserId, userId } of the authenticated user
 *   - target         — { entityType, entityId } of the mutated record
 *   - diff           — caller-supplied field-level changes (values, not SQL)
 *   - occurredAt     — ISO 8601 timestamp at write time
 */

import type { TRPCContext } from "./trpc";
import { auditLogs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/** Increment when the shape of the `changes` JSONB column changes. */
export const AUDIT_SCHEMA_VERSION = "1.0.0";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "export"
  | "access"
  | "config_change"
  | "permission_change";

interface AuditInput {
  tenantId: string;
  action: AuditAction;
  entity: {
    type: string;
    id: string;
  };
  /** Dot-namespaced event name, e.g. "diagnosis.created" */
  event: string;
  summary?: string;
  /** Field-level changes to record in the diff — values, not SQL expressions */
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(
  ctx: TRPCContext & { dbUserId?: string },
  input: AuditInput,
) {
  // dbUserId is injected by enforceTenantIsActive; fall back to a DB lookup
  // only for contexts that haven't gone through the tenant middleware (rare).
  let userId: string | null = ctx.dbUserId ?? null;

  if (!userId && ctx.userId) {
    const [user] = await ctx.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, ctx.userId))
      .limit(1);
    userId = user?.id ?? null;
  }

  await ctx.db.insert(auditLogs).values({
    tenantId: input.tenantId,
    userId,
    action: input.action,
    entityType: input.entity.type,
    entityId: input.entity.id,
    changes: {
      schemaVersion: AUDIT_SCHEMA_VERSION,
      event: input.event,
      summary: input.summary ?? null,
      actor: {
        clerkUserId: ctx.userId ?? null,
        userId,
      },
      target: {
        entityType: input.entity.type,
        entityId: input.entity.id,
      },
      diff: input.changes ?? {},
      metadata: input.metadata ?? {},
      occurredAt: new Date().toISOString(),
    },
    ipAddress: ctx.headers.get("x-forwarded-for") ?? null,
    userAgent: ctx.headers.get("user-agent") ?? null,
  });
}
