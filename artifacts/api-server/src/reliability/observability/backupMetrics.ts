/**
 * Low-cardinality backup/restore operational metrics (in-process counters).
 * Avoid tenant/case/user labels.
 */
export type BackupMetricEvent =
  | "backup_started"
  | "backup_completed"
  | "backup_failed"
  | "restore_verified"
  | "restore_failed"
  | "dr_pass"
  | "dr_fail"
  | "dr_blocked";

const counters: Record<string, number> = Object.create(null);
let lastBackupCompletedAt: string | null = null;
let lastRestoreVerifiedAt: string | null = null;
let lastBackupAgeHintSec: number | null = null;
let lastRestoreDurationMs: number | null = null;
let readinessOk = true;

export function incBackupMetric(event: BackupMetricEvent): void {
  counters[event] = (counters[event] ?? 0) + 1;
}

export function recordBackupCompleted(at = new Date().toISOString()): void {
  lastBackupCompletedAt = at;
  lastBackupAgeHintSec = 0;
  incBackupMetric("backup_completed");
}

export function recordRestoreVerified(durationMs: number): void {
  lastRestoreVerifiedAt = new Date().toISOString();
  lastRestoreDurationMs = durationMs;
  incBackupMetric("restore_verified");
}

export function setReadinessOk(ok: boolean): void {
  readinessOk = ok;
}

export function getBackupOpsSnapshot() {
  return {
    counters: { ...counters },
    lastBackupCompletedAt,
    lastRestoreVerifiedAt,
    lastBackupAgeHintSec,
    lastRestoreDurationMs,
    readinessOk,
  };
}
