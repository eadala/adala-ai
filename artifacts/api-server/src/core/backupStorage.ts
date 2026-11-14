/**
 * backupStorage.ts — رفع/تحميل نسخ احتياطية عبر مزوّد التخزين
 *
 * مسار التخزين:
 *   backups/tenants/{tenantId}/snapshot-{timestamp}.json.enc
 *   backups/full/full-{timestamp}.dump.enc
 *
 * Live (non-local) access for 010-B drills is fail-closed via phase010bAuth.
 */

import { getStorageProvider } from "../core/storage";
import {
  assertLiveBackupStorageAllowed,
  assertSyntheticDeleteAllowed,
} from "../reliability/gates/phase010bAuth";

function provider() {
  return getStorageProvider();
}

function assertBackupPrefix(key: string): void {
  if (!key || key.includes("..") || key.startsWith("/") || !key.startsWith("backups/")) {
    throw new Error(`backup_key_outside_allowed_prefix:${key}`);
  }
}

export async function uploadBackup(key: string, data: Buffer, contentType = "application/octet-stream"): Promise<string> {
  assertBackupPrefix(key);
  const gate = assertLiveBackupStorageAllowed("upload");
  if (!gate.ok) throw new Error(gate.reason);
  await provider().putObject(key, data, {
    contentType,
    metadata: {
      purpose: "adala_logical_backup",
      gateMode: gate.mode,
    },
  });
  return key;
}

export async function downloadBackup(key: string): Promise<Buffer> {
  assertBackupPrefix(key);
  const gate = assertLiveBackupStorageAllowed("download");
  if (!gate.ok) throw new Error(gate.reason);
  const exists = await provider().exists(key);
  if (!exists) throw new Error(`النسخة الاحتياطية غير موجودة: ${key}`);
  return provider().getObject(key);
}

export async function downloadObjectByKey(key: string): Promise<Buffer> {
  return downloadBackup(key);
}

export async function listBackups(prefix: string): Promise<{ key: string; size: number; updatedAt: string }[]> {
  if (!prefix.startsWith("backups/")) {
    throw new Error(`list_prefix_outside_backups:${prefix}`);
  }
  const gate = assertLiveBackupStorageAllowed("download");
  if (!gate.ok) throw new Error(gate.reason);
  try {
    const files = await provider().listObjects(prefix);
    return files.map((f) => ({
      key: f.key,
      size: f.size,
      updatedAt: f.updatedAt,
    }));
  } catch (e: unknown) {
    throw new Error(e instanceof Error ? e.message : "list_backups_failed");
  }
}

/**
 * Delete only when gate allows and key is an identified synthetic/drill artifact
 * (or local backups/* for emulator cleanup).
 */
export async function deleteBackup(key: string): Promise<void> {
  assertBackupPrefix(key);
  const gate = assertSyntheticDeleteAllowed(key);
  if (!gate.ok) throw new Error(gate.reason);
  await provider().deleteObject(key);
}

export function tenantSnapshotKey(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `backups/tenants/${safe}/snapshot-${Date.now()}.json.enc`;
}

export function latestTenantSnapshotPrefix(tenantId: string): string {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `backups/tenants/${safe}/`;
}

export function fullBackupKey(): string {
  /* Logical pg_dump -Fc artifacts; .enc suffix denotes encryption-at-rest intent for remote stores */
  const drill = process.env.ADALA_010B_AUTHORIZED === "1" ? "synthetic-drill-" : "";
  return `backups/full/full-${drill}${Date.now()}.dump.enc`;
}
