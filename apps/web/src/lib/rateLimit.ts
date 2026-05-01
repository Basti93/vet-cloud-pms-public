/**
 * Simple In-Memory Rate Limiting
 * For MVP: tracks requests per IP + Clerk User ID
 * For Production: move to Redis
 */

const requestLog = new Map<
  string,
  { count: number; resetAt: number }
>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 60 seconds
const MAX_REQUESTS = 100; // per window (default for authenticated/general endpoints)
const MAX_PUBLIC_BOOKING_REQUESTS = 20; // per window (strict limit for public booking endpoints)

export function checkRateLimit(
  identifier: string,
  isPublicBooking: boolean = false
): boolean {
  const now = Date.now();
  const maxRequests = isPublicBooking ? MAX_PUBLIC_BOOKING_REQUESTS : MAX_REQUESTS;
  const entry = requestLog.get(identifier);

  if (!entry || now > entry.resetAt) {
    // New window
    requestLog.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (entry.count < maxRequests) {
    entry.count++;
    return true;
  }

  // Rate limit exceeded
  return false;
}

export function getRateLimitInfo(identifier: string, isPublicBooking: boolean = false) {
  const entry = requestLog.get(identifier);
  const now = Date.now();
  const maxRequests = isPublicBooking ? MAX_PUBLIC_BOOKING_REQUESTS : MAX_REQUESTS;

  if (!entry || now > entry.resetAt) {
    return { remaining: maxRequests, resetAt: now + RATE_LIMIT_WINDOW };
  }

  return {
    remaining: Math.max(0, maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Cleanup: Remove old entries every 5 minutes
 * (prevents memory leak)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestLog.entries()) {
    if (now > entry.resetAt) {
      requestLog.delete(key);
    }
  }
}, 5 * 60 * 1000);
