import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
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
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
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
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

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
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
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

async function getMgmtUser(req: any) {
  const auth = getAuth(req);
  if (!auth?.userId) return null;
  try {
    const user = await getClerkMgmt().users.getUser(auth.userId);
    const email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
    const owner = (process.env.PLATFORM_OWNER_EMAIL ?? "").trim();
    const isSA = (!!owner && email === owner) || user.publicMetadata?.role === "super_admin";
    const officeId = (user.publicMetadata?.officeId as string) ?? auth.userId;
    return { userId: auth.userId, officeId, email, isSA };
  } catch { return null; }
}

async function dbRows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}

function fmtB(b: number) {
  if (!b || b === 0) return "0 B";
  const k = 1024, s = ["B","KB","MB","GB","TB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + " " + s[i];
}

/* STATS */
router.get("/storage/stats", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
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
router.get("/storage/files", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const { category, archived, deleted, search, caseId, limit = "50", offset = "0" } = req.query as any;
  const of2 = u.isSA ? sql`1=1` : sql`office_id=${u.officeId}`;
  const cf  = category ? sql`AND category=${category}` : sql``;
  const af  = archived === "true" ? sql`AND is_archived=true AND NOT is_deleted` : deleted === "true" ? sql`AND is_deleted=true` : sql`AND NOT is_deleted`;
  const sf  = search ? sql`AND original_name ILIKE ${'%' + search + '%'}` : sql``;
  const csf = caseId ? sql`AND case_id=${caseId}` : sql``;
  const rows = await dbRows(sql`SELECT id,office_id,case_id,original_name,file_name,mime_type,file_size,category,is_archived,is_deleted,deleted_at,archived_at,created_at,file_url FROM storage_files WHERE ${of2} ${af} ${cf} ${sf} ${csf} ORDER BY created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`);
  res.json(rows);
});

/* REGISTER FILE (metadata) */
router.post("/storage/files", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const { originalName, mimeType, fileSize, fileUrl, storageKey, category = "document", caseId, clientId } = req.body;
  if (!originalName) return res.status(400).json({ error: "اسم الملف مطلوب" });
  const fileHash = storageKey ? crypto.createHash("sha256").update(storageKey).digest("hex") : null;
  if (fileHash) {
    const dup = await dbRows(sql`SELECT id, original_name FROM storage_files WHERE file_hash=${fileHash} AND office_id=${u.officeId} AND NOT is_deleted`);
    if (dup.length > 0) return res.status(409).json({ duplicate: true, existing: dup[0], message: "هذا الملف موجود بالفعل" });
  }
  try {
    const rows = await dbRows(sql`INSERT INTO storage_files (office_id,case_id,client_id,uploaded_by,original_name,file_name,mime_type,file_size,file_hash,file_url,storage_key,category) VALUES (${u.officeId},${caseId??null},${clientId??null},${u.userId},${originalName},${storageKey??originalName},${mimeType??null},${fileSize??0},${fileHash},${fileUrl??null},${storageKey??null},${category}) RETURNING *`);
    await db.execute(sql`INSERT INTO office_storage_quota (office_id,used_bytes,files_count) VALUES (${u.officeId},${fileSize??0},1) ON CONFLICT (office_id) DO UPDATE SET used_bytes=office_storage_quota.used_bytes+${fileSize??0},files_count=office_storage_quota.files_count+1,updated_at=NOW()`);
    res.json(rows[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ARCHIVE TOGGLE */
router.patch("/storage/files/:id/archive", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const rows = await dbRows(sql`UPDATE storage_files SET is_archived=NOT is_archived, archived_at=CASE WHEN NOT is_archived THEN NOW() ELSE NULL END, updated_at=NOW() WHERE id=${req.params.id}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* MOVE TO TRASH */
router.patch("/storage/files/:id/trash", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const rows = await dbRows(sql`UPDATE storage_files SET is_deleted=true, deleted_at=NOW(), updated_at=NOW() WHERE id=${req.params.id}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* RESTORE FROM TRASH */
router.patch("/storage/files/:id/restore", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const rows = await dbRows(sql`UPDATE storage_files SET is_deleted=false, deleted_at=NULL, updated_at=NOW() WHERE id=${req.params.id}::uuid AND (office_id=${u.officeId} OR ${u.isSA}) RETURNING *`);
  res.json(rows[0] ?? { ok: true });
});

/* PERMANENT DELETE */
router.delete("/storage/files/:id", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  const file = await dbRows(sql`SELECT file_size, office_id FROM storage_files WHERE id=${req.params.id}::uuid`);
  if (!file.length) return res.status(404).json({ error: "الملف غير موجود" });
  if (!u.isSA && file[0].office_id !== u.officeId) return res.status(403).json({ error: "غير مصرح" });
  await db.execute(sql`DELETE FROM storage_files WHERE id=${req.params.id}::uuid`);
  const sz = Number(file[0].file_size ?? 0);
  if (sz > 0) await db.execute(sql`UPDATE office_storage_quota SET used_bytes=GREATEST(0,used_bytes-${sz}), files_count=GREATEST(0,files_count-1), updated_at=NOW() WHERE office_id=${file[0].office_id}`);
  res.json({ ok: true });
});

/* EMPTY TRASH */
router.delete("/storage/trash/empty", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
  try {
    const trashFiles = await dbRows(sql`SELECT id, file_size FROM storage_files WHERE is_deleted=true AND office_id=${u.officeId}`);
    const totalBytes = trashFiles.reduce((s: number, f: any) => s + Number(f.file_size ?? 0), 0);
    await db.execute(sql`DELETE FROM storage_files WHERE is_deleted=true AND office_id=${u.officeId}`);
    if (totalBytes > 0) await db.execute(sql`UPDATE office_storage_quota SET used_bytes=GREATEST(0,used_bytes-${totalBytes}), files_count=GREATEST(0,files_count-${trashFiles.length}), updated_at=NOW() WHERE office_id=${u.officeId}`);
    res.json({ deleted: trashFiles.length, freedFmt: fmtB(totalBytes) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* QUOTA LIST (SA) */
router.get("/storage/quotas", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u?.isSA) return res.status(403).json({ error: "غير مصرح" });
  const rows = await dbRows(sql`SELECT * FROM office_storage_quota ORDER BY used_bytes DESC`);
  res.json(rows);
});

/* UPDATE QUOTA (SA) */
router.patch("/storage/quotas/:officeId", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u?.isSA) return res.status(403).json({ error: "غير مصرح" });
  const { maxBytes } = req.body;
  await db.execute(sql`INSERT INTO office_storage_quota (office_id,max_bytes) VALUES (${req.params.officeId},${maxBytes}) ON CONFLICT (office_id) DO UPDATE SET max_bytes=${maxBytes},updated_at=NOW()`);
  res.json({ ok: true });
});

/* SETTINGS (SA) */
router.get("/storage/settings", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u?.isSA) return res.status(403).json({ error: "غير مصرح" });
  const rows = await dbRows(sql`SELECT * FROM storage_settings ORDER BY setting_key`);
  res.json(rows);
});

router.patch("/storage/settings", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u?.isSA) return res.status(403).json({ error: "غير مصرح" });
  const { settings } = req.body;
  try {
    for (const [key, value] of Object.entries(settings as Record<string, string>)) {
      await db.execute(sql`UPDATE storage_settings SET setting_value=${String(value)}, updated_at=NOW() WHERE setting_key=${key}`);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* AI ANALYSIS */
router.get("/storage/ai-analysis", async (req, res) => {
  const u = await getMgmtUser(req);
  if (!u) return res.status(401).json({ error: "غير مصادق" });
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

export default router;
