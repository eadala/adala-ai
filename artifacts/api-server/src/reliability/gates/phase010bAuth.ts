/**
 * Phase 010-B live object-storage gate — fail closed.
 * Live R2 backup upload/download for the 010-B drill requires explicit env authorization.
 * Local STORAGE_PROVIDER=local remains available for CI without this flag.
 *
 * DRAFT auth doc: docs/engineering/platform-reliability/phase-010a/12_PHASE_010B_LIMITED_AUTHORIZATION_DRAFT.md
 */

export type LiveBackupGateResult =
  | { ok: true; mode: "local" | "authorized_live" }
  | { ok: false; reason: string };

const SYNTHETIC_KEY_RE = /^backups\/(full|evidence|synthetic)\//;

export function isLocalStorageMode(): boolean {
  const id = (process.env.STORAGE_PROVIDER ?? "").toLowerCase();
  return id === "local";
}

export function isPhase010bLiveAuthorized(): boolean {
  return process.env.ADALA_010B_AUTHORIZED === "1";
}

/** Keys eligible for automated synthetic cleanup after a drill. */
export function isSyntheticBackupKey(key: string): boolean {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  return SYNTHETIC_KEY_RE.test(key) && /synthetic|gate009|gate010|drill/i.test(key);
}

/**
 * Gate for contacting non-local object storage for backup drills / cron upload.
 * Does not authorize WAL/PITR, staging, push, or production.
 */
export function assertLiveBackupStorageAllowed(purpose: "upload" | "download" | "delete"): LiveBackupGateResult {
  if (isLocalStorageMode()) {
    return { ok: true, mode: "local" };
  }
  if (!isPhase010bLiveAuthorized()) {
    return {
      ok: false,
      reason: `live_backup_${purpose}_blocked: set ADALA_010B_AUTHORIZED=1 only after signed 010-B limited authorization`,
    };
  }
  if (process.env.ADALA_010B_SYNTHETIC_ONLY === "0") {
    return { ok: false, reason: "synthetic_only_required_for_010b" };
  }
  /* Default synthetic-only when authorized */
  return { ok: true, mode: "authorized_live" };
}

export function assertSyntheticDeleteAllowed(key: string): LiveBackupGateResult {
  const base = assertLiveBackupStorageAllowed("delete");
  if (!base.ok) return base;
  if (base.mode === "local") {
    if (!key.startsWith("backups/")) {
      return { ok: false, reason: "delete_outside_backups_prefix" };
    }
    return base;
  }
  if (!isSyntheticBackupKey(key) && !key.startsWith("backups/full/full-")) {
    return { ok: false, reason: `delete_not_identified_synthetic:${key}` };
  }
  return base;
}
