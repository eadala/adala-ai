/**
 * DocumentStorageService — طبقة تخزين المستندات الموحّدة
 * تعتمد على Replit Object Storage (Google Cloud Storage sidecar).
 * جميع الوحدات الداخلية تمر عبر هذه الطبقة فقط.
 *
 * مسارات التخزين:
 *   docs/{officeId}/cases/{caseId}/{uuid}_{filename}
 *   docs/{officeId}/clients/{clientId}/{uuid}_{filename}
 *   docs/{officeId}/contracts/{uuid}_{filename}
 *   docs/{officeId}/bankruptcy/{uuid}_{filename}
 *   docs/{officeId}/general/{uuid}_{filename}
 */

import { objectStorageClient } from "../lib/objectStorage";
import { createHash, randomUUID } from "crypto";
import { logger } from "../lib/logger";

const REPLIT_SIDECAR = "http://127.0.0.1:1106"; // nosemgrep: react-insecure-request

export interface UploadResult {
  storageKey:  string;
  storagePath: string;
  checksum:    string;
  size:        number;
  provider:    string;
}

export interface FileInfo {
  key:         string;
  size:        number;
  contentType: string;
  updatedAt:   string;
}

function getBucket(): string {
  const b = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!b) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID غير مُعيَّن — أضف Object Storage من لوحة Replit");
  return b;
}

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 100);
}

export class DocumentStorageService {
  private bucket() {
    return objectStorageClient.bucket(getBucket());
  }

  /** رفع ملف من Buffer مباشرةً */
  async uploadBuffer(
    buffer:      Buffer,
    officeId:    string,
    fileName:    string,
    contentType: string,
    folder = "general",
  ): Promise<UploadResult> {
    const uuid   = randomUUID();
    const safe   = sanitizeName(fileName);
    const key    = `docs/${officeId}/${folder}/${uuid}_${safe}`;
    const file   = this.bucket().file(key);

    await file.save(buffer, { contentType, resumable: false });

    const checksum = createHash("sha256").update(buffer).digest("hex");
    return {
      storageKey:  key,
      storagePath: `/objects/${key}`,
      checksum,
      size:        buffer.byteLength,
      provider:    "replit_object_storage",
    };
  }

  /** رفع ملف من Base64 (للتوافق مع الواجهة الحالية) */
  async uploadBase64(
    base64:      string,
    officeId:    string,
    fileName:    string,
    contentType: string,
    folder = "general",
  ): Promise<UploadResult> {
    const clean  = base64.includes(",") ? base64.split(",")[1] : base64;
    const buffer = Buffer.from(clean, "base64");
    return this.uploadBuffer(buffer, officeId, fileName, contentType, folder);
  }

  /** رابط موقَّع لتنزيل الملف (صالح 1 ساعة افتراضياً) */
  async getSignedUrl(storageKey: string, ttlSec = 3600): Promise<string> {
    try {
      const bucketName = getBucket();
      const req = {
        bucket_name: bucketName,
        object_name: storageKey,
        method:      "GET",
        expires_at:  new Date(Date.now() + ttlSec * 1000).toISOString(),
      };
      // nosemgrep: react-insecure-request
      const resp = await fetch(`${REPLIT_SIDECAR}/object-storage/signed-object-url`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(req),
        signal:  AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`Sidecar error ${resp.status}`);
      const { signed_url } = (await resp.json()) as any;
      return signed_url as string;
    } catch (e: any) {
      logger.warn({ err: e.message, storageKey }, "Failed to generate signed URL");
      throw e;
    }
  }

  /** رابط موقَّع للرفع المباشر من المتصفح */
  async getUploadUrl(
    officeId:    string,
    fileName:    string,
    contentType: string,
    folder = "general",
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    const uuid        = randomUUID();
    const safe        = sanitizeName(fileName);
    const storageKey  = `docs/${officeId}/${folder}/${uuid}_${safe}`;
    const bucketName  = getBucket();

    const req = {
      bucket_name: bucketName,
      object_name: storageKey,
      method:      "PUT",
      expires_at:  new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
    // nosemgrep: react-insecure-request
    const resp = await fetch(`${REPLIT_SIDECAR}/object-storage/signed-object-url`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(req),
      signal:  AbortSignal.timeout(10_000),
    });
    if (!resp.ok) throw new Error(`Sidecar error ${resp.status}`);
    const { signed_url: uploadUrl } = (await resp.json()) as any;
    return { uploadUrl, storageKey };
  }

  /** حذف ملف من التخزين */
  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.bucket().file(storageKey).delete();
    } catch (e: any) {
      logger.warn({ err: e.message, storageKey }, "delete file failed (best-effort)");
    }
  }

  /** قائمة ملفات مكتب معيّن */
  async listByOffice(officeId: string): Promise<FileInfo[]> {
    try {
      const [files] = await this.bucket().getFiles({ prefix: `docs/${officeId}/` });
      return files.map(f => ({
        key:         f.name,
        size:        Number(f.metadata?.size ?? 0),
        contentType: String(f.metadata?.contentType ?? "application/octet-stream"),
        updatedAt:   String(f.metadata?.updated ?? ""),
      }));
    } catch {
      return [];
    }
  }

  /** إجمالي مساحة مكتب معيّن */
  async getOfficeStorageSize(officeId: string): Promise<number> {
    const files = await this.listByOffice(officeId);
    return files.reduce((sum, f) => sum + f.size, 0);
  }

  /** إجمالي مساحة جميع المكاتب (للمشرف العام) */
  async getTotalStorageStats(): Promise<{ totalFiles: number; totalBytes: number }> {
    try {
      const [files] = await this.bucket().getFiles({ prefix: "docs/" });
      return {
        totalFiles: files.length,
        totalBytes: files.reduce((s, f) => s + Number(f.metadata?.size ?? 0), 0),
      };
    } catch {
      return { totalFiles: 0, totalBytes: 0 };
    }
  }

  /** ترحيل ملف base64 من قاعدة البيانات إلى Object Storage */
  async migrateBase64ToStorage(
    base64:      string,
    officeId:    string,
    fileName:    string,
    contentType: string,
    folder = "general",
  ): Promise<UploadResult | null> {
    if (!base64 || base64.length < 10) return null;
    try {
      return await this.uploadBase64(base64, officeId, fileName, contentType, folder);
    } catch (e: any) {
      logger.error({ err: e.message, officeId, fileName }, "Migration upload failed");
      return null;
    }
  }
}

export const documentStorage = new DocumentStorageService();
