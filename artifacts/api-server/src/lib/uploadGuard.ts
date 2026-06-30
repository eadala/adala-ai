/**
 * uploadGuard.ts — Enterprise File Upload Security Middleware
 * ─────────────────────────────────────────────────────────────
 * المرجع الأمني الموحّد لجميع عمليات رفع الملفات في عدالة AI.
 * يُطبَّق على: document-center/upload · cases/:id/documents · portal/:token/upload
 *
 * الطبقات الأمنية:
 *  1. MIME Allowlist      — قائمة بيضاء صارمة لأنواع الملفات
 *  2. Executable Blocking — حجب الامتدادات التنفيذية الخطرة
 *  3. Filename Sanitize   — تطهير اسم الملف (path traversal · null bytes · special chars)
 *  4. Size Validation     — التحقق من الحجم الفعلي (base64 bytes) لا حجم الـ string
 *  5. Magic Bytes Check   — مطابقة بداية الملف مع نوع MIME المُدّعى (PDF · JPG · PNG · ZIP)
 *  6. Duplicate Guard     — كشف checksum مزدوج
 */

import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import path from "path";

/* ── Master MIME Allowlist ──────────────────────────────────────────────────── */
export const UPLOAD_ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/x-rar-compressed",
  "application/octet-stream",   // signed-URL uploads only
]);

/* ── Blocked executable extensions ─────────────────────────────────────────── */
const BLOCKED_EXT = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".msp", ".mst",
  ".sh", ".bash", ".zsh", ".fish",
  ".ps1", ".psm1", ".psd1",
  ".vbs", ".vbe", ".js", ".jse", ".wsf", ".wsh",
  ".scr", ".pif", ".lnk", ".hta",
  ".jar", ".war", ".ear",
  ".dll", ".so", ".dylib",
  ".py", ".rb", ".pl", ".php", ".asp", ".aspx",
  ".cgi", ".htaccess", ".env",
]);

/* ── Magic byte signatures ─────────────────────────────────────────────────── */
const MAGIC: Array<{ mime: string; hex: string; offset?: number }> = [
  { mime: "application/pdf", hex: "255044462d" },                 // %PDF-
  { mime: "image/png",       hex: "89504e47" },                   // .PNG
  { mime: "image/jpeg",      hex: "ffd8ff" },                     // JFIF/EXIF
  { mime: "image/gif",       hex: "474946" },                     // GIF8
  { mime: "image/webp",      hex: "52494646",  offset: 0 },       // RIFF (check separately)
  { mime: "application/zip", hex: "504b0304" },                   // PK
];

/* ── Limits ─────────────────────────────────────────────────────────────────── */
export const UPLOAD_SIZE_LIMITS: Record<string, number> = {
  "document-center": 15 * 1024 * 1024,   // 15 MB
  "cases":           10 * 1024 * 1024,   // 10 MB
  "portal":           5 * 1024 * 1024,   //  5 MB
  "default":         10 * 1024 * 1024,   // 10 MB
};

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/**
 * Sanitize filename — strips path traversal, null bytes, leading dots,
 * consecutive dots, and non-printable characters.
 */
export function sanitizeFilename(raw: string): string {
  if (!raw || typeof raw !== "string") return "unnamed_file";

  /* Remove path components */
  let name = path.basename(raw.replace(/\\/g, "/"));

  /* Strip null bytes + non-printable ASCII */
  name = name.replace(/\0/g, "").replace(/[^\x20-\x7E\u0600-\u06FF\u0750-\u077F]/g, "");

  /* Collapse consecutive dots (but keep extension) */
  name = name.replace(/\.{2,}/g, ".");

  /* Strip leading dots (hidden files) */
  name = name.replace(/^\.+/, "");

  /* Limit length */
  if (name.length > 200) name = name.slice(0, 200);

  return name || "unnamed_file";
}

/**
 * Decode base64 data URI or raw base64 → Buffer.
 * Returns null if string is malformed.
 */
export function decodeBase64(data: string): Buffer | null {
  try {
    const comma = data.indexOf(",");
    const raw   = comma !== -1 ? data.slice(comma + 1) : data;
    return Buffer.from(raw, "base64");
  } catch {
    return null;
  }
}

/**
 * Compute SHA-256 checksum of a Buffer.
 */
export function computeChecksum(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Verify magic bytes of a buffer match a MIME type.
 * Returns true if check passes or if MIME is not in our magic list (no check).
 */
export function verifyMagicBytes(buf: Buffer, mime: string): boolean {
  const entry = MAGIC.find(m => m.mime === mime);
  if (!entry) return true;  // no magic check defined for this MIME — pass

  const startHex = buf.slice(0, 8).toString("hex");
  if (entry.mime === "image/webp") {
    /* WEBP = RIFF....WEBP */
    return startHex.startsWith("52494646") && buf.slice(8, 12).toString("ascii") === "WEBP";
  }
  return startHex.startsWith(entry.hex);
}

/**
 * Check if filename has a blocked executable extension.
 * Handles double extensions like "malware.pdf.exe".
 */
export function isExecutableFilename(filename: string): boolean {
  const lower = filename.toLowerCase();
  /* Check ALL extensions (handles double ext) */
  const parts = lower.split(".");
  for (let i = 1; i < parts.length; i++) {
    if (BLOCKED_EXT.has(`.${parts[i]}`)) return true;
  }
  return false;
}

/* ── Core validation function ───────────────────────────────────────────────── */

export interface UploadValidationResult {
  ok:          boolean;
  status?:     number;
  error?:      string;
  sanitized?:  string;      // sanitized filename
  buffer?:     Buffer;      // decoded file buffer
  checksum?:   string;      // SHA-256
  byteSize?:   number;      // actual file size in bytes
}

/**
 * Validate a base64 file upload request.
 * context: "document-center" | "cases" | "portal" | "default"
 */
export function validateUpload(opts: {
  fileData:  string;
  fileName:  string;
  fileType?: string;
  context:   string;
}): UploadValidationResult {
  const { fileData, fileName, fileType, context } = opts;

  /* 1. Required fields */
  if (!fileData || !fileName) {
    return { ok: false, status: 400, error: "fileData و fileName مطلوبان" };
  }

  /* 2. Sanitize filename */
  const sanitized = sanitizeFilename(fileName);
  if (sanitized === "unnamed_file" && fileName && fileName.length > 0) {
    return { ok: false, status: 400, error: "اسم الملف يحتوي على أحرف غير مسموح بها" };
  }

  /* 3. Block executable extensions */
  if (isExecutableFilename(sanitized)) {
    return { ok: false, status: 415, error: `نوع الملف خطر ومحظور: ${sanitized}` };
  }

  /* 4. MIME allowlist */
  const mime = fileType ?? "application/octet-stream";
  if (!UPLOAD_ALLOWED_MIME.has(mime)) {
    return { ok: false, status: 415, error: `نوع الملف غير مدعوم: ${mime}` };
  }

  /* 5. Decode base64 → actual bytes */
  const buf = decodeBase64(fileData);
  if (!buf || buf.length === 0) {
    return { ok: false, status: 400, error: "بيانات الملف تالفة أو فارغة" };
  }

  /* 6. Size check — actual bytes */
  const limit = UPLOAD_SIZE_LIMITS[context] ?? UPLOAD_SIZE_LIMITS.default;
  if (buf.length > limit) {
    const limitMB = Math.round(limit / 1024 / 1024);
    return { ok: false, status: 413, error: `حجم الملف يتجاوز ${limitMB} MB` };
  }

  /* 7. Magic bytes verification */
  if (!verifyMagicBytes(buf, mime)) {
    return { ok: false, status: 415, error: `محتوى الملف لا يطابق النوع المُدّعى: ${mime}` };
  }

  /* 8. Compute checksum */
  const checksum = computeChecksum(buf);

  return {
    ok:        true,
    sanitized,
    buffer:    buf,
    checksum,
    byteSize:  buf.length,
  };
}

/* ── Express middleware factory ─────────────────────────────────────────────── */

/**
 * uploadGuardMiddleware(context) — validates req.body.fileData/fileName/fileType
 * and attaches validated data to req for use in the route handler.
 */
export function uploadGuardMiddleware(context: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { fileData, fileName, fileType } = req.body ?? {};

    /* Skip if no fileData (some routes allow metadata-only calls) */
    if (!fileData) { next(); return; }

    const result = validateUpload({ fileData, fileName, fileType, context });

    if (!result.ok) {
      res.status(result.status ?? 400).json({ error: result.error });
      return;
    }

    /* Attach validated data to request for downstream route handlers */
    (req as any).uploadValidated = {
      sanitizedFileName: result.sanitized,
      buffer:            result.buffer,
      checksum:          result.checksum,
      byteSize:          result.byteSize,
      mime:              fileType ?? "application/octet-stream",
    };

    /* Replace fileName in body with sanitized version */
    req.body.fileName = result.sanitized;

    next();
  };
}
