/**
 * backupStorage.ts — رفع/تحميل نسخ احتياطية عبر Cloudflare R2
 *
 * مسار التخزين:
 *   backups/tenants/{tenantId}/snapshot-{timestamp}.json.enc
 *   backups/full/full-{timestamp}.sql.enc
 */

import { getStorageProvider } from "../core/storage";

function provider() {
  return getStorageProvider();
}

export async function uploadBackup(key: string, data: Buffer, contentType = "application/octet-stream"): Promise<string> {
  await provider().putObject(key, data, { contentType });
  return key;
}

export async function downloadBackup(key: string): Promise<Buffer> {
  const exists = await provider().exists(key);
  if (!exists) throw new Error(`النسخة الاحتياطية غير موجودة: ${key}`);
  return provider().getObject(key);
}

export async function downloadObjectByKey(key: string): Promise<Buffer> {
  return downloadBackup(key);
}

export async function listBackups(prefix: string): Promise<{ key: string; size: number; updatedAt: string }[]> {
  try {
    const files = await provider().listObjects(prefix);
    return files.map((f) => ({
      key:       f.key,
      size:      f.size,
      updatedAt: f.updatedAt,
    }));
  } catch {
    return [];
  }
}

export async function deleteBackup(key: string): Promise<void> {
  try {
    await provider().deleteObject(key);
  } catch { /* best-effort */ }
}

export function tenantSnapshotKey(tenantId: string): string {
  return `backups/tenants/${tenantId}/snapshot-${Date.now()}.json.enc`;
}

export function latestTenantSnapshotPrefix(tenantId: string): string {
  return `backups/tenants/${tenantId}/`;
}

export function fullBackupKey(): string {
  return `backups/full/full-${Date.now()}.json.enc`;
}
