/**
 * DocumentStorageService — طبقة تخزين المستندات الموحّدة
 * Cloudflare R2 (S3-compatible) — لا اعتماد على Replit sidecar.
 *
 * مسارات التخزين:
 *   docs/{officeId}/cases/{caseId}/{uuid}_{filename}
 *   docs/{officeId}/clients/{clientId}/{uuid}_{filename}
 *   docs/{officeId}/contracts/{uuid}_{filename}
 *   docs/{officeId}/bankruptcy/{uuid}_{filename}
 *   docs/{officeId}/general/{uuid}_{filename}
 */

import { createHash, randomUUID } from "crypto";
import { logger } from "../lib/logger";
import {
  getStorageProvider,
  getStorageProviderLabel,
} from "../core/storage";

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

function sanitizeName(name: string): string {
  return name.replace(/[^\w.\-]/g, "_").slice(0, 100);
}

export class DocumentStorageService {
  private provider() {
    return getStorageProvider();
  }

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

    await this.provider().putObject(key, buffer, { contentType });

    const checksum = createHash("sha256").update(buffer).digest("hex");
    return {
      storageKey:  key,
      storagePath: `/objects/${key}`,
      checksum,
      size:        buffer.byteLength,
      provider:    getStorageProviderLabel(),
    };
  }

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

  async getSignedUrl(storageKey: string, ttlSec = 3600): Promise<string> {
    try {
      return await this.provider().getSignedUrl(storageKey, {
        method: "GET",
        ttlSec,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn({ err: msg, storageKey }, "Failed to generate signed URL");
      throw e;
    }
  }

  async getUploadUrl(
    officeId:    string,
    fileName:    string,
    contentType: string,
    folder = "general",
  ): Promise<{ uploadUrl: string; storageKey: string }> {
    const uuid        = randomUUID();
    const safe        = sanitizeName(fileName);
    const storageKey  = `docs/${officeId}/${folder}/${uuid}_${safe}`;

    const uploadUrl = await this.provider().getSignedUrl(storageKey, {
      method: "PUT",
      ttlSec: 15 * 60,
      contentType,
    });

    return { uploadUrl, storageKey };
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      await this.provider().deleteObject(storageKey);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.warn({ err: msg, storageKey }, "delete file failed (best-effort)");
    }
  }

  async listByOffice(officeId: string): Promise<FileInfo[]> {
    try {
      const files = await this.provider().listObjects(`docs/${officeId}/`);
      return files.map((f) => ({
        key:         f.key,
        size:        f.size,
        contentType: f.contentType,
        updatedAt:   f.updatedAt,
      }));
    } catch {
      return [];
    }
  }

  async getOfficeStorageSize(officeId: string): Promise<number> {
    const files = await this.listByOffice(officeId);
    return files.reduce((sum, f) => sum + f.size, 0);
  }

  async getTotalStorageStats(): Promise<{ totalFiles: number; totalBytes: number }> {
    try {
      const files = await this.provider().listObjects("docs/");
      return {
        totalFiles: files.length,
        totalBytes: files.reduce((s, f) => s + f.size, 0),
      };
    } catch {
      return { totalFiles: 0, totalBytes: 0 };
    }
  }

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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error({ err: msg, officeId, fileName }, "Migration upload failed");
      return null;
    }
  }
}

export const documentStorage = new DocumentStorageService();
