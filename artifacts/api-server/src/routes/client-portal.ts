import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";

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
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add new cols if missing (idempotent)
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_invoices BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS show_timeline BOOLEAN DEFAULT true`);
  await db.execute(sql`ALTER TABLE client_portal_tokens ADD COLUMN IF NOT EXISTS allowed_to_upload BOOLEAN DEFAULT false`);

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
      file_data TEXT,
      uploaded_at TIMESTAMPTZ DEFAULT NOW(),
      is_read BOOLEAN DEFAULT false
    )
  `);
}
ensureTables().catch(console.error);

// ─── helpers ─────────────────────────────────────────────────────────────────
function sqlOne(res: any) { return (res?.rows ?? res)?.[0] ?? null; }
function sqlAll(res: any) { return res?.rows ?? res ?? []; }

// ─── POST /portal/create-token ────────────────────────────────────────────────
router.post("/portal/create-token", async (req: Request, res: Response) => {
  try {
    const { caseId, clientEmail, clientName, expiryDays = 30,
            showInvoices = true, showTimeline = true, allowedToUpload = false } = req.body;
    if (!caseId) { res.status(400).json({ error: "caseId مطلوب" }); return; }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    await db.execute(sql`
      INSERT INTO client_portal_tokens
        (id, case_id, token, client_email, client_name, expires_at,
         show_invoices, show_timeline, allowed_to_upload, created_at)
      VALUES
        (${randomUUID()}, ${caseId}, ${token}, ${clientEmail ?? null}, ${clientName ?? null},
         ${expiresAt.toISOString()}, ${showInvoices}, ${showTimeline}, ${allowedToUpload}, NOW())
    `);

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    res.json({ token, url: `${baseUrl}/portal/${token}`, expiresAt });
  } catch (e: any) {
    console.error("portal/create-token:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/:token ───────────────────────────────────────────────────────
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
    const showInvoices   = portalRow.show_invoices !== false;
    const showTimeline   = portalRow.show_timeline !== false;
    const allowedUpload  = portalRow.allowed_to_upload === true;

    const [caseRows, invRows, docRows, timelineRows, uploadRows] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} LIMIT 1`),
      showInvoices
        ? db.execute(sql`SELECT * FROM invoices WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 10`)
        : Promise.resolve({ rows: [] }),
      db.execute(sql`SELECT id, file_name, file_type, file_size, created_at FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 20`),
      showTimeline
        ? db.execute(sql`SELECT * FROM case_timeline WHERE case_id = ${caseId} AND is_shared = true ORDER BY happened_at ASC`)
        : Promise.resolve({ rows: [] }),
      db.execute(sql`SELECT id, file_name, file_type, file_size, uploaded_at FROM portal_uploads WHERE portal_token = ${token} ORDER BY uploaded_at DESC`),
    ]);

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
router.get("/portal/tokens/:caseId", async (req: Request, res: Response) => {
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
router.delete("/portal/tokens/:id", async (req: Request, res: Response) => {
  try {
    await db.execute(sql`DELETE FROM client_portal_tokens WHERE id = ${req.params.id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /portal/tokens/:id/settings ─────────────────────────────────────────
router.put("/portal/tokens/:id/settings", async (req: Request, res: Response) => {
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

// ─── GET /portal/timeline/:caseId ─────────────────────────────────────────────
router.get("/portal/timeline/:caseId", async (req: Request, res: Response) => {
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
router.post("/portal/timeline/:caseId", async (req: Request, res: Response) => {
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

    // Auto-notify client if portal exists and has email
    if (isShared) {
      const pRows = await db.execute(sql`
        SELECT client_email, client_name FROM client_portal_tokens
        WHERE case_id = ${req.params.caseId} AND client_email IS NOT NULL
          AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `);
      const portal = sqlOne(pRows) as any;
      if (portal?.client_email) {
        // Fire-and-forget email notification
        try {
          await db.execute(sql`
            INSERT INTO email_logs (id, to_email, subject, body, status, created_at)
            VALUES (
              ${randomUUID()},
              ${portal.client_email},
              ${'تحديث جديد على قضيتك'},
              ${`مرحباً ${portal.client_name ?? ""}،\n\nيوجد تحديث جديد على قضيتك: ${title}${description ? "\n" + description : ""}\n\nيمكنك متابعة قضيتك عبر بوابة العميل.`},
              'sent',
              NOW()
            )
          `).catch(() => {});
        } catch {}
      }
    }

    res.json({ success: true, id });
  } catch (e: any) {
    console.error("portal/timeline POST:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/:token/upload ───────────────────────────────────────────────
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

    const MAX = 5 * 1024 * 1024; // 5MB in base64 chars ≈ 7MB
    if (fileData && fileData.length > MAX * 1.4) {
      res.status(413).json({ error: "حجم الملف يتجاوز 5 ميغابايت" }); return;
    }

    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO portal_uploads (id, portal_token, case_id, file_name, file_size, file_type, file_data, uploaded_at)
      VALUES (${id}, ${token}, ${portalRow.case_id}, ${fileName}, ${fileSize ?? null}, ${fileType ?? null}, ${fileData ?? null}, NOW())
    `);

    // Add timeline event for the upload
    await db.execute(sql`
      INSERT INTO case_timeline (id, case_id, entry_type, title, description, happened_at, is_shared, created_by, created_at)
      VALUES (
        ${randomUUID()}, ${portalRow.case_id}, 'upload',
        ${'مستند مرفوع من العميل'}, ${`رفع العميل المستند: ${fileName}`},
        NOW(), false, 'client', NOW()
      )
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
  } catch (e: any) {
    res.json([]);
  }
});

// ─── POST /portal/:token/message ──────────────────────────────────────────────
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
