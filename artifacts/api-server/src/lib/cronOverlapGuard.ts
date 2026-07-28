/**
 * Process-local cron overlap protection.
 *
 * Deployment assumption (verified for this stage):
 * - docker-compose runs a single `adala-app` container (no replicas)
 * - no horizontal pod autoscaling configured for the API server
 *
 * Therefore in-process locks are sufficient. If multi-replica deployment is
 * introduced later, replace this with a distributed lock before relying on it.
 */

import { logger } from "./logger";

const runningJobs = new Set<string>();

export const CRON_JOB_NAMES = {
  agentRun: "agent-run",
  agentDailySnapshot: "agent-daily-snapshot",
  backupTenant: "backup-tenant",
  backupFull: "backup-full",
  email: "email-cron",
  logRotation: "log-rotation",
  monitoring: "monitoring-health",
  demoSync: "demo-sync",
} as const;

export type CronJobName = (typeof CRON_JOB_NAMES)[keyof typeof CRON_JOB_NAMES] | string;

export type CronOverlapLogFn = (
  payload: Record<string, unknown>,
  message: string,
) => void;

export type CronOverlapRunResult<T> =
  | { status: "completed"; result: T }
  | { status: "skipped" };

export function isCronJobRunning(jobName: string): boolean {
  return runningJobs.has(jobName);
}

export function getRunningCronJobs(): string[] {
  return [...runningJobs].sort();
}

/** Test-only: clear all locks between cases. */
export function resetCronOverlapLocksForTests(): void {
  runningJobs.clear();
}

/**
 * Run `fn` only if `jobName` is not already running in this process.
 * Skipped overlaps log a structured warning and resolve without throwing.
 * Lock is always released in `finally` (success or failure).
 */
export async function withCronOverlapProtection<T>(
  jobName: string,
  fn: () => Promise<T>,
  options?: { logWarn?: CronOverlapLogFn },
): Promise<CronOverlapRunResult<T>> {
  if (runningJobs.has(jobName)) {
    const logWarn =
      options?.logWarn ??
      ((payload, message) => {
        logger.warn(payload, message);
      });
    logWarn(
      {
        job: jobName,
        event: "cron_overlap_skipped",
      },
      `Cron overlap skipped: ${jobName} is already running`,
    );
    return { status: "skipped" };
  }

  runningJobs.add(jobName);
  try {
    const result = await fn();
    return { status: "completed", result };
  } finally {
    runningJobs.delete(jobName);
  }
}
