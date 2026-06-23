/**
 * backupStorage.ts — رفع/تحميل نسخ احتياطية عبر Replit Object Storage
 * يستخدم objectStorageClient المثبّت مسبقاً (@google-cloud/storage).
 *
 * مسار التخزين:
 *   backups/tenants/{tenantId}/snapshot-{timestamp}.json.enc
 *   backups/full/full-{timestamp}.sql.enc
 */

import { objectStorageClient } from "../lib/objectStorage";

function getBucket(): string {
  const b = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!b) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID غير مُعيَّن");
  return b;
}

export async function uploadBackup(key: string, data: Buffer, contentType = "application/octet-stream"): Promise<string> {
  const bucket = objectStorageClient.bucket(getBucket());
  const file   = bucket.file(key);
  await file.save(data, { contentType, resumable: false });
  return key;
}

export async function downloadBackup(key: string): Promise<Buffer> {
  const bucket = objectStorageClient.bucket(getBucket());
  const file   = bucket.file(key);
  const [exists] = await file.exists();
  if (!exists) throw new Error(`النسخة الاحتياطية غير موجودة: ${key}`);
  const [contents] = await file.download();
  return contents;
}

export async function listBackups(prefix: string): Promise<{ key: string; size: number; updatedAt: string }[]> {
  try {
    const bucket = objectStorageClient.bucket(getBucket());
    const [files] = await bucket.getFiles({ prefix });
    return files.map(f => ({
      key:       f.name,
      size:      Number(f.metadata?.size ?? 0),
      updatedAt: String(f.metadata?.updated ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function deleteBackup(key: string): Promise<void> {
  try {
    const bucket = objectStorageClient.bucket(getBucket());
    await bucket.file(key).delete();
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
