/**
 * Super Admin Rate Limiting & Security Monitoring
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Guards against brute-force access to SA-only routes.
 *
 * Policy:
 *  • > 5 failed SA attempts from same IP within 60 s → temporary block
 *  • Every failed attempt is logged to audit_logs
 *  • Every blocked request returns 429 with Retry-After header
 */

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const WINDOW_MS  = 60_000;   // 60 second sliding window
const MAX_FAILS  = 5;        // max failures before block
const BLOCK_MS   = 300_000;  // 5 min block

interface Bucket {
  count:   number;
  firstAt: number;
  blocked: boolean;
  blockedAt?: number;
}

/* In-process store — acceptable since SA routes are low-volume.
   A Redis store can be swapped in here for multi-process deployments. */
const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  const now = Date.now();
  let b = buckets.get(key);

  if (!b) {
    b = { count: 0, firstAt: now, blocked: false };
    buckets.set(key, b);
    return b;
  }

  // Unblock after BLOCK_MS
  if (b.blocked && b.blockedAt && now - b.blockedAt > BLOCK_MS) {
    b = { count: 0, firstAt: now, blocked: false };
    buckets.set(key, b);
    return b;
  }

  // Reset window
  if (!b.blocked && now - b.firstAt > WINDOW_MS) {
    b.count   = 0;
    b.firstAt = now;
  }

  return b;
}

function recordFail(key: string): boolean {
  const b = getBucket(key);
  if (b.blocked) return true;
  b.count++;
  if (b.count > MAX_FAILS) {
    b.blocked   = true;
    b.blockedAt = Date.now();
    return true;
  }
  return false;
}

function resetOnSuccess(key: string) {
  buckets.delete(key);
}

/* Attempt to write an audit log entry — non-blocking, never throws */
async function logSaFailure(
  ip: string,
  userId: string | null,
  path: string,
  reason: "unauthorized" | "blocked"
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO audit_logs (user_id, user_full_name, action, resource, resource_id, details)
      VALUES (
        ${userId ?? "anonymous"},
        ${userId ? "Unknown" : "Anonymous"},
        'SA_ACCESS_DENIED',
        'super_admin_route',
        ${path},
        ${JSON.stringify({ ip, reason, path, timestamp: new Date().toISOString() })}::jsonb
      )
    `);
  } catch {
    /* silent — audit log failure must not block the 403/429 response */
  }
}

/**
 * saRateLimit — Express middleware to be placed BEFORE requireSuperAdmin.
 *
 * On a 403 from requireSuperAdmin, call `req.recordSaFail()` to increment
 * the counter. This middleware exposes that helper on req.
 *
 * Usage:
 *   router.get("/admin/...", saRateLimit, requireSuperAdmin, handler)
 */
export function saRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip     = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
              ?? req.socket?.remoteAddress
              ?? "unknown";
  const { userId } = getAuth(req);
  const key    = `sa:${ip}`;

  const b = getBucket(key);

  if (b.blocked) {
    logSaFailure(ip, userId ?? null, req.path, "blocked");
    const retryAfter = Math.ceil(
      (BLOCK_MS - (Date.now() - (b.blockedAt ?? Date.now()))) / 1000
    );
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({
      error: "عدد كبير من محاولات الوصول المرفوضة. حاول مجدداً لاحقاً.",
      retryAfterSeconds: retryAfter,
    });
    return;
  }

  /* Attach helpers so downstream requireSuperAdmin can call them */
  (req as any)._saIp  = ip;
  (req as any)._saKey = key;
  (req as any).recordSaFail = () => {
    const blocked = recordFail(key);
    logSaFailure(ip, userId ?? null, req.path, "unauthorized");
    if (blocked) {
      console.warn(
        `[SA-RATELIMIT] IP ${ip} blocked after ${MAX_FAILS}+ failed SA attempts on ${req.path}`
      );
    }
  };
  (req as any).recordSaSuccess = () => resetOnSuccess(key);

  next();
}

/**
 * Quick-access metrics for the Engineering/Developer center.
 */
export function getSaRateLimitStats(): {
  totalBuckets: number;
  blockedIps: string[];
  topOffenders: { key: string; count: number }[];
} {
  const blocked: string[] = [];
  const offenders: { key: string; count: number }[] = [];

  for (const [key, b] of buckets) {
    if (b.blocked) blocked.push(key.replace("sa:", ""));
    if (b.count >= 3) offenders.push({ key: key.replace("sa:", ""), count: b.count });
  }

  offenders.sort((a, b) => b.count - a.count);

  return {
    totalBuckets: buckets.size,
    blockedIps: blocked,
    topOffenders: offenders.slice(0, 10),
  };
}
