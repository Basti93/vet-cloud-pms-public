import type { AuditAction } from "@/server/audit";
import { writeAuditLog } from "@/server/audit";
import { protectedProcedure, tenantProcedure } from "@/server/trpc";

export interface AuditConfig {
  entity: string;
  event: string | ((result: unknown, input: unknown) => string);
  action: AuditAction;
  summary?: string | ((result: unknown, input: unknown) => string);
  tenantId?: (result: unknown, input: unknown) => string;
  entityId: (result: unknown, input: unknown) => string;
  changes?: (result: unknown, input: unknown) => Record<string, unknown>;
  metadata?: (result: unknown, input: unknown) => Record<string, unknown>;
}

export function auditedMutation(config: AuditConfig) {
  return tenantProcedure.use(async ({ ctx, getRawInput, next }) => {
    const input = await getRawInput();
    const result = await next();

    if (!result.ok) {
      return result;
    }

    const tenantId = config.tenantId?.(result.data, input) ?? (ctx as { tenantId: string }).tenantId;
    const entityId = config.entityId(result.data, input);
    const event =
      typeof config.event === "function" ? config.event(result.data, input) : config.event;
    const summary =
      typeof config.summary === "function" ? config.summary(result.data, input) : config.summary;

    await writeAuditLog(ctx, {
      tenantId,
      action: config.action,
      entity: { type: config.entity, id: entityId },
      event,
      summary,
      changes: config.changes?.(result.data, input),
      metadata: config.metadata?.(result.data, input),
    });

    return result;
  });
}

export function auditedProtectedMutation(config: AuditConfig) {
  return protectedProcedure.use(async ({ ctx, getRawInput, next }) => {
    const input = await getRawInput();
    const result = await next();

    if (!result.ok) {
      return result;
    }

    const tenantId = config.tenantId?.(result.data, input) ?? (ctx as { tenantId: string }).tenantId;
    const entityId = config.entityId(result.data, input);
    const event =
      typeof config.event === "function" ? config.event(result.data, input) : config.event;
    const summary =
      typeof config.summary === "function" ? config.summary(result.data, input) : config.summary;

    await writeAuditLog(ctx, {
      tenantId,
      action: config.action,
      entity: { type: config.entity, id: entityId },
      event,
      summary,
      changes: config.changes?.(result.data, input),
      metadata: config.metadata?.(result.data, input),
    });

    return result;
  });
}
