/**
 * In-memory request performance metrics.
 *
 * DESIGN:
 * - Zero DB overhead: all metrics stay in memory, never written to DB per request
 * - Rolling buffer: capped at MAX_GLOBAL_ENTRIES total, MAX_PATH_ENTRIES per path
 * - Percentile calculation: on-demand from sorted per-path duration arrays
 * - Slow request tracking: keeps last SLOW_ENTRIES requests above SLOW_THRESHOLD_MS
 * - Resets on server restart (by design — no persistence needed for live monitoring)
 *
 * THREAD SAFETY:
 * - Node.js is single-threaded; all operations are atomic
 */

const MAX_GLOBAL_ENTRIES = 500;
const MAX_PATH_ENTRIES = 200;
const SLOW_THRESHOLD_MS = 200;
const SLOW_ENTRIES = 20;

const requestsByPath = new Map<string, number[]>();
const globalBuffer: Array<{ path: string; durationMs: number; ts: number }> = [];
const slowBuffer: Array<{ path: string; durationMs: number; ts: number }> = [];
let totalRequests = 0;
const startedAt = new Date();

export interface PathMetrics {
  path: string;
  count: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export interface RequestMetricsSnapshot {
  startedAt: Date;
  totalRequests: number;
  overallAvgMs: number;
  byPath: PathMetrics[];
  slowestRecent: Array<{ path: string; durationMs: number; ts: Date }>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    Math.floor((p / 100) * sorted.length),
    sorted.length - 1
  );
  return Math.round(sorted[idx]);
}

/**
 * Record a single request into the in-memory rolling buffer.
 * Called from tRPC systemLoggingMiddleware after every request.
 */
export function recordRequest(path: string, durationMs: number): void {
  totalRequests++;

  // Update global rolling buffer
  globalBuffer.push({ path, durationMs, ts: Date.now() });
  if (globalBuffer.length > MAX_GLOBAL_ENTRIES) {
    globalBuffer.shift();
  }

  // Update per-path buffer
  const pathDurations = requestsByPath.get(path) ?? [];
  pathDurations.push(durationMs);
  if (pathDurations.length > MAX_PATH_ENTRIES) {
    pathDurations.shift();
  }
  requestsByPath.set(path, pathDurations);

  // Track slow requests
  if (durationMs >= SLOW_THRESHOLD_MS) {
    slowBuffer.push({ path, durationMs, ts: Date.now() });
    if (slowBuffer.length > SLOW_ENTRIES) {
      slowBuffer.shift();
    }
  }
}

/**
 * Compute and return a snapshot of current performance metrics.
 * Called on-demand by the admin tRPC endpoint.
 */
export function getRequestMetrics(): RequestMetricsSnapshot {
  const byPath: PathMetrics[] = [];
  let totalDurationSum = 0;
  let totalCount = 0;

  for (const [path, durations] of requestsByPath.entries()) {
    if (durations.length === 0) continue;

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, d) => acc + d, 0);
    const avg = Math.round(sum / sorted.length);

    totalDurationSum += sum;
    totalCount += sorted.length;

    byPath.push({
      path,
      count: sorted.length,
      avgMs: avg,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
      p99Ms: percentile(sorted, 99),
    });
  }

  // Sort by p95 descending (slowest first)
  byPath.sort((a, b) => b.p95Ms - a.p95Ms);

  return {
    startedAt,
    totalRequests,
    overallAvgMs: totalCount > 0 ? Math.round(totalDurationSum / totalCount) : 0,
    byPath,
    slowestRecent: [...slowBuffer]
      .reverse()
      .map((e) => ({ path: e.path, durationMs: e.durationMs, ts: new Date(e.ts) })),
  };
}

/**
 * Reset all metrics (useful for testing).
 */
export function resetRequestMetrics(): void {
  requestsByPath.clear();
  globalBuffer.length = 0;
  slowBuffer.length = 0;
  totalRequests = 0;
}
