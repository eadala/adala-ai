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

export function recordRequest(ok: boolean) {
  requestLog.push({ ts: Date.now(), ok });
  if (requestLog.length > 5000) requestLog.shift();
}
export function incActiveRequests()  { _activeRequests++; }
export function decActiveRequests()  { _activeRequests = Math.max(0, _activeRequests - 1); }
export function recordWebhookFailure() { _webhookFailures++; }
export function resetWebhookFailures() { _webhookFailures = 0; }

export async function collectMetrics(): Promise<SystemMetrics> {
  const mem = process.memoryUsage();
  const total = mem.heapTotal;
  const used  = mem.heapUsed;

  const window = Date.now() - 60_000;
  const recent = requestLog.filter(r => r.ts > window);
  const failed = recent.filter(r => !r.ok).length;
  const errorRate = recent.length > 0 ? failed / recent.length : 0;

  const t0 = Date.now();
  let dbHealth = false;
  let dbLatency = 9999;
  try {
    await db.execute(sql`SELECT 1`);
    dbLatency = Date.now() - t0;
    dbHealth = true;
  } catch {}

  return {
    timestamp: Date.now(),
    memory: { used, total, percent: Math.round((used / total) * 100) },
    uptime: process.uptime(),
    errorRate,
    dbLatency,
    activeRequests: _activeRequests,
    totalRequests: recent.length,
    failedRequests: failed,
    webhookFailures: _webhookFailures,
    stripeHealth: true,
    dbHealth,
    apiHealth: true,
  };
}
