import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { requireAuth } from "../middlewares/requireAuth";
import nodemailer from "nodemailer";
import { objectStorageClient, parseObjectPath } from "../lib/objectStorage";

const router = Router();

// ─── ensureTables ─────────────────────────────────────────────────────────────
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS client_portal_tokens (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      client_email TEXT,
      client_name TEXT,
      expires_at TIMESTAMPTZ,
      last_accessed TIMESTAMPTZ,
      access_count INTEGER DEFAULT 0,
      show_invoices BOOLEAN DEFAULT true,
      show_timeline BOOLEAN DEFAULT true,
      allowed_to_upload BOOLEAN DEFAULT false,
      shared_documents JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_invoices BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_timeline BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS allowed_to_upload BOOLEAN DEFAULT false`);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS shared_documents JSONB DEFAULT '[]'`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS case_timeline (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      entry_type TEXT NOT NULL DEFAULT 'note',
      title TEXT NOT NULL,
      description TEXT,
      happened_at TIMESTAMPTZ DEFAULT NOW(),
      is_shared BOOLEAN DEFAULT true,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS portal_uploads (
      id TEXT PRIMARY KEY,
      portal_token TEXT NOT NULL,
      case_id TEXT,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      file_path TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      is_read BOOLEAN DEFAULT false
    )
  `);
}
ensureTables().catch(console.error);

// ─── helpers ─────────────────────────────────────────────────────────────────
function sqlOne(res: any) { return (res?.rows ?? res)?.[0] ?? null; }
function sqlAll(res: any) { return res?.rows ?? res ?? []; }

function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
}

async function notifyClientByEmail(clientEmail: string, clientName: string | null, title: string, description: string | null, portalUrl: string) {
  const transporter = getEmailTransporter();
  if (!transporter) return; // SMTP not configured — skip silently
  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  const greeting = clientName ? `مرحباً ${clientName}،` : "مرحباً،";
  const html = `
    <div dir="rtl" style="font-family:'Cairo',Arial,sans-serif;line-height:1.8;color:#111;max-width:600px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#1a2b3c;font-size:20px;border-bottom:2px solid #C9A84C;padding-bottom:12px">تحديث جديد على قضيتك</h2>
      <p>${greeting}</p>
      <p>يوجد تحديث جديد على قضيتك في مكتب المحاماة:</p>
      <div style="background:#f8f9fa;border-right:4px solid #C9A84C;padding:16px;border-radius:8px;margin:16px 0">
        <strong>${title}</strong>
        ${description ? `<p style="margin:8px 0 0;color:#555;font-size:14px">${description}</p>` : ""}
      </div>
      <a href="${portalUrl}" style="display:inline-block;background:#C9A84C;color:#0d1b2a;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
        عرض بوابتك الإلكترونية
      </a>
      <hr style="margin-top:32px;border-color:#e5e7eb"/>
      <p style="color:#9ca3af;font-size:12px;text-align:center">منصة عدالة AI — نظام التشغيل القانوني</p>
    </div>`;
  try {
    await transporter.sendMail({
      from: `"مكتب المحاماة" <${from}>`,
      to: clientName ? `"${clientName}" <${clientEmail}>` : clientEmail,
      subject: `تحديث على قضيتك: ${title}`,
      text: `${greeting}\nيوجد تحديث جديد: ${title}${description ? "\n" + description : ""}\n\nعرض بوابتك: ${portalUrl}`,
      html,
    });
  } catch (e) {
    console.error("Portal email notification failed:", e);
    // Non-fatal — log and continue
  }
}

// ─── POST /portal/create-token ────────────────────────────────────────────────
router.post("/portal/create-token", requireAuth, async (req: Request, res: Response) => {
  try {
    const { caseId, clientEmail, clientName, expiryDays = 30,
            showInvoices = true, showTimeline = true, allowedToUpload = false } = req.body;
    if (!caseId) { res.status(400).json({ error: "caseId مطلوب" }); return; }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    await db.execute(sql`
      INSERT INTO client_portal_tokens
        (id, case_id, token, client_email, client_name, expires_at,
         show_invoices, show_timeline, allowed_to_upload, shared_documents, created_at)
      VALUES
        (${randomUUID()}, ${caseId}, ${token}, ${clientEmail ?? null}, ${clientName ?? null},
         ${expiresAt.toISOString()}, ${showInvoices}, ${showTimeline}, ${allowedToUpload}, '[]', NOW())
    `);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({ token, url: `${baseUrl}/portal/${token}`, expiresAt });
  } catch (e: any) {
    console.error("portal/create-token:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/:token (PUBLIC — client-facing) ──────────────────────────────
router.get("/portal/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const pRows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = sqlOne(pRows) as any;
    if (!portalRow) { res.status(404).json({ error: "رابط البوابة غير صالح" }); return; }
    if (portalRow.expires_at && new Date(portalRow.expires_at) < new Date()) {
      res.status(410).json({ error: "انتهت صلاحية الرابط" }); return;
    }

    await db.execute(sql`
      UPDATE client_portal_tokens SET access_count = access_count + 1, last_accessed = NOW() WHERE token = ${token}
    `);

    const caseId = portalRow.case_id;
    const showInvoices  = portalRow.show_invoices !== false;
    const showTimeline  = portalRow.show_timeline !== false;
    const allowedUpload = portalRow.allowed_to_upload === true;
    // shared_documents: array of document IDs explicitly shared with this client
    const sharedDocIds: string[] = Array.isArray(portalRow.shared_documents)
      ? portalRow.shared_documents
      : (typeof portalRow.shared_documents === "string" ? JSON.parse(portalRow.shared_documents || "[]") : []);

    const [caseRows, invRows, timelineRows, uploadRows] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} LIMIT 1`),
      showInvoices
        ? db.execute(sql`SELECT * FROM client_invoices WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 10`)
        : Promise.resolve({ rows: [] }),
      showTimeline
        ? db.execute(sql`SELECT * FROM case_timeline WHERE case_id = ${caseId} AND is_shared = true ORDER BY happened_at ASC`)
        : Promise.resolve({ rows: [] }),
      db.execute(sql`SELECT id, file_name, file_type, file_size, uploaded_at FROM portal_uploads WHERE portal_token = ${token} ORDER BY uploaded_at DESC`),
    ]);

    // Only return explicitly shared documents
    let docRows: any = { rows: [] };
    if (sharedDocIds.length > 0) {
      docRows = await db.execute(sql`
        SELECT id, file_name, file_type, file_size, created_at
        FROM documents
        WHERE case_id = ${caseId} AND id = ANY(${sql.raw(`ARRAY[${sharedDocIds.map(id => `'${id.replace(/'/g, "''")}'`).join(",")}]::text[]`)})
        ORDER BY created_at DESC
      `);
    }

    const caseData = sqlOne(caseRows) as any;
    if (!caseData) { res.status(404).json({ error: "القضية غير موجودة" }); return; }

    res.json({
      portal: {
        clientName: portalRow.client_name,
        clientEmail: portalRow.client_email,
        expiresAt: portalRow.expires_at,
        showInvoices,
        showTimeline,
        allowedToUpload: allowedUpload,
      },
      case: {
        id: caseData.id,
        title: caseData.title,
        caseType: caseData.case_type ?? caseData.caseType,
        status: caseData.status,
        clientName: caseData.client_name ?? caseData.clientName,
        description: caseData.description,
        createdAt: caseData.created_at ?? caseData.createdAt,
      },
      invoices: sqlAll(invRows),
      documents: sqlAll(docRows),
      timeline: sqlAll(timelineRows),
      uploads: sqlAll(uploadRows),
    });
  } catch (e: any) {
    console.error("portal/:token:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/tokens/:caseId ───────────────────────────────────────────────
router.get("/portal/tokens/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM client_portal_tokens WHERE case_id = ${req.params.caseId} ORDER BY created_at DESC
    `);
    res.json(sqlAll(rows));
  } catch {
    res.json([]);
  }
});

// ─── DELETE /portal/tokens/:id ────────────────────────────────────────────────
router.delete("/portal/tokens/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM client_portal_tokens WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /portal/tokens/:id/settings ─────────────────────────────────────────
router.put("/portal/tokens/:id/settings", requireAuth, async (req: Request, res: Response) => {
  try {
    const { showInvoices, showTimeline, allowedToUpload } = req.body;
    await db.execute(sql`
      UPDATE client_portal_tokens
      SET show_invoices = ${showInvoices ?? true},
          show_timeline = ${showTimeline ?? true},
          allowed_to_upload = ${allowedToUpload ?? false}
      WHERE id = ${req.params.id}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/tokens/:id/share-doc ───────────────────────────────────────
// Add a document ID to the shared_documents list for this portal token
router.post("/portal/tokens/:id/share-doc", requireAuth, async (req: Request, res: Response) => {
  try {
    const { docId } = req.body;
    if (!docId) { res.status(400).json({ error: "docId مطلوب" }); return; }

    const rows = await db.execute(sql`SELECT shared_documents FROM client_portal_tokens WHERE id = ${req.params.id}`);
    const row = sqlOne(rows) as any;
    if (!row) { res.status(404).json({ error: "رابط غير موجود" }); return; }

    const current: string[] = Array.isArray(row.shared_documents)
      ? row.shared_documents
      : JSON.parse(row.shared_documents || "[]");

    if (!current.includes(docId)) {
      current.push(docId);
      await db.execute(sql`
        UPDATE client_portal_tokens SET shared_documents = ${JSON.stringify(current)}::jsonb WHERE id = ${req.params.id}
      `);
    }
    res.json({ success: true, sharedDocuments: current });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /portal/tokens/:id/share-doc/:docId ───────────────────────────────
router.delete("/portal/tokens/:id/share-doc/:docId", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`SELECT shared_documents FROM client_portal_tokens WHERE id = ${req.params.id}`);
    const row = sqlOne(rows) as any;
    if (!row) { res.status(404).json({ error: "رابط غير موجود" }); return; }

    const current: string[] = Array.isArray(row.shared_documents)
      ? row.shared_documents
      : JSON.parse(row.shared_documents || "[]");
    const updated = current.filter(id => id !== req.params.docId);
    await db.execute(sql`
      UPDATE client_portal_tokens SET shared_documents = ${JSON.stringify(updated)}::jsonb WHERE id = ${req.params.id}
    `);
    res.json({ success: true, sharedDocuments: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/timeline/:caseId ─────────────────────────────────────────────
router.get("/portal/timeline/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM case_timeline WHERE case_id = ${req.params.caseId} ORDER BY happened_at ASC
    `);
    res.json(sqlAll(rows));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/timeline/:caseId ────────────────────────────────────────────
router.post("/portal/timeline/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { title, description, entryType = "note", happenedAt, isShared = true } = req.body;
    if (!title) { res.status(400).json({ error: "العنوان مطلوب" }); return; }
    const auth = getAuth(req);
    const id = randomUUID();

    await db.execute(sql`
      INSERT INTO case_timeline (id, case_id, entry_type, title, description, happened_at, is_shared, created_by, created_at)
      VALUES (
        ${id}, ${req.params.caseId}, ${entryType}, ${title}, ${description ?? null},
        ${happenedAt ?? new Date().toISOString()}, ${isShared}, ${auth.userId ?? "system"}, NOW()
      )
    `);

    // Send real email notification if shared and client has email
    if (isShared) {
      try {
        const pRows = await db.execute(sql`
          SELECT client_email, client_name, token FROM client_portal_tokens
          WHERE case_id = ${req.params.caseId} AND client_email IS NOT NULL
            AND (expires_at IS NULL OR expires_at > NOW())
          LIMIT 1
        `);
        const portal = sqlOne(pRows) as any;
        if (portal?.client_email) {
          const baseUrl = `${req.protocol}://${req.get("host")}`;
          const portalUrl = `${baseUrl}/portal/${portal.token}`;
          // Fire-and-forget — don't block the response
          notifyClientByEmail(portal.client_email, portal.client_name, title, description ?? null, portalUrl).catch(() => {});
        }
      } catch { /* non-fatal */ }
    }

    res.json({ success: true, id });
  } catch (e: any) {
    console.error("portal/timeline POST:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/:token/upload (PUBLIC — client-facing) ─────────────────────
router.post("/portal/:token/upload", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { fileName, fileType, fileSize, fileData } = req.body;

    const pRows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = sqlOne(pRows) as any;
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }
    if (!portalRow.allowed_to_upload) { res.status(403).json({ error: "رفع الملفات غير مسموح لهذه البوابة" }); return; }
    if (portalRow.expires_at && new Date(portalRow.expires_at) < new Date()) {
      res.status(410).json({ error: "انتهت صلاحية الرابط" }); return;
    }

    const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif",
      "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (fileType && !ALLOWED_TYPES.some(t => fileType.startsWith(t.split("/")[0]))) {
      res.status(400).json({ error: "نوع الملف غير مسموح. يُسمح بـ PDF والصور ومستندات Word فقط" }); return;
    }

    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    if (fileSize && Number(fileSize) > MAX_BYTES) {
      res.status(413).json({ error: "حجم الملف يتجاوز 5 ميغابايت" }); return;
    }

    const id = randomUUID();
    let storedPath: string | null = null;

    // Upload to Object Storage if configured
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (privateDir && fileData) {
      try {
        const buffer = Buffer.from(fileData, "base64");
        if (buffer.length > MAX_BYTES) {
          res.status(413).json({ error: "حجم الملف يتجاوز 5 ميغابايت" }); return;
        }
        const objectPath = `${privateDir}/portal-uploads/${id}`;
        const { bucketName, objectName } = parseObjectPath(objectPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const file = bucket.file(objectName);
        await file.save(buffer, { metadata: { contentType: fileType ?? "application/octet-stream" } });
        storedPath = objectPath;
      } catch (storageErr) {
        console.error("Object storage upload failed:", storageErr);
        res.status(500).json({ error: "فشل رفع الملف لمنظومة التخزين" }); return;
      }
    } else if (!privateDir) {
      res.status(503).json({ error: "منظومة التخزين غير مضبوطة (PRIVATE_OBJECT_DIR)" }); return;
    }

    await db.execute(sql`
      INSERT INTO portal_uploads (id, portal_token, case_id, file_name, file_size, file_type, file_path, uploaded_at)
      VALUES (${id}, ${token}, ${portalRow.case_id}, ${fileName ?? "ملف"}, ${fileSize ?? null}, ${fileType ?? null}, ${storedPath}, NOW())
    `);

    // Internal timeline note (not shared with client)
    await db.execute(sql`
      INSERT INTO case_timeline (id, case_id, entry_type, title, description, happened_at, is_shared, created_by, created_at)
      VALUES (${randomUUID()}, ${portalRow.case_id}, 'upload', ${'مستند من العميل'}, ${`رفع العميل: ${fileName}`}, NOW(), false, 'client', NOW())
    `);

    res.json({ success: true, id });
  } catch (e: any) {
    console.error("portal/:token/upload:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/:token/uploads ───────────────────────────────────────────────
router.get("/portal/:token/uploads", async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, file_name, file_type, file_size, uploaded_at, is_read
      FROM portal_uploads WHERE portal_token = ${req.params.token} ORDER BY uploaded_at DESC
    `);
    res.json(sqlAll(rows));
  } catch {
    res.json([]);
  }
});

// ─── POST /portal/:token/message (PUBLIC — client-facing) ─────────────────────
router.post("/portal/:token/message", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { message, senderName, senderEmail } = req.body;
    const rows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = sqlOne(rows) as any;
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }

    await db.execute(sql`
      INSERT INTO messages (id, channel, direction, sender_name, sender_email, content, case_id, created_at)
      VALUES (${randomUUID()}, 'portal', 'inbound', ${senderName ?? 'عميل'}, ${senderEmail ?? null}, ${message}, ${portalRow.case_id}, NOW())
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
