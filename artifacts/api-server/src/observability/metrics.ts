import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export interface SystemMetrics {
  timestamp: number;
  memory: { used: number; total: number; percent: number };
  uptime: number;
  errorRate: number;
  dbLatency: number;
  activeRequests: number;
  totalRequests: number;
  failedRequests: number;
  webhookFailures: number;
  stripeHealth: boolean;
  dbHealth: boolean;
  apiHealth: boolean;
}

const requestLog: { ts: number; ok: boolean }[] = [];
let _webhookFailures = 0;
let _activeRequests = 0;

/* Cached DB latency — updated at most once every 5 min to avoid hammering DB */
let _cachedDbLatency = 0;
let _cachedDbHealth = true;
let _dbCheckAt = 0;

export function recordRequest(ok: boolean) {
  requestLog.push({ ts: Date.now(), ok });
  if (requestLog.length > 1000) requestLog.shift();  // reduced from 5000
}
export function incActiveRequests()  { _activeRequests++; }
export function decActiveRequests()  { _activeRequests = Math.max(0, _activeRequests - 1); }
export function recordWebhookFailure() { _webhookFailures++; }
export function resetWebhookFailures() { _webhookFailures = 0; }

export async function collectMetrics(): Promise<SystemMetrics> {
  const mem = process.memoryUsage();

  /* Compare against the actual V8 heap limit (set by --max-old-space-size).
     heapUsed/heapTotal is always ~97-99% in Node — meaningless as a health signal.
     v8.getHeapStatistics().heap_size_limit gives the real cap. */
  let heapLimit = 512 * 1024 * 1024; // default assumption
  try {
    const { getHeapStatistics } = await import("v8");
    heapLimit = getHeapStatistics().heap_size_limit;
  } catch { /* noop */ }

  const used  = mem.heapUsed;
  const total = heapLimit;
  const percent = Math.round((used / total) * 100);

  const window = Date.now() - 60_000;
  const recent = requestLog.filter(r => r.ts > window);
  const failed = recent.filter(r => !r.ok).length;
  const errorRate = recent.length > 0 ? failed / recent.length : 0;

  /* Only ping DB if cache is stale (5 min) */
  const now = Date.now();
  if (now - _dbCheckAt > 5 * 60 * 1000) {
    _dbCheckAt = now;
    const t0 = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      _cachedDbLatency = Date.now() - t0;
      _cachedDbHealth = true;
    } catch {
      _cachedDbLatency = 9999;
      _cachedDbHealth = false;
    }
  }

  return {
    timestamp: now,
    memory: { used, total, percent },
    uptime: process.uptime(),
    errorRate,
    dbLatency:       _cachedDbLatency,
    activeRequests:  _activeRequests,
    totalRequests:   recent.length,
    failedRequests:  failed,
    webhookFailures: _webhookFailures,
    stripeHealth:    true,
    dbHealth:        _cachedDbHealth,
    apiHealth:       true,
  };
}
