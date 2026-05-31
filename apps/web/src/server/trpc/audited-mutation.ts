import type { AuditAction } from "@/server/audit";
/**
 * @internal Direct writeAuditLog import is intentional here — this file IS the
 * audit seam for tRPC routers. All router mutations should use the exported
 * wrappers rather than importing writeAuditLog directly.
 */
// eslint-disable-next-line no-restricted-imports
import { writeAuditLog } from "@/server/audit";
import { adminProcedure, protectedProcedure, tenantProcedure } from "@/server/trpc";

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

function resolveAuditFields(config: AuditConfig, result: { data: unknown }, input: unknown, ctxTenantId: string) {
  return {
    tenantId: config.tenantId?.(result.data, input) ?? ctxTenantId,
    entityId: config.entityId(result.data, input),
    event: typeof config.event === "function" ? config.event(result.data, input) : config.event,
    summary: typeof config.summary === "function" ? config.summary(result.data, input) : config.summary,
    changes: config.changes?.(result.data, input),
    metadata: config.metadata?.(result.data, input),
  };
}

export function auditedMutation(config: AuditConfig) {
  return tenantProcedure.use(async ({ ctx, getRawInput, next }) => {
    const input = await getRawInput();
    const result = await next();

    if (!result.ok) return result;

    const { tenantId, entityId, event, summary, changes, metadata } =
      resolveAuditFields(config, result, input, (ctx as { tenantId: string }).tenantId);

    await writeAuditLog(ctx, {
      tenantId,
      action: config.action,
      entity: { type: config.entity, id: entityId },
      event,
      summary,
      changes,
      metadata,
    });

    return result;
  });
}

export function auditedProtectedMutation(config: AuditConfig) {
  return protectedProcedure.use(async ({ ctx, getRawInput, next }) => {
    const input = await getRawInput();
    const result = await next();

    if (!result.ok) return result;

    const { tenantId, entityId, event, summary, changes, metadata } =
      resolveAuditFields(config, result, input, (ctx as { tenantId: string }).tenantId);

    await writeAuditLog(ctx, {
      tenantId,
      action: config.action,
      entity: { type: config.entity, id: entityId },
      event,
      summary,
      changes,
      metadata,
    });

    return result;
  });
}

export function auditedAdminMutation(config: AuditConfig) {
  return adminProcedure.use(async ({ ctx, getRawInput, next }) => {
    const input = await getRawInput();
    const result = await next();

    if (!result.ok) return result;

    const { tenantId, entityId, event, summary, changes, metadata } =
      resolveAuditFields(config, result, input, "");

    await writeAuditLog(ctx, {
      tenantId,
      action: config.action,
      entity: { type: config.entity, id: entityId },
      event,
      summary,
      changes,
      metadata,
    });

    return result;
  });
}
