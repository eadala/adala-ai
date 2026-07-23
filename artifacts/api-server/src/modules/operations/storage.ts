/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { requireAuthWithTenant, checkIsSuperAdmin } from "../../middlewares/requireAuth";
import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../../lib/objectStorage";
import {
  resolveStorageOfficeId,
  storageMgmtAuthResponse,
  type StorageMgmtAuthFailure,
} from "../../lib/storageOfficeId";
import {
  registerStorageFileWithQuota,
  storageRegisterErrorResponse,
} from "../../lib/storageFileRegister";
import { createStorageFolder } from "../../lib/storageFolderCreate";
import { logEndpointError } from "../../lib/endpointErrorLog";
import {
  entityIdFromCanonicalKey,
  normalizeToCanonicalObjectKey,
  tenantOwnsCanonicalObjectKey,
} from "../../lib/storageObjectOwnership";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuthWithTenant, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const raw = String(req.params.filePath);
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get("/storage/objects/*path", requireAuthWithTenant, async (req: Request, res: Response) => {
  const notFound = () => {
    res.status(404).json({ error: "Object not found" });
  };

  try {
    const raw = String(req.params.path);
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const tenantId = (req as any).tenantId as string | undefined;

    // Canonicalize first — reject traversal / ambiguous paths without touching storage.
    const canonicalKey = normalizeToCanonicalObjectKey(wildcardPath);
    if (!canonicalKey) {
      notFound();
      return;
    }

    // Ownership BEFORE object lookup — never reveal existence of foreign/missing keys.
    let owns = false;
    try {
      owns = await tenantOwnsCanonicalObjectKey({
        tenantId: tenantId ?? "",
        canonicalKey,
      });
    } catch (dbErr) {
      req.log.error({ err: dbErr }, "Ownership check failed (fail closed)");
      notFound();
      return;
    }
    if (!owns) {
      notFound();
      return;
    }

    const entityId = entityIdFromCanonicalKey(canonicalKey);
    if (!entityId) {
      notFound();
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(`/objects/${entityId}`);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      notFound();
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    // Fail closed — do not stream; use same 404 to avoid existence oracle.
    notFound();
  }
});

/* ══════════════════════════════════════════════════
   SMART STORAGE MANAGEMENT
══════════════════════════════════════════════════ */
import { createClerkClient, getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

let _clerk2: ReturnType<typeof createClerkClient> | null = null;
const getClerkMgmt = () => {
  if (!_clerk2) _clerk2 = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerk2;
};

type MgmtUser = {
  userId: string;
  officeId: string;
  email: string;
  isSA: boolean;
  officeRole: string;
  isAdmin: boolean;
  isImpersonating: boolean;
};

type GetMgmtUserResult =
  | { ok: true; user: MgmtUser }
  | { ok: false; reason: StorageMgmtAuthFailure };

async function getMgmtUser(req: any): Promise<GetMgmtUserResult> {
  const auth = getAuth(req);
  if (!auth?.userId) return { ok: false, reason: "unauthenticated" };
  try {
    const user = await getClerkMgmt().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const isSA = await checkIsSuperAdmin(auth.userId);
    // Prefer tenant from requireAuthWithTenant; never fall back to Clerk userId.
    const resolvedOfficeId = resolveStorageOfficeId({
      tenantId: req.tenantId,
      metadataOfficeId: user.publicMetadata?.officeId,
    });
    if (!resolvedOfficeId) return { ok: false, reason: "office_required" };
    let officeId: string = resolvedOfficeId;

    // Developer impersonation: SA viewing as a specific office
    let isImpersonating = false;
    if (isSA) {
      const impRows = await dbRows(sql`
        SELECT impersonated_office_id, office_name FROM developer_impersonation
        WHERE super_admin_user_id = ${auth.userId}
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `);
      if (impRows[0]?.impersonated_office_id) {
        officeId = String(impRows[0].impersonated_office_id);
        isImpersonating = true;
      }
    }

    // Resolve office role from office_members
    const memberRows = await dbRows(sql`SELECT role FROM office_members WHERE user_id=${auth.userId} AND office_id=${officeId} AND status='active' LIMIT 1`);
    const officeRole: string = memberRows[0]?.role ?? (user.publicMetadata?.role as string ?? "lawyer");
    // When impersonating, act as firm_owner (full access) but not global SA
    const effectiveSA = isSA && !isImpersonating;
    const isAdmin = effectiveSA || officeRole === "firm_owner" || officeRole === "office_manager" || isImpersonating;
    return {
      ok: true,
      user: {
        userId: auth.userId,
        officeId,
        email,
        isSA: effectiveSA,
        officeRole: isImpersonating ? "firm_owner" : officeRole,
        isAdmin,
        isImpersonating,
      },
    };
  } catch {
    return { ok: false, reason: "unauthenticated" };
  }
}

function rejectMgmtUser(res: Response, result: Extract<GetMgmtUserResult, { ok: false }>): void {
  const { status, body } = storageMgmtAuthResponse(result.reason);
  res.status(status).json(body);
}

/**
 * Permission levels for a folder:
 *   everyone    — all office members can read; only owner/admin can rename/delete
 *   admins_only — only firm_owner, office_manager, super_admin can read/write/delete
 *   owner_only  — only the creator (+ admins) can read/write/delete
 *   custom      — per-user grants in folder_permissions table
 *
 * For 'read': can the user see this folder and its files?
 * For 'write': can the user upload files / create sub-folders in it?
 * For 'manage': can the user rename, delete, change permissions of this folder?
 */
async function getFolderAccess(folderId: string, u: MgmtUser, need: "read" | "write" | "manage"): Promise<boolean> {
  if (u.isSA) return true;
  const rows = await dbRows(sql`SELECT visibility, created_by FROM storage_folders WHERE id=${folderId}::uuid AND office_id=${u.officeId}`);
  if (!rows.length) return false;
  const { visibility, created_by } = rows[0];
  const isOwner = created_by === u.userId;
  const isAdmin = u.isAdmin;

  if (need === "manage") return isOwner || isAdmin;

  switch (visibility as string) {
    case "owner_only":  return isOwner || isAdmin;
    case "admins_only": return isAdmin;
    case "custom": {
      if (isOwner || isAdmin) return true;
      const p = await dbRows(sql`SELECT can_read, can_write FROM folder_permissions WHERE folder_id=${folderId}::uuid AND user_id=${u.userId}`);
      if (!p.length) return false;
      if (need === "read")  return !!p[0].can_read;
      if (need === "write") return !!p[0].can_write;
      return false;
    }
    default: // 'everyone'
      if (need === "read")  return true;
      if (need === "write") return true; // all members can upload/create sub-folders
      return false;
  }
}

async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

const GB = 1024 * 1024 * 1024;
const PLAN_STORAGE_BYTES: Record<string, number> = {
  free:         1   * GB,
  starter:      5   * GB,
  professional: 25  * GB,
  growth:       100 * GB,
  premium:      200 * GB,
  enterprise:   1024 * GB,
  custom:       10 * 1024 * GB,
};
const DEFAULT_MAX_BYTES = 1 * GB;

async function getPlanMaxBytes(officeId: string): Promise<number> {
  try {
    const rows = await dbRows(sql`SELECT plan FROM office_page WHERE id=${officeId} LIMIT 1`);
    const plan = rows[0]?.plan ?? "free";
    return PLAN_STORAGE_BYTES[plan] ?? DEFAULT_MAX_BYTES;
  } catch { return DEFAULT_MAX_BYTES; }
}

async function syncQuota(officeId: string): Promise<void> {
  try {
    const maxBytes = await getPlanMaxBytes(officeId);
    await db.execute(sql`
      INSERT INTO office_storage_quota (office_id, max_bytes)
      VALUES (${officeId}, ${maxBytes})
      ON CONFLICT (office_id) DO UPDATE
        SET max_bytes = ${maxBytes}, updated_at = NOW()
    `);
  } catch {}
}

function fmtB(b: number) {
  if (!b || b === 0) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + s[i];
}

/* STATS */
router.get("/storage/stats", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  if (!u.isSA) syncQuota(u.officeId).catch(() => {});
  const f = u.isSA ? sql`1=1` : sql`office_id=${u.officeId}`;
  const [tot, byCat, recent, large, trash, quota] = await Promise.all([
    dbRows(sql`SELECT COUNT(*)::int AS total_files, COALESCE(SUM(file_size),0)::bigint AS total_bytes, COUNT(*) FILTER (WHERE is_archived)::int AS archived_count, COUNT(*) FILTER (WHERE is_deleted)::int AS trash_count FROM storage_files WHERE ${f}`),
    dbRows(sql`SELECT category, COUNT(*)::int AS cnt, COALESCE(SUM(file_size),0)::bigint AS bytes FROM storage_files WHERE ${f} AND NOT is_deleted GROUP BY category ORDER BY bytes DESC`),
    dbRows(sql`SELECT id, office_id, original_name, file_size, category, mime_type, created_at FROM storage_files WHERE ${f} AND NOT is_deleted ORDER BY created_at DESC LIMIT 10`),
    dbRows(sql`SELECT id, original_name, file_size, category, created_at FROM storage_files WHERE ${f} AND NOT is_deleted ORDER BY file_size DESC LIMIT 5`),
    dbRows(sql`SELECT id, original_name, file_size, deleted_at FROM storage_files WHERE ${f} AND is_deleted ORDER BY deleted_at DESC LIMIT 10`),
    dbRows(sql`SELECT * FROM office_storage_quota WHERE office_id=${u.officeId}`),
  ]);
  const s = tot[0] ?? {}; const q2 = quota[0] ?? { used_bytes: s.total_bytes ?? 0, max_bytes: 5368709120 };
  res.json({
    totalFiles: s.total_files ?? 0, totalBytes: Number(s.total_bytes ?? 0), totalFmt: fmtB(Number(s.total_bytes ?? 0)),
    archivedCount: s.archived_count ?? 0, trashCount: s.trash_count ?? 0,
    byCategory: byCat, recentFiles: recent, largeFiles: large, trashFiles: trash,
    quota: { usedBytes: Number(q2.used_bytes ?? 0), maxBytes: Number(q2.max_bytes ?? 5368709120), usedFmt: fmtB(Number(q2.used_bytes ?? 0)), maxFmt: fmtB(Number(q2.max_bytes ?? 5368709120)), pct: Math.min(100, Math.round((Number(q2.used_bytes ?? 0) / Number(q2.max_bytes ?? 5368709120)) * 100)) },
  });
});

/* FILE LIST */
router.get("/storage/files", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const { category, archived, deleted, search, caseId, folderId, limit = "100", offset = "0" } = req.query as any;
  const of2 = u.isSA ? sql`1=1` : sql`office_id=${u.officeId}`;
  const cf  = category ? sql`AND category=${category}` : sql``;
  const af  = archived === "true" ? sql`AND is_archived=true AND NOT is_deleted` : deleted === "true" ? sql`AND is_deleted=true` : sql`AND NOT is_deleted`;
  const sf  = search ? sql`AND original_name ILIKE ${'%' + search + '%'}` : sql``;
  const csf = caseId ? sql`AND case_id=${caseId}` : sql``;
  // folderId="root" → files with folder_id IS NULL; folderId=uuid → files in that folder; absent → all
  const fof = folderId === "root" ? sql`AND folder_id IS NULL`
            : folderId ? sql`AND folder_id=${folderId}::uuid`
            : sql``;
  const rows = await dbRows(sql`SELECT id,office_id,case_id,folder_id,original_name,file_name,mime_type,file_size,category,is_archived,is_deleted,deleted_at,archived_at,created_at,file_url FROM storage_files WHERE ${of2} ${af} ${cf} ${sf} ${csf} ${fof} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`);
  res.json(rows);
});

/* Allowed file types for upload */
const ALLOWED_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/jpg", "image/png",
]);
const ALLOWED_EXTS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png"]);
const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

/* REGISTER FILE (metadata) */
router.post("/storage/files", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const { originalName, mimeType, fileSize, fileUrl, storageKey, category = "document", caseId, clientId } = req.body;
  if (!originalName) return res.status(400).json({ error: "اسم الملف مطلوب" });

  // ── File type & size validation ────────────────────────────────────
  if (mimeType && !ALLOWED_MIMES.has(mimeType)) {
    return res.status(415).json({ error: `نوع الملف غير مسموح به: ${mimeType}. الأنواع المسموح بها: PDF, DOCX, XLSX, JPG, PNG` });
  }
  const ext = "." + (originalName as string).split(".").pop()?.toLowerCase();
  if (!ALLOWED_EXTS.has(ext)) {
    return res.status(415).json({ error: `امتداد الملف غير مسموح به: ${ext}. الأنواع المسموح بها: pdf, docx, xlsx, jpg, png` });
  }
  if (fileSize && fileSize > MAX_FILE_BYTES) {
    return res.status(413).json({ error: `حجم الملف (${Math.round(fileSize / 1024 / 1024)} MB) يتجاوز الحد الأقصى المسموح به (50 MB)` });
  }
  // ──────────────────────────────────────────────────────────────────

  if (!u.isSA) {
    const quotaRows = await dbRows(sql`SELECT used_bytes, max_bytes FROM office_storage_quota WHERE office_id=${u.officeId}`);
    const usedBytes  = Number(quotaRows[0]?.used_bytes ?? 0);
    const maxBytes   = Number(quotaRows[0]?.max_bytes  ?? await getPlanMaxBytes(u.officeId));
    if (usedBytes + (fileSize ?? 0) > maxBytes) {
      return res.status(413).json({ error: "تجاوزت الحصة التخزينية المسموحة لباقتك. يرجى الترقية أو حذف ملفات قديمة.", quotaExceeded: true, usedBytes, maxBytes });
    }
  }

  const fileHash = storageKey ? crypto.createHash("sha256").update(storageKey).digest("hex") : null;
  if (fileHash) {
    const dup = await dbRows(sql`SELECT id, original_name FROM storage_files WHERE file_hash=${fileHash} AND office_id=${u.officeId} AND NOT is_deleted`);
    if (dup.length > 0) return res.status(409).json({ duplicate: true, existing: dup[0], message: "هذا الملف موجود بالفعل" });
  }
  try {
    /* Atomic: storage_files insert + quota upsert; rollback file row on quota failure */
    const { record } = await registerStorageFileWithQuota({
      officeId: u.officeId,
      userId: u.userId,
      originalName,
      mimeType,
      fileSize,
      fileUrl,
      storageKey,
      category,
      caseId,
      clientId,
      fileHash,
    });
    res.json(record);
  } catch (e: unknown) {
    logEndpointError("POST /api/storage/files", req, e, { officeId: u.officeId });
    const safe = storageRegisterErrorResponse();
    res.status(safe.status).json(safe.body);
  }
});

/* ARCHIVE TOGGLE */
router.patch("/storage/files/:id/archive", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const rows = await dbRows(sql`UPDATE storage_files SET is_archived=NOT is_archived, archived_at=CASE WHEN NOT is_archived THEN NOW() ELSE NULL END, updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* MOVE TO TRASH */
router.patch("/storage/files/:id/trash", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const rows = await dbRows(sql`UPDATE storage_files SET is_deleted=true, deleted_at=NOW(), updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* RESTORE FROM TRASH */
router.patch("/storage/files/:id/restore", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const rows = await dbRows(sql`UPDATE storage_files SET is_deleted=false, deleted_at=NULL, updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* PERMANENT DELETE */
router.delete("/storage/files/:id", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const file = await dbRows(sql`SELECT file_size, office_id FROM storage_files WHERE id=${String(req.params.id)}::uuid`);
  if (!file.length) return res.status(404).json({ error: "الملف غير موجود" });
  if (!u.isSA && file[0].office_id !== u.officeId) return res.status(403).json({ error: "غير مصرح" });
  await db.execute(sql`DELETE FROM storage_files WHERE id=${String(req.params.id)}::uuid`);
  const sz = Number(file[0].file_size ?? 0);
  if (sz > 0) await db.execute(sql`UPDATE office_storage_quota SET used_bytes=GREATEST(0,used_bytes-${sz}), files_count=GREATEST(0,files_count-1), updated_at=NOW() WHERE office_id=${file[0].office_id}`);
  res.json({ ok: true });
});

/* EMPTY TRASH */
router.delete("/storage/trash/empty", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  try {
    const trashFiles = await dbRows(sql`SELECT id, file_size FROM storage_files WHERE is_deleted=true AND office_id=${u.officeId}`);
    const totalBytes = trashFiles.reduce((s: number, f: any) => s + Number(f.file_size ?? 0), 0);
    await db.execute(sql`DELETE FROM storage_files WHERE is_deleted=true AND office_id=${u.officeId}`);
    if (totalBytes > 0) await db.execute(sql`UPDATE office_storage_quota SET used_bytes=GREATEST(0,used_bytes-${totalBytes}), files_count=GREATEST(0,files_count-${trashFiles.length}), updated_at=NOW() WHERE office_id=${u.officeId}`);
    res.json({ deleted: trashFiles.length, freedFmt: fmtB(totalBytes) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* QUOTA LIST (SA) */
router.get("/storage/quotas", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  if (!u.isSA) return res.status(403).json({ error: "غير مصرح" });
  const rows = await dbRows(sql`SELECT * FROM office_storage_quota ORDER BY used_bytes DESC`);
  res.json(rows);
});

/* UPDATE QUOTA (SA) */
router.patch("/storage/quotas/:officeId", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  if (!u.isSA) return res.status(403).json({ error: "غير مصرح" });
  const { maxBytes } = req.body;
  await db.execute(sql`INSERT INTO office_storage_quota (office_id,max_bytes) VALUES (${String(req.params.officeId)},${maxBytes}) ON CONFLICT (office_id) DO UPDATE SET max_bytes=${maxBytes},updated_at=NOW()`);
  res.json({ ok: true });
});

/* SETTINGS (SA) */
router.get("/storage/settings", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  if (!u.isSA) return res.status(403).json({ error: "غير مصرح" });
  const rows = await dbRows(sql`SELECT * FROM storage_settings ORDER BY setting_key`);
  res.json(rows);
});

router.patch("/storage/settings", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  if (!u.isSA) return res.status(403).json({ error: "غير مصرح" });
  const { settings } = req.body;
  try {
    for (const [key, value] of Object.entries(settings as Record<string, string>)) {
      await db.execute(sql`UPDATE storage_settings SET setting_value=${String(value)}, updated_at=NOW() WHERE setting_key=${key}`);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   POST /storage/analyze — Gemini Vision document analysis
   Body: { base64: string, mimeType: string }
   Returns: { ok, docType, parties, dates, caseType, court, summary, tags, text }
══════════════════════════════════════════════════ */
router.post("/storage/analyze", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }

  const { base64, mimeType } = req.body;
  if (!base64 || !mimeType) return res.status(400).json({ error: "base64 و mimeType مطلوبان" });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return res.json({ ok: false, error: "Gemini غير متاح" });

  const prompt = `أنت محلل مستندات قانوني خبير. حلل هذا المستند وأرجع JSON فقط بدون أي markdown أو نص إضافي:
{
  "text": "أول 200 كلمة من النص المستخرج",
  "docType": "نوع المستند: صحيفة دعوى | وكالة | عقد | حكم | مذكرة | شهادة | عقد عمل | رسالة رسمية | أخرى",
  "parties": ["الطرف الأول", "الطرف الثاني"],
  "dates": ["التاريخ 1"],
  "caseType": "مدني | جنائي | تجاري | أحوال شخصية | عمالي | إداري | أخرى | غير محدد",
  "court": "اسم المحكمة أو الجهة المصدرة",
  "summary": "ملخص الوثيقة في جملة واحدة واضحة",
  "tags": ["وسم1", "وسم2", "وسم3"]
}`;

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: prompt },
          ]}],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.1 },
        }),
      }
    );
    const data = await r.json() as any;
    if (data.error) throw new Error(data.error.message ?? "خطأ Gemini");

    const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as string;
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result: any = {};
    try { result = JSON.parse(cleaned); } catch { result = { summary: cleaned.slice(0, 200) }; }

    res.json({ ok: true, ...result });
  } catch (err: any) {
        res.json({ ok: false, error: err.message });
  }
});

/* ══════════════════════════════════════════════════
   POST /storage/import-url — استيراد ملف من رابط خارجي
   يدعم: Google Drive, Dropbox, OneDrive, أي رابط مباشر
   Body: { url, caseId?, clientId? }
══════════════════════════════════════════════════ */

/** تحويل روابط المشاركة إلى روابط تحميل مباشر */
function resolveDirectUrl(raw: string): string {
  // Google Drive: /file/d/{ID}/view  أو  /open?id={ID}
  const gdFile = raw.match(/drive\.google\.com\/file\/d\/([^/?&#]+)/);
  if (gdFile) return `https://drive.google.com/uc?export=download&id=${gdFile[1]}`;
  const gdOpen = raw.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (gdOpen) return `https://drive.google.com/uc?export=download&id=${gdOpen[1]}`;

  // Dropbox: dl=0 → dl=1 + استخدام CDN مباشر
  if (raw.includes("dropbox.com")) {
    return raw
      .replace("www.dropbox.com", "dl.dropboxusercontent.com")
      .replace(/[?&]dl=0/, m => m.replace("dl=0", "dl=1"));
  }

  // OneDrive share links (best-effort)
  if (raw.includes("1drv.ms") || raw.includes("onedrive.live.com")) {
    const encoded = Buffer.from(raw).toString("base64")
      .replace(/=/g, "").replace(/\//g, "_").replace(/\+/g, "-");
    return `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content`;
  }

  return raw;
}

router.post("/storage/import-url", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;

  const { url: rawUrl, caseId, clientId } = req.body;
  if (!rawUrl || typeof rawUrl !== "string") return res.status(400).json({ error: "الرابط مطلوب" });

  const url = resolveDirectUrl(rawUrl.trim());

  try {
    /* 1 ── جلب الملف */
    const fetchRes = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Adala/1.0)" },
      redirect: "follow",
    });
    if (!fetchRes.ok) throw new Error(`فشل تحميل الملف — HTTP ${fetchRes.status}`);

    const contentType = (fetchRes.headers.get("content-type") ?? "application/octet-stream").split(";")[0].trim();
    const contentDisp = fetchRes.headers.get("content-disposition") ?? "";

    /* استخراج اسم الملف */
    let fileName = "مستند_مستورد";
    const cdMatch = contentDisp.match(/filename\*?=(?:UTF-8''|"?)([^;"]+)/i);
    if (cdMatch) {
      fileName = decodeURIComponent(cdMatch[1].replace(/"/g, ""));
    } else {
      try { fileName = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "") || fileName; } catch {}
    }

    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    if (buffer.length === 0) throw new Error("الملف فارغ");
    if (buffer.length > 10 * 1024 * 1024) throw new Error("الملف أكبر من 10 MB");

    /* 2 ── رفع لمنظومة التخزين */
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    const putRes = await fetch(uploadURL, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: buffer,
    });
    if (!putRes.ok) throw new Error("فشل حفظ الملف في التخزين");

    /* 3 ── تسجيل في قاعدة البيانات */
    const fileHash = crypto.createHash("sha256").update(objectPath).digest("hex");
    const dup = await dbRows(sql`SELECT id, original_name FROM storage_files WHERE file_hash=${fileHash} AND office_id=${u.officeId} AND NOT is_deleted`);
    if (dup.length > 0) return res.status(409).json({ duplicate: true, existing: dup[0], message: "هذا الملف موجود بالفعل" });

    const category = contentType.startsWith("image/") ? "image"
      : contentType === "application/pdf" ? "pdf"
      : contentType.includes("word") ? "word"
      : contentType.includes("sheet") || contentType.includes("excel") ? "excel"
      : "document";

    const rows = await dbRows(sql`
      INSERT INTO storage_files
        (office_id, case_id, client_id, uploaded_by, original_name, file_name, mime_type,
         file_size, file_hash, file_url, storage_key, category)
      VALUES
        (${u.officeId}, ${caseId ?? null}, ${clientId ?? null}, ${u.userId},
         ${fileName}, ${objectPath}, ${contentType}, ${buffer.length}, ${fileHash},
         ${`/api/storage/objects${objectPath}`}, ${objectPath}, ${category})
      RETURNING *`);

    await db.execute(sql`
      INSERT INTO office_storage_quota (office_id, used_bytes, files_count)
      VALUES (${u.officeId}, ${buffer.length}, 1)
      ON CONFLICT (office_id) DO UPDATE
        SET used_bytes = office_storage_quota.used_bytes + ${buffer.length},
            files_count = office_storage_quota.files_count + 1,
            updated_at = NOW()`);

    res.json({ ok: true, record: rows[0] });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

/* AI ANALYSIS */
router.get("/storage/ai-analysis", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const of2 = u.isSA ? sql`1=1` : sql`office_id=${u.officeId}`;
  const [largeFiles, oldFiles, dupHashes] = await Promise.all([
    dbRows(sql`SELECT id, original_name, file_size, category, created_at FROM storage_files WHERE ${of2} AND NOT is_deleted AND file_size > 10485760 ORDER BY file_size DESC LIMIT 10`),
    dbRows(sql`SELECT id, original_name, file_size, created_at FROM storage_files WHERE ${of2} AND NOT is_deleted AND created_at < NOW() - INTERVAL '180 days' ORDER BY created_at ASC LIMIT 10`),
    dbRows(sql`SELECT file_hash, COUNT(*)::int AS cnt, MAX(original_name) AS sample_name, SUM(file_size)::bigint AS wasted_bytes FROM storage_files WHERE ${of2} AND NOT is_deleted AND file_hash IS NOT NULL GROUP BY file_hash HAVING COUNT(*) > 1 ORDER BY wasted_bytes DESC LIMIT 5`),
  ]);
  const wastedBytes = dupHashes.reduce((s: number, d: any) => s + Number(d.wasted_bytes ?? 0), 0);
  const archivableBytes = oldFiles.reduce((s: number, f: any) => s + Number(f.file_size ?? 0), 0);
  const suggestions: string[] = [];
  if (largeFiles.length > 0) suggestions.push(`${largeFiles.length} ملف كبير (أكبر من 10MB) — يمكن ضغطه أو نقله للأرشيف`);
  if (dupHashes.length > 0) suggestions.push(`${dupHashes.length} مجموعات ملفات مكررة — يمكن توفير ${fmtB(wastedBytes)}`);
  if (oldFiles.length > 0) suggestions.push(`${oldFiles.length} ملف أقدم من 180 يوم — يُنصح بأرشفتها`);
  res.json({ largeFiles, oldFiles, duplicates: dupHashes, summary: { wastedFmt: fmtB(wastedBytes), archivableFmt: fmtB(archivableBytes), suggestions } });
});

/* ══════════════════════════════════════════════════
   FOLDER MANAGEMENT  (permissions-enforced)
══════════════════════════════════════════════════ */

/* LIST folders — returns only folders the user can read */
router.get("/storage/folders", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;

  const all = await dbRows(sql`
    SELECT f.id, f.parent_id, f.name, f.visibility, f.created_by, f.created_at,
           (SELECT COUNT(*)::int FROM storage_files sf
            WHERE sf.folder_id=f.id AND NOT sf.is_deleted) AS file_count
    FROM storage_folders f
    WHERE f.office_id=${u.officeId}
    ORDER BY f.name ASC`);

  // Filter by read permission
  const visible: any[] = [];
  for (const f of all) {
    const ok = await getFolderAccess(f.id, u, "read");
    if (ok) visible.push({ ...f, isOwner: f.created_by === u.userId, canManage: f.created_by === u.userId || u.isAdmin });
  }
  res.json(visible);
});

/* CREATE folder */
router.post("/storage/folders", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const { name, parentId } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "اسم المجلد مطلوب" });

  // Check write permission on parent folder (if nested)
  if (parentId) {
    const ok = await getFolderAccess(parentId, u, "write");
    if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية إنشاء مجلدات هنا" });
  }

  const dup = await dbRows(sql`SELECT id FROM storage_folders WHERE office_id=${u.officeId} AND COALESCE(parent_id::text,'root')=COALESCE(${parentId ?? null},'root') AND LOWER(name)=LOWER(${name.trim()})`);
  if (dup.length) return res.status(409).json({ error: "مجلد بهذا الاسم موجود بالفعل" });

  /*
   * Deliberately NOT using dbRows() for the INSERT: dbRows swallows every DB
   * error and returns an empty array, which previously made this route send
   * an HTTP 200 with an empty body on failure — crashing Safari's
   * Response.json() with "The string did not match the expected pattern."
   * and hiding the true cause from logs.
   */
  try {
    const { folder } = await createStorageFolder({
      officeId: u.officeId,
      userId: u.userId,
      name: name.trim(),
      parentId: parentId ?? null,
    });
    res.status(201).json({ folder });
  } catch (err) {
    logEndpointError("POST /api/storage/folders", req, err, { officeId: u.officeId });
    res.status(500).json({ error: "فشل إنشاء المجلد" });
  }
});

/* RENAME folder — requires manage permission */
router.patch("/storage/folders/:id/rename", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية تعديل هذا المجلد" });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "الاسم مطلوب" });
  const rows = await dbRows(sql`UPDATE storage_folders SET name=${name.trim()}, updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND office_id=${u.officeId} RETURNING *`);
  if (!rows.length) return res.status(404).json({ error: "المجلد غير موجود" });
  res.json(rows[0]);
});

/* DELETE folder — requires manage permission */
router.delete("/storage/folders/:id", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية حذف هذا المجلد" });
  const folder = await dbRows(sql`SELECT parent_id FROM storage_folders WHERE id=${String(req.params.id)}::uuid AND office_id=${u.officeId}`);
  if (!folder.length) return res.status(404).json({ error: "المجلد غير موجود" });
  await db.execute(sql`UPDATE storage_files SET folder_id=${folder[0].parent_id??null} WHERE folder_id=${String(req.params.id)}::uuid`);
  await db.execute(sql`DELETE FROM storage_folders WHERE id=${String(req.params.id)}::uuid AND office_id=${u.officeId}`);
  res.json({ ok: true });
});

/* MOVE file to folder — requires write on target */
router.patch("/storage/files/:id/folder", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const { folderId } = req.body;
  if (folderId) {
    const ok = await getFolderAccess(folderId, u, "write");
    if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية النقل إلى هذا المجلد" });
  }
  const rows = await dbRows(sql`UPDATE storage_files SET folder_id=${folderId??null}, updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING id`);
  if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });
  res.json({ ok: true });
});

/* ══════════════════════════════════════════════════
   FOLDER PERMISSIONS MANAGEMENT
══════════════════════════════════════════════════ */

/* GET /storage/folders/:id/permissions — folder info + user grants */
router.get("/storage/folders/:id/permissions", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية إدارة هذا المجلد" });

  const [folder, grants, members] = await Promise.all([
    dbRows(sql`SELECT id, name, visibility, created_by FROM storage_folders WHERE id=${String(req.params.id)}::uuid AND office_id=${u.officeId}`),
    dbRows(sql`SELECT fp.user_id, fp.user_name, fp.can_read, fp.can_write, fp.can_delete, fp.granted_at FROM folder_permissions fp WHERE fp.folder_id=${String(req.params.id)}::uuid`),
    dbRows(sql`SELECT om.user_id, om.role, COALESCE(u2.full_name, om.user_id) AS name FROM office_members om LEFT JOIN users u2 ON u2.id=om.user_id WHERE om.office_id=${u.officeId} AND om.status='active' ORDER BY name`),
  ]);
  if (!folder.length) return res.status(404).json({ error: "المجلد غير موجود" });
  res.json({ folder: folder[0], grants, members });
});

/* PATCH /storage/folders/:id/permissions — update visibility */
router.patch("/storage/folders/:id/permissions", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية إدارة هذا المجلد" });

  const { visibility } = req.body;
  const allowed = ["everyone", "admins_only", "owner_only", "custom"];
  if (!allowed.includes(visibility)) return res.status(400).json({ error: "قيمة الرؤية غير صالحة" });

  const rows = await dbRows(sql`UPDATE storage_folders SET visibility=${visibility}, updated_at=NOW() WHERE id=${String(req.params.id)}::uuid AND office_id=${u.officeId} RETURNING id, name, visibility`);
  res.json(rows[0] ?? { ok: true });
});

/* POST /storage/folders/:id/permissions/users — grant/update user access */
router.post("/storage/folders/:id/permissions/users", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية إدارة هذا المجلد" });

  const { userId, userName, canRead = true, canWrite = false, canDelete = false } = req.body;
  if (!userId) return res.status(400).json({ error: "userId مطلوب" });
  const rows = await dbRows(sql`
    INSERT INTO folder_permissions (folder_id, user_id, user_name, can_read, can_write, can_delete)
    VALUES (${String(req.params.id)}::uuid, ${userId}, ${userName??null}, ${canRead}, ${canWrite}, ${canDelete})
    ON CONFLICT (folder_id, user_id) DO UPDATE
      SET can_read=${canRead}, can_write=${canWrite}, can_delete=${canDelete}, user_name=COALESCE(${userName??null}, folder_permissions.user_name)
    RETURNING *`);
  res.json(rows[0]);
});

/* DELETE /storage/folders/:id/permissions/users/:userId — revoke user access */
router.delete("/storage/folders/:id/permissions/users/:userId", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const ok = await getFolderAccess(String(req.params.id), u, "manage");
  if (!ok) return res.status(403).json({ error: "ليس لديك صلاحية إدارة هذا المجلد" });
  await db.execute(sql`DELETE FROM folder_permissions WHERE folder_id=${String(req.params.id)}::uuid AND user_id=${String(req.params.userId)}`);
  res.json({ ok: true });
});

/* GET /storage/team — office members list (for permissions UI) */
router.get("/storage/team", requireAuthWithTenant, async (req, res) => {
  const loaded = await getMgmtUser(req);
  if (!loaded.ok) { rejectMgmtUser(res, loaded); return; }
  const u = loaded.user;
  const rows = await dbRows(sql`
    SELECT om.user_id, om.role,
           COALESCE(u2.full_name, om.user_id) AS name,
           COALESCE(u2.email, '') AS email
    FROM office_members om
    LEFT JOIN users u2 ON u2.id = om.user_id
    WHERE om.office_id=${u.officeId} AND om.status='active'
    ORDER BY name ASC`);
  res.json(rows);
});

export default router;
