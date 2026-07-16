/**
 * Pure helpers for SmartUploader — kept free of React so tests can pin
 * the "Save click → no network" regressions without mounting the dialog.
 */

export const SMART_UPLOAD_ALLOWED_MIME: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
  "application/zip": "ZIP",
};

/** Extension fallback when browsers leave File.type empty / octet-stream. */
export const SMART_UPLOAD_EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".zip": "application/zip",
};

export type UploadQueueItem = { status: string };

/**
 * Resolve a allowlisted MIME for upload.
 * Prefer File.type when allowlisted; otherwise map from filename extension.
 * Returns null when the file cannot be uploaded.
 */
export function resolveUploadMime(file: { name: string; type: string }): string | null {
  const raw = (file.type || "").trim().toLowerCase();
  if (raw && SMART_UPLOAD_ALLOWED_MIME[raw]) return raw;

  /* Empty or generic types often appear on Windows / some mobile pickers */
  if (!raw || raw === "application/octet-stream") {
    const lower = file.name.toLowerCase();
    const dot = lower.lastIndexOf(".");
    if (dot < 0) return null;
    const ext = lower.slice(dot);
    const mapped = SMART_UPLOAD_EXT_MIME[ext];
    return mapped ?? null;
  }

  return null;
}

/** Normalize a browser File so contentType is never empty for the API. */
export function normalizeUploadFile(file: File): File | null {
  const mime = resolveUploadMime(file);
  if (!mime) return null;
  if ((file.type || "").toLowerCase() === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}

/**
 * Gate for the Save / upload CTA — any early return here must be explained to the user.
 * Returning { ok:false } means the handler must NOT call fetch.
 */
export function getUploadDispatchGate(opts: {
  busy: boolean;
  items: UploadQueueItem[];
}): { ok: true; pendingCount: number } | { ok: false; reason: "busy" | "empty_queue" } {
  if (opts.busy) return { ok: false, reason: "busy" };
  const pendingCount = opts.items.filter((i) => i.status === "queued").length;
  if (pendingCount === 0) return { ok: false, reason: "empty_queue" };
  return { ok: true, pendingCount };
}
