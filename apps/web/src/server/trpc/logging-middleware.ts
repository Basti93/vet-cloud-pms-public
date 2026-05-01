import { db } from "@/lib/db/client";
import { systemLogs } from "@/lib/db/schema";
import { TRPCError } from "@trpc/server";

const SLOW_REQUEST_THRESHOLD_MS = 2000;

export interface LogEventParams {
  level: "debug" | "info" | "warn" | "error" | "critical";
  category?: string;
  eventType?: string;
  message: string;
  metadata?: Record<string, any>;
  errorStack?: string;
  tenantId?: string;
  userId?: string;
  ipAddress?: string;
  correlationId?: string;
}

/**
 * Fire-and-forget logging for non-critical events (info, debug, warn).
 * For critical events (error, critical), use await logEvent().
 */
export async function logEvent(params: LogEventParams): Promise<void> {
  try {
    await db.insert(systemLogs).values({
      level: params.level,
      category: params.category,
      eventType: params.eventType,
      message: params.message,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      errorStack: params.errorStack,
      tenantId: params.tenantId ? params.tenantId : null,
      userId: params.userId ? params.userId : null,
      ipAddress: params.ipAddress,
      correlationId: params.correlationId,
    });
  } catch (error) {
    // Silently fail to avoid breaking the main request
    // Log to console only for debugging
    console.error("Failed to log event:", error);
  }
}

/**
 * Fire-and-forget logging for non-critical events.
 * Returns immediately without waiting for DB write.
 */
export function logEventAsync(params: LogEventParams): void {
  // Fire and forget
  void logEvent(params);
}

/**
 * tRPC middleware that logs errors and slow requests.
 * Attach to your tRPC instance with: .use(loggingMiddleware)
 */
export const loggingMiddleware = async (opts: any) => {
  const startMs = Date.now();
  const path = opts.path;
  const type = opts.type; // "query" | "mutation" | "subscription"

  try {
    const result = await opts.next();
    const durationMs = Date.now() - startMs;

    // Log slow requests
    if (durationMs > SLOW_REQUEST_THRESHOLD_MS) {
      logEventAsync({
        level: "warn",
        category: "api",
        eventType: "slow_request",
        message: `Slow ${type} request: ${path}`,
        metadata: {
          path,
          type,
          durationMs,
        },
      });
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startMs;
    const isTRPCError = error instanceof TRPCError;
    const code = isTRPCError ? error.code : "INTERNAL_SERVER_ERROR";
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // Log errors immediately (await to ensure persistence)
    await logEvent({
      level: code === "UNAUTHORIZED" || code === "FORBIDDEN" ? "warn" : "error",
      category: "api",
      eventType: `request_failed_${code}`,
      message: `${type} request failed: ${path}`,
      metadata: {
        path,
        type,
        code,
        durationMs,
        errorMessage: message,
      },
      errorStack: stack,
    });

    throw error;
  }
};
