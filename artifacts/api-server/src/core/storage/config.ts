import type { StorageProviderId } from "./types";

const ACL_META_KEY = "custom-aclpolicy";

export function getStorageProviderId(): StorageProviderId {
  const raw = (process.env.STORAGE_PROVIDER ?? "cloudflare_r2").toLowerCase();
  if (raw === "cloudflare_r2" || raw === "r2") return "cloudflare_r2";
  if (raw === "aws_s3" || raw === "s3") return "aws_s3";
  if (raw === "gcs") return "gcs";
  if (raw === "local") return "local";
  return "cloudflare_r2";
}

/** Primary bucket — R2_BUCKET_NAME takes precedence over legacy Replit var. */
export function getObjectStorageBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) {
    throw new Error(
      "R2_BUCKET_NAME غير مُعيَّن — عيّن متغيرات Cloudflare R2 في البيئة"
    );
  }
  return bucket;
}

export function isObjectStorageConfigured(): boolean {
  const id = getStorageProviderId();
  if (id === "cloudflare_r2") {
    return !!(
      process.env.R2_BUCKET_NAME &&
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY
    );
  }
  return !!(process.env.R2_BUCKET_NAME || process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID);
}

/** Provider string stored in DB rows. */
export function getStorageProviderLabel(): string {
  return getStorageProviderId() === "cloudflare_r2" ? "cloudflare_r2" : getStorageProviderId();
}

/**
 * Legacy PRIVATE_OBJECT_DIR format: /{bucket}/{prefix...}
 * Returns object key prefix inside the bucket (no leading slash).
 */
export function getPrivateObjectKeyPrefix(): string {
  const dir = process.env.PRIVATE_OBJECT_DIR?.trim();
  if (!dir) return "private";

  try {
    const normalized = dir.startsWith("/") ? dir : `/${dir}`;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(1).join("/");
    }
    if (parts.length === 1) return parts[0];
  } catch {
    /* fall through */
  }
  return "private";
}

/** Legacy PUBLIC_OBJECT_SEARCH_PATHS — comma-separated /bucket/prefix entries. */
export function getPublicObjectKeyPrefixes(): string[] {
  const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
  const paths = pathsStr
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  return paths.map((fullPath) => {
    const normalized = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
    const parts = normalized.split("/").filter(Boolean);
    if (parts.length >= 2) return parts.slice(1).join("/");
    return parts[0] ?? "public";
  });
}

export function buildPrivateUploadKey(objectId: string): string {
  const prefix = getPrivateObjectKeyPrefix();
  return prefix ? `${prefix}/uploads/${objectId}` : `uploads/${objectId}`;
}

export function entityIdToObjectKey(entityId: string): string {
  const prefix = getPrivateObjectKeyPrefix();
  if (prefix && entityId.startsWith(`${prefix}/`)) return entityId;
  if (prefix) return `${prefix}/${entityId}`;
  return entityId;
}

export function objectKeyToEntityPath(key: string): string {
  const prefix = getPrivateObjectKeyPrefix();
  const entityId = prefix && key.startsWith(`${prefix}/`) ? key.slice(prefix.length + 1) : key;
  return `/objects/${entityId}`;
}

export { ACL_META_KEY };
