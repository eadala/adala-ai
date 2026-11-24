/**
 * Canonical + legacy object-storage provider labels for Document Center.
 * Runtime I/O uses R2 + storage_key; these strings are metadata/stats/UI only.
 */

export const OBJECT_STORAGE_PROVIDER_LABELS = [
  "cloudflare_r2",
  "replit_object_storage",
] as const;

export type ObjectStorageProviderLabel =
  (typeof OBJECT_STORAGE_PROVIDER_LABELS)[number];

export function isObjectStorageProviderLabel(
  provider: string | null | undefined,
): boolean {
  return (
    provider === "cloudflare_r2" || provider === "replit_object_storage"
  );
}

/**
 * Explicit SQL predicate — only known object-storage aliases.
 * Use inside FILTER/WHERE via sql.raw(...).
 */
export const OBJECT_STORAGE_PROVIDER_SQL_PREDICATE =
  `storage_provider IN ('cloudflare_r2', 'replit_object_storage')` as const;
