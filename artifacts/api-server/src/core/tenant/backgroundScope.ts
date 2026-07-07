/**
 * Background execution tenant scope — explicit ALS propagation for jobs/cron.
 */
import { runWithTenant } from "../tenantContext";

export const SYSTEM_ACTOR_ID = "system" as const;

/** Run work under an explicit tenant context (cron, per-office jobs). */
export function runAsSystemTenant<T>(officeId: string, fn: () => T): T {
  return runWithTenant({ userId: SYSTEM_ACTOR_ID, officeId }, fn);
}
