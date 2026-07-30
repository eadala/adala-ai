/**
 * Authenticated short-lived R2 GET URLs for private storage_files.
 * Never use bare /api/storage/objects/* as <a href> / <img src> — browsers
 * omit the Clerk Bearer token and the private route returns 401.
 */
import { authFetch } from "@/lib/authFetch";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type StorageSignedUrl = {
  url: string;
  fileName?: string;
  contentType?: string;
  expiresIn?: number;
};

/** Build the private API path for a new upload (no duplicated /objects/). */
export function privateStorageObjectApiPath(objectPath: string): string {
  if (objectPath.startsWith("/objects/")) return `/api/storage${objectPath}`;
  if (objectPath.startsWith("objects/")) return `/api/storage/${objectPath}`;
  return `/api/storage/objects/${objectPath.replace(/^\//, "")}`;
}

export async function fetchStorageFileSignedUrl(fileId: string): Promise<StorageSignedUrl> {
  const id = String(fileId ?? "").trim();
  if (!id) throw new Error("معرف الملف مطلوب");

  const res = await authFetch(`${BASE}/api/storage/files/${encodeURIComponent(id)}/signed-url`);
  if (!res.ok) {
    let message = "تعذر فتح الملف";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data = (await res.json()) as StorageSignedUrl;
  if (!data?.url) throw new Error("تعذر فتح الملف");
  return data;
}

/** Open a private storage file in a new tab via a short-lived signed GET URL. */
export async function openStorageFile(fileId: string): Promise<void> {
  const { url } = await fetchStorageFileSignedUrl(fileId);
  window.open(url, "_blank", "noopener,noreferrer");
}
