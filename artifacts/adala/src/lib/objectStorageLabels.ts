/**
 * Object-storage provider labels used by Document Center UI.
 * Matches API aliases: cloudflare_r2 (canonical) + replit_object_storage (legacy).
 */

export const OBJECT_STORAGE_PROVIDER_LABELS = [
  "cloudflare_r2",
  "replit_object_storage",
] as const;

export function isObjectStorageProviderLabel(
  provider: string | null | undefined,
): boolean {
  return (
    provider === "cloudflare_r2" || provider === "replit_object_storage"
  );
}

/** Download is allowed when the row is object-storage labeled and has a key. */
export function canDownloadObjectStorageFile(file: {
  storage_provider?: string | null;
  storage_key?: string | null;
}): boolean {
  return (
    !!file.storage_key &&
    isObjectStorageProviderLabel(file.storage_provider)
  );
}
