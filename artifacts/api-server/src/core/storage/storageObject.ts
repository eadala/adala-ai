/** Opaque handle for a stored object — replaces @google-cloud/storage File. */
export interface StorageObjectHandle {
  key: string;
  bucket: string;
  contentType?: string;
  size?: number;
}

export function createStorageObjectHandle(
  key: string,
  bucket: string,
  meta?: { contentType?: string; size?: number }
): StorageObjectHandle {
  return { key, bucket, ...meta };
}
