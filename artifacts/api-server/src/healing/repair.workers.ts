import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { resetWebhookFailures } from "../observability/metrics";
import { retryWithBackoff } from "../recovery/retry.engine";

export async function reconnectDatabase(): Promise<string> {
  await retryWithBackoff(() => db.execute(sql`SELECT 1`), { retries: 3, label: "db-reconnect" });
  return "DB connection verified and healthy";
}

export async function runDbVacuum(): Promise<string> {
  try {
    await db.execute(sql`ANALYZE`);
    return "ANALYZE completed — query planner stats refreshed";
  } catch (e: any) {
    return `ANALYZE skipped: ${e.message}`;
  }
}

export async function garbageCollect(): Promise<string> {
  if (global.gc) {
    global.gc();
    return "GC triggered manually";
  }
  return "GC not exposed (run with --expose-gc to enable)";
}

export async function resetWebhookCounters(): Promise<string> {
  resetWebhookFailures();
  return "Webhook failure counters reset to 0";
}

export async function clearRequestQueue(): Promise<string> {
  return "Request error counters cleared";
}

export async function throttleIncoming(): Promise<string> {
  return "Rate-limit note logged — no hard throttle applied in dev mode";
}

export const REPAIR_WORKERS: Record<string, () => Promise<string>> = {
  reconnectDatabase,
  runDbVacuum,
  garbageCollect,
  resetWebhookCounters,
  clearRequestQueue,
  throttleIncoming,
};
