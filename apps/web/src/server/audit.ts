import type { TRPCContext } from "./trpc";
import { auditLogs, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  event: string;
  summary?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(ctx: TRPCContext, input: AuditInput) {
  let userId: string | null = null;

  if (ctx.userId) {
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
