/**
 * documentCenter.ts — مركز إدارة المستندات
 * Upload → Object Storage | Metadata → DB | Migration Worker | Dashboard
 */

import { Router } from "express";
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

function isSuperAdminGuard(req: any, res: any, next: any) {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "غير مصرح" });
  const superAdminEmails = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map(e => e.trim()).filter(Boolean);
  const meta = (req.auth as any)?.sessionClaims?.publicMetadata as any;
  if (meta?.role === "super_admin" || superAdminEmails.includes(meta?.email ?? "")) return next();
  return res.status(403).json({ error: "للمشرفين العامين فقط" });
}
import { documentStorage } from "../../services/documentStorage";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../../lib/logger";

const router = Router();

/* ═══════════════════════════════════════════════════════
   DB BOOTSTRAP — idempotent columns + tables
═══════════════════════════════════════════════════════ */
export async function ensureDocumentCenterSchema() {
  const cols: string[] = [
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_key      TEXT`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'db_base64'`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS checksum         TEXT`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS version          INT  DEFAULT 1`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_archived      BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS legal_category   TEXT`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags             TEXT[]`,
    `ALTER TABLE documents ADD COLUMN IF NOT EXISTS migrated_at      TIMESTAMPTZ`,
  ];
  for (const c of cols) {
    await db.execute(sql.raw(c)).catch(() => {});
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS storage_migration_log (
      id           SERIAL PRIMARY KEY,
      office_id    TEXT NOT NULL,
      table_name   TEXT NOT NULL,
      record_id    TEXT NOT NULL,
      old_provider TEXT DEFAULT 'db_base64',
      new_key      TEXT,
      file_size    BIGINT,
      checksum     TEXT,
      status       TEXT DEFAULT 'pending',
      error_msg    TEXT,
      migrated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_center_files (
      id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      office_id       TEXT NOT NULL,
      source_table    TEXT NOT NULL,
      source_id       TEXT NOT NULL,
      storage_key     TEXT,
      storage_provider TEXT DEFAULT 'db_base64',
      file_name       TEXT,
      file_size       BIGINT DEFAULT 0,
      mime_type       TEXT,
      checksum        TEXT,
      legal_category  TEXT,
      tags            TEXT[],
      case_id         TEXT,
      client_id       TEXT,
      contract_id     TEXT,
      uploaded_by     TEXT,
      uploaded_by_name TEXT,
      is_archived     BOOLEAN DEFAULT FALSE,
      version         INT DEFAULT 1,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_dcf_office_id    ON document_center_files(office_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_dcf_case_id      ON document_center_files(case_id)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_dcf_category     ON document_center_files(office_id, legal_category)
  `).catch(() => {});
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_sml_office_status ON storage_migration_log(office_id, status)
  `).catch(() => {});
}

/* ═══════════════════════════════════════════════════════
   ALLOWED MIME TYPES
═══════════════════════════════════════════════════════ */
const ALLOWED_MIME = new Set([
  "application/pdf","application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/jpeg","image/png","image/gif","image/webp","image/svg+xml",
  "text/plain","text/csv",
  "application/zip","application/x-zip-compressed",
]);

const LEGAL_CATEGORIES = [
  "وكالة","عقد","حكم","مذكرة","لائحة_دعوى","محضر_جلسة",
  "تقرير_خبير","مستند_إفلاس","فاتورة","مستند_مالي",
  "هوية","سجل_تجاري","أخرى",
];

/* ═══════════════════════════════════════════════════════
   UPLOAD — رفع ملف جديد إلى Object Storage
═══════════════════════════════════════════════════════ */
router.post("/document-center/upload", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "";
    const {
      fileData, fileName, fileType,
      caseId, clientId, contractId,
      legalCategory, tags, uploadedByName,
      folder,
    } = req.body ?? {};

    if (!fileData || !fileName)
      return res.status(400).json({ error: "fileData و fileName مطلوبان" });

    const mime = fileType ?? "application/octet-stream";
    if (!ALLOWED_MIME.has(mime))
      return res.status(415).json({ error: `نوع الملف غير مدعوم: ${mime}` });

    if (typeof fileData === "string" && fileData.length > 20_000_000)
      return res.status(413).json({ error: "حجم الملف يتجاوز 15 MB" });

    const dest    = folder ?? (caseId ? `cases/${caseId}` : clientId ? `clients/${clientId}` : "general");
    const result  = await documentStorage.uploadBase64(fileData, officeId, fileName, mime, dest);

    const { rows } = await db.execute(sql`
      INSERT INTO document_center_files
        (office_id, source_table, source_id, storage_key, storage_provider,
         file_name, file_size, mime_type, checksum, legal_category, tags,
         case_id, client_id, contract_id, uploaded_by, uploaded_by_name)
      VALUES
        (${officeId}, 'document_center_files', ${result.storageKey},
         ${result.storageKey}, ${result.provider},
         ${fileName}, ${result.size}, ${mime}, ${result.checksum},
         ${legalCategory ?? "أخرى"}, ${tags ? `{${(tags as string[]).join(",")}}` : null},
         ${caseId ?? null}, ${clientId ?? null}, ${contractId ?? null},
         ${userId}, ${uploadedByName ?? ""})
      RETURNING id, file_name, file_size, mime_type, legal_category, created_at
    `);

    auditLog({
      ...auditMeta(req),
      action:     "upload",
      resource:   "document_center",
      resourceId: String((rows[0] as any)?.id ?? ""),
      details:    `${fileName} (${result.size} bytes) → ${result.storageKey}`,
    }).catch(() => {});

    res.status(201).json({ ...rows[0], storageKey: result.storageKey, checksum: result.checksum });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   SIGNED UPLOAD URL — رفع مباشر من المتصفح
═══════════════════════════════════════════════════════ */
router.post("/document-center/upload-url", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { fileName, fileType, folder } = req.body ?? {};
    if (!fileName) return res.status(400).json({ error: "fileName مطلوب" });

    const mime   = fileType ?? "application/octet-stream";
    const dest   = folder ?? "general";
    const result = await documentStorage.getUploadUrl(officeId, fileName, mime, dest);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   CONFIRM DIRECT UPLOAD — تسجيل ملف رُفع مباشرةً
═══════════════════════════════════════════════════════ */
router.post("/document-center/confirm-upload", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const userId   = (req as any).auth?.userId ?? "";
    const { storageKey, fileName, fileType, fileSize, checksum, caseId, clientId, legalCategory, uploadedByName } = req.body ?? {};
    if (!storageKey || !fileName) return res.status(400).json({ error: "storageKey و fileName مطلوبان" });

    const { rows } = await db.execute(sql`
      INSERT INTO document_center_files
        (office_id, source_table, source_id, storage_key, storage_provider,
         file_name, file_size, mime_type, checksum, legal_category,
         case_id, client_id, uploaded_by, uploaded_by_name)
      VALUES
        (${officeId}, 'document_center_files', ${storageKey},
         ${storageKey}, 'replit_object_storage',
         ${fileName}, ${fileSize ?? 0}, ${fileType ?? "application/octet-stream"},
         ${checksum ?? null}, ${legalCategory ?? "أخرى"},
         ${caseId ?? null}, ${clientId ?? null},
         ${userId}, ${uploadedByName ?? ""})
      RETURNING id, file_name, file_size, mime_type, legal_category, created_at
    `);
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   LIST — مكتبة المستندات
═══════════════════════════════════════════════════════ */
router.get("/document-center/files", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { category, caseId, clientId, search, archived, page, pageSize } = req.query as any;
    const limit  = Math.min(Number(pageSize ?? 50), 200);
    const offset = (Math.max(Number(page ?? 1), 1) - 1) * limit;

    const { rows } = await db.execute(sql`
      SELECT id, file_name, file_size, mime_type, legal_category, tags,
             case_id, client_id, contract_id, storage_provider, storage_key,
             uploaded_by, uploaded_by_name, is_archived, version, created_at
      FROM   document_center_files
      WHERE  office_id = ${officeId}
        AND  is_archived = ${archived === "true"}
        AND  (${category ?? null}::text IS NULL OR legal_category = ${category ?? null})
        AND  (${caseId ?? null}::text IS NULL OR case_id = ${caseId ?? null})
        AND  (${clientId ?? null}::text IS NULL OR client_id = ${clientId ?? null})
        AND  (${search ?? null}::text IS NULL OR file_name ILIKE ${"%" + (search ?? "") + "%"})
      ORDER BY created_at DESC
      LIMIT  ${limit} OFFSET ${offset}
    `);

    const { rows: countRows } = await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM document_center_files
      WHERE  office_id = ${officeId}
        AND  is_archived = ${archived === "true"}
        AND  (${category ?? null}::text IS NULL OR legal_category = ${category ?? null})
        AND  (${caseId ?? null}::text IS NULL OR case_id = ${caseId ?? null})
        AND  (${search ?? null}::text IS NULL OR file_name ILIKE ${"%" + (search ?? "") + "%"})
    `);

    res.json({ files: rows, total: (countRows[0] as any)?.total ?? 0, page: Number(page ?? 1), pageSize: limit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   DOWNLOAD — رابط تنزيل موقَّع
═══════════════════════════════════════════════════════ */
router.get("/document-center/files/:id/download", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };

    const { rows } = await db.execute(sql`
      SELECT storage_key, file_name, mime_type, storage_provider
      FROM   document_center_files
      WHERE  id = ${id} AND office_id = ${officeId}
      LIMIT  1
    `);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });

    const doc = rows[0] as any;
    if (doc.storage_provider === "db_base64" || !doc.storage_key) {
      return res.status(422).json({ error: "هذا الملف لم يُرحَّل بعد إلى Object Storage" });
    }

    const url = await documentStorage.getSignedUrl(doc.storage_key);
    auditLog({
      ...auditMeta(req),
      action: "download", resource: "document_center", resourceId: id,
      details: `${doc.file_name}`,
    }).catch(() => {});

    res.json({ url, fileName: doc.file_name, contentType: doc.mime_type });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   DELETE
═══════════════════════════════════════════════════════ */
router.delete("/document-center/files/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };

    const { rows } = await db.execute(sql`
      SELECT storage_key, file_name FROM document_center_files
      WHERE  id = ${id} AND office_id = ${officeId}
      LIMIT  1
    `);
    if (!rows.length) return res.status(404).json({ error: "الملف غير موجود" });

    const doc = rows[0] as any;
    if (doc.storage_key) {
      await documentStorage.deleteFile(doc.storage_key);
    }
    await db.execute(sql`DELETE FROM document_center_files WHERE id = ${id} AND office_id = ${officeId}`);

    auditLog({
      ...auditMeta(req),
      action: "delete", resource: "document_center", resourceId: id,
      details: doc.file_name,
    }).catch(() => {});

    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   ARCHIVE / UNARCHIVE
═══════════════════════════════════════════════════════ */
router.patch("/document-center/files/:id/archive", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };
    const { archive = true } = req.body ?? {};

    await db.execute(sql`
      UPDATE document_center_files
      SET    is_archived = ${!!archive}, updated_at = NOW()
      WHERE  id = ${id} AND office_id = ${officeId}
    `);
    res.json({ ok: true, archived: !!archive });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   UPDATE METADATA (category, tags)
═══════════════════════════════════════════════════════ */
router.patch("/document-center/files/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { id }   = req.params as { id: string };
    const { legalCategory, tags } = req.body ?? {};

    await db.execute(sql`
      UPDATE document_center_files
      SET    legal_category = COALESCE(${legalCategory ?? null}, legal_category),
             tags           = COALESCE(${tags ? `{${(tags as string[]).join(",")}}` : null}::text[], tags),
             updated_at     = NOW()
      WHERE  id = ${id} AND office_id = ${officeId}
    `);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   LEGAL CATEGORIES LIST
═══════════════════════════════════════════════════════ */
router.get("/document-center/categories", requireAuth, (_req, res) => {
  res.json(LEGAL_CATEGORIES);
});

/* ═══════════════════════════════════════════════════════
   STORAGE DASHBOARD — إحصاءات التخزين
═══════════════════════════════════════════════════════ */
router.get("/document-center/stats", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    const { rows: counts } = await db.execute(sql`
      SELECT
        COUNT(*)                                                         AS total_files,
        COUNT(*) FILTER (WHERE storage_provider = 'replit_object_storage') AS object_files,
        COUNT(*) FILTER (WHERE storage_provider = 'db_base64')          AS base64_files,
        COUNT(*) FILTER (WHERE is_archived = TRUE)                       AS archived_files,
        COALESCE(SUM(file_size), 0)                                      AS total_bytes,
        COALESCE(SUM(file_size) FILTER (WHERE storage_provider = 'replit_object_storage'), 0) AS object_bytes,
        legal_category
      FROM document_center_files
      WHERE office_id = ${officeId}
      GROUP BY legal_category
    `);

    const { rows: byDay } = await db.execute(sql`
      SELECT
        DATE_TRUNC('day', created_at)::date::text AS day,
        COUNT(*) AS count,
        SUM(file_size) AS bytes
      FROM document_center_files
      WHERE office_id = ${officeId}
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `);

    const { rows: migration } = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM   storage_migration_log
      WHERE  office_id = ${officeId}
      GROUP  BY status
    `);

    const totals = counts.reduce((acc: any, r: any) => {
      acc.totalFiles   = (acc.totalFiles   || 0) + Number(r.total_files);
      acc.objectFiles  = (acc.objectFiles  || 0) + Number(r.object_files);
      acc.base64Files  = (acc.base64Files  || 0) + Number(r.base64_files);
      acc.archivedFiles= (acc.archivedFiles|| 0) + Number(r.archived_files);
      acc.totalBytes   = (acc.totalBytes   || 0) + Number(r.total_bytes);
      acc.objectBytes  = (acc.objectBytes  || 0) + Number(r.object_bytes);
      return acc;
    }, {});

    const byCategory = counts
      .filter((r: any) => r.legal_category)
      .map((r: any) => ({
        category: r.legal_category,
        count:    Number(r.total_files),
        bytes:    Number(r.total_bytes),
      }));

    res.json({ ...totals, byCategory, byDay, migration });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   ADMIN STATS — للمشرف العام فقط
═══════════════════════════════════════════════════════ */
router.get("/document-center/admin/stats", requireAuth, isSuperAdminGuard, async (_req, res) => {
  try {
    const [objectStats, { rows: officeStats }] = await Promise.all([
      documentStorage.getTotalStorageStats(),
      db.execute(sql`
        SELECT office_id,
               COUNT(*)            AS total_files,
               SUM(file_size)      AS total_bytes,
               COUNT(*) FILTER (WHERE storage_provider = 'replit_object_storage') AS migrated
        FROM   document_center_files
        GROUP  BY office_id
        ORDER  BY total_bytes DESC
        LIMIT  50
      `),
    ]);
    res.json({ objectStorage: objectStats, byOffice: officeStats });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   MIGRATION WORKER — ترحيل Base64 → Object Storage
═══════════════════════════════════════════════════════ */
router.post("/document-center/migrate", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    const { batchSize = 10 } = req.body ?? {};
    const limit = Math.min(Number(batchSize), 50);

    // Get unmigrated documents from main documents table
    const { rows: docs } = await db.execute(sql`
      SELECT id, file_url, file_type, file_name, office_id
      FROM   documents
      WHERE  office_id = ${officeId}
        AND  storage_key IS NULL
        AND  file_url IS NOT NULL
        AND  file_url LIKE 'data:%'
      LIMIT  ${limit}
    `);

    if (docs.length === 0) {
      return res.json({ migrated: 0, message: "لا توجد ملفات تحتاج ترحيلاً" });
    }

    let migrated = 0;
    let failed   = 0;

    for (const doc of docs) {
      const d = doc as any;
      try {
        const mime   = d.file_type ?? "application/octet-stream";
        const name   = d.file_name ?? `file_${d.id}`;
        const result = await documentStorage.migrateBase64ToStorage(d.file_url, officeId, name, mime, "migrated");
        if (!result) { failed++; continue; }

        await db.execute(sql`
          UPDATE documents
          SET    storage_key      = ${result.storageKey},
                 storage_provider = ${result.provider},
                 checksum         = ${result.checksum},
                 migrated_at      = NOW()
          WHERE  id = ${d.id}
        `);

        await db.execute(sql`
          INSERT INTO storage_migration_log
            (office_id, table_name, record_id, new_key, file_size, checksum, status)
          VALUES
            (${officeId}, 'documents', ${String(d.id)}, ${result.storageKey}, ${result.size}, ${result.checksum}, 'done')
          ON CONFLICT DO NOTHING
        `);

        migrated++;
      } catch (err: any) {
        failed++;
        await db.execute(sql`
          INSERT INTO storage_migration_log
            (office_id, table_name, record_id, status, error_msg)
          VALUES
            (${officeId}, 'documents', ${String(d.id)}, 'error', ${err.message})
          ON CONFLICT DO NOTHING
        `).catch(() => {});
        logger.warn({ err: err.message, docId: d.id }, "Migration failed for doc");
      }
    }

    res.json({ migrated, failed, total: docs.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   MIGRATION STATUS
═══════════════════════════════════════════════════════ */
router.get("/document-center/migrate/status", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    const { rows: total } = await db.execute(sql`
      SELECT
        COUNT(*)                                          AS total,
        COUNT(*) FILTER (WHERE storage_key IS NOT NULL)  AS migrated,
        COUNT(*) FILTER (WHERE storage_key IS NULL AND file_url LIKE 'data:%') AS pending,
        COALESCE(SUM(file_size), 0)                       AS total_bytes
      FROM documents WHERE office_id = ${officeId}
    `);

    const { rows: log } = await db.execute(sql`
      SELECT status, COUNT(*) AS count
      FROM   storage_migration_log
      WHERE  office_id = ${officeId}
      GROUP  BY status
    `);

    res.json({ ...total[0], migrationLog: log });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ═══════════════════════════════════════════════════════
   STORAGE AUDIT REPORT
═══════════════════════════════════════════════════════ */
router.get("/document-center/audit-report", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;

    const { rows } = await db.execute(sql`
      SELECT
        source_table,
        storage_provider,
        COUNT(*)            AS file_count,
        SUM(file_size)      AS total_bytes,
        AVG(file_size)      AS avg_bytes,
        MAX(file_size)      AS max_bytes,
        MIN(created_at)     AS oldest,
        MAX(created_at)     AS newest
      FROM document_center_files
      WHERE office_id = ${officeId}
      GROUP BY source_table, storage_provider
      ORDER BY total_bytes DESC
    `);

    const { rows: top10 } = await db.execute(sql`
      SELECT id, file_name, file_size, mime_type, storage_provider, created_at
      FROM   document_center_files
      WHERE  office_id = ${officeId}
      ORDER  BY file_size DESC
      LIMIT  10
    `);

    res.json({ byTable: rows, top10LargestFiles: top10, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
