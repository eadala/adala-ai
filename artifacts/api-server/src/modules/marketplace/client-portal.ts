import { requireAuth, checkIsSuperAdmin} from "../../middlewares/requireAuth";
import { resolveTenantId } from "../../middlewares/tenantMiddleware";
import { writeClientCommSettings } from "../../lib/clientCommSettingsWrite";
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/express";
import nodemailer from "nodemailer";
import { getStorageProvider, isObjectStorageConfigured, entityIdToObjectKey, getObjectStorageBucket } from "../../core/storage";
import { validateUpload } from "../../lib/uploadGuard";
import { logEndpointError } from "../../lib/endpointErrorLog";

const router = Router();

/** SELECT-only readiness — schema owned by Migration 038. */
async function ensureClientPortalTablesReady() {
  const r = await db.execute(sql`
    SELECT
      to_regclass('public.client_portal_tokens') IS NOT NULL AS tokens,
      to_regclass('public.case_timeline') IS NOT NULL AS timeline,
      to_regclass('public.portal_uploads') IS NOT NULL AS uploads
  `).catch(() => ({ rows: [{}] }));
  const row = ((r as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
  if (!row.tokens || !row.timeline || !row.uploads) {
    console.error(
      "[client-portal] Migration 038 schema not ready — portal/timeline/uploads tables missing",
    );
  }
}
ensureClientPortalTablesReady().catch(console.error);

// ─── helpers ─────────────────────────────────────────────────────────────────
function sqlOne(res: any) { return (res?.rows ?? res)?.[0] ?? null; }
function sqlAll(res: any) { return res?.rows ?? res ?? []; }

// ─── Permission helpers ───────────────────────────────────────────────────────
let _clerkPortal: ReturnType<typeof createClerkClient> | null = null;
const getClerkPortal = () => {
  if (!_clerkPortal) _clerkPortal = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  return _clerkPortal;
};

const DEFAULT_COMM_ROLES: Record<string, string[]> = {
  reply:    ["firm_owner", "office_manager", "lawyer", "secretary"],
  portal:   ["firm_owner", "office_manager", "lawyer"],
  timeline: ["firm_owner", "office_manager", "lawyer"],
  intake:   ["firm_owner", "office_manager", "lawyer"],
};

/**
 * officeId is ALWAYS derived via the canonical resolveTenantId()
 * (membership-validated) — it must NEVER fall back to the Clerk user id.
 * Returns null (fail closed) when no tenant can be resolved; the calling
 * route then denies the request using its existing error response.
 */
async function getOfficeUser(req: any) {
  let userId: string | null = null;
  if (process.env.ADALA_HTTP_SECURITY_TEST === "1"
      && req.headers?.["x-adala-test-auth"] === process.env.ADALA_TEST_AUTH_SECRET
      && typeof req.headers?.["x-adala-test-user"] === "string") {
    userId = req.headers["x-adala-test-user"];
  } else {
    try {
      const auth = getAuth(req);
      userId = auth?.userId ?? null;
    } catch { userId = null; }
  }
  if (!userId) return null;
  try {
    const headerTenant = req.headers?.["x-tenant-id"] as string | undefined;
    const officeId = await resolveTenantId(userId, headerTenant);
    if (!officeId) return null; // fail closed — never substitute auth.userId
    const mRows = sqlAll(await db.execute(sql`SELECT role FROM office_members WHERE user_id=${userId} AND office_id=${officeId} AND status='active' LIMIT 1`));
    let email = "";
    let metaRole: string | undefined;
    let isSA = false;
    if (process.env.ADALA_HTTP_SECURITY_TEST === "1" && req.headers?.["x-adala-test-auth"]) {
      email = `${userId}@synthetic.adala.test`;
      isSA = false;
    } else {
      const user = await getClerkPortal().users.getUser(userId);
      email = user.emailAddresses.find((e: any) => e.id === user.primaryEmailAddressId)?.emailAddress ?? "";
      metaRole = user.publicMetadata?.role as string | undefined;
      isSA = await checkIsSuperAdmin(userId);
    }
    const officeRole: string = mRows[0]?.role ?? metaRole ?? "lawyer";
    const isAdmin = isSA || officeRole === "firm_owner" || officeRole === "office_owner" || officeRole === "office_manager";
    return { userId, officeId, email, isSA, officeRole, isAdmin };
  } catch { return null; }
}

async function checkCommPerm(u: NonNullable<Awaited<ReturnType<typeof getOfficeUser>>>, action: string): Promise<boolean> {
  if (u.isAdmin || u.isSA) return true;
  try {
    const rows = sqlAll(await db.execute(sql`SELECT reply_roles, portal_roles, timeline_roles, intake_roles FROM client_comm_settings WHERE office_id=${u.officeId}`));
    const s = rows[0];
    if (!s) return (DEFAULT_COMM_ROLES[action] ?? []).includes(u.officeRole);
    const col = action + "_roles";
    const allowed: string[] = s[col] ?? DEFAULT_COMM_ROLES[action] ?? [];
    return allowed.includes(u.officeRole);
  } catch { return (DEFAULT_COMM_ROLES[action] ?? []).includes(u.officeRole); }
}

export function getEmailTransporter() {
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
        // Non-fatal — log and continue
  }
}

// ─── POST /portal/create-token ─── requires: portal perm ─────────────────────
router.post("/portal/create-token", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "portal")) {
    res.status(403).json({ error: "ليس لديك صلاحية إنشاء بوابة العملاء — تواصل مع مدير المكتب", code: "NO_PORTAL_PERM" }); return;
  }
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
        res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/:token (PUBLIC — client-facing) ──────────────────────────────
router.get("/portal/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params as Record<string, string>;
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
    const tenantForPortal = portalRow.office_id ? String(portalRow.office_id) : null;
    const showInvoices  = portalRow.show_invoices !== false;
    const showTimeline  = portalRow.show_timeline !== false;
    const allowedUpload = portalRow.allowed_to_upload === true;
    // shared_documents: array of document IDs explicitly shared with this client
    const sharedDocIds: string[] = Array.isArray(portalRow.shared_documents)
      ? portalRow.shared_documents
      : (typeof portalRow.shared_documents === "string" ? JSON.parse(portalRow.shared_documents || "[]") : []);

    /* Single connection + transaction so FORCE RLS sees tenant GUC for all portal reads */
    const { pool } = await import("@workspace/db");
    const client = await pool.connect();
    let caseData: any = null;
    let invRows: any = { rows: [] };
    let timelineRows: any = { rows: [] };
    let uploadRows: any = { rows: [] };
    let apptRows: any = { rows: [] };
    let msgRows: any = { rows: [] };
    let docRows: any = { rows: [] };
    try {
      await client.query("BEGIN");
      if (tenantForPortal) {
        await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantForPortal]);
        await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [tenantForPortal]);
      }
      const caseRes = await client.query(`SELECT * FROM cases WHERE id = $1 LIMIT 1`, [caseId]);
      caseData = caseRes.rows[0] ?? null;
      if (showInvoices) {
        invRows = await client.query(
          `SELECT * FROM client_invoices WHERE case_id = $1 ORDER BY created_at DESC LIMIT 10`,
          [caseId],
        );
      }
      if (showTimeline) {
        timelineRows = await client.query(
          `SELECT * FROM case_timeline WHERE case_id = $1 AND is_shared = true ORDER BY happened_at ASC`,
          [caseId],
        ).catch(() => ({ rows: [] }));
      }
      uploadRows = await client.query(
        `SELECT id, file_name, file_type, file_size, uploaded_at FROM portal_uploads WHERE portal_token = $1 ORDER BY uploaded_at DESC`,
        [token],
      ).catch(() => ({ rows: [] }));
      apptRows = await client.query(
        `SELECT id, title, event_type, start_at, end_at, location, status, description
         FROM events
         WHERE case_id = $1 AND client_visible = TRUE AND status IS DISTINCT FROM 'cancelled'
         ORDER BY start_at ASC LIMIT 50`,
        [caseId],
      ).catch(() => ({ rows: [] }));
      msgRows = await client.query(
        `SELECT id, direction, sender_name, content, created_at, read_at
         FROM messages WHERE case_id = $1 AND channel = 'portal'
         ORDER BY created_at ASC LIMIT 100`,
        [caseId],
      ).catch(() => ({ rows: [] }));
      if (sharedDocIds.length > 0) {
        docRows = await client.query(
          `SELECT id, file_name, file_type, file_size, created_at
           FROM documents
           WHERE case_id = $1 AND id::text = ANY(string_to_array($2, ','))
           ORDER BY created_at DESC`,
          [caseId, sharedDocIds.join(",")],
        ).catch(() => ({ rows: [] }));
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }

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
      appointments: sqlAll(apptRows),
      messages: sqlAll(msgRows),
    });
  } catch (e: any) {
    logEndpointError("GET /api/portal/:token", req, e, { portalToken: req.params.token });
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/tokens/:caseId ───────────────────────────────────────────────
router.get("/portal/tokens/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT * FROM client_portal_tokens WHERE case_id = ${String(req.params.caseId)} ORDER BY created_at DESC
    `);
    res.json(sqlAll(rows));
  } catch {
    res.json([]);
  }
});

// ─── DELETE /portal/tokens/:id ─── requires: portal perm ─────────────────────
router.delete("/portal/tokens/:id", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "portal")) {
    res.status(403).json({ error: "ليس لديك صلاحية إلغاء بوابة العملاء", code: "NO_PORTAL_PERM" }); return;
  }
  try {
    await db.execute(sql`DELETE FROM client_portal_tokens WHERE id = ${String(req.params.id)}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /portal/tokens/:id/settings ─── requires: portal perm ───────────────
router.put("/portal/tokens/:id/settings", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "portal")) {
    res.status(403).json({ error: "ليس لديك صلاحية تعديل إعدادات البوابة", code: "NO_PORTAL_PERM" }); return;
  }
  try {
    const { showInvoices, showTimeline, allowedToUpload } = req.body;
    await db.execute(sql`
      UPDATE client_portal_tokens
      SET show_invoices = ${showInvoices ?? true},
          show_timeline = ${showTimeline ?? true},
          allowed_to_upload = ${allowedToUpload ?? false}
      WHERE id = ${String(req.params.id)}
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/tokens/:id/share-doc ─── requires: reply perm ──────────────
router.post("/portal/tokens/:id/share-doc", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "reply")) {
    res.status(403).json({ error: "ليس لديك صلاحية مشاركة مستندات مع العملاء", code: "NO_REPLY_PERM" }); return;
  }
  try {
    const { docId } = req.body;
    if (!docId) { res.status(400).json({ error: "docId مطلوب" }); return; }

    const rows = await db.execute(sql`SELECT shared_documents FROM client_portal_tokens WHERE id = ${String(req.params.id)}`);
    const row = sqlOne(rows) as any;
    if (!row) { res.status(404).json({ error: "رابط غير موجود" }); return; }

    const current: string[] = Array.isArray(row.shared_documents)
      ? row.shared_documents
      : JSON.parse(row.shared_documents || "[]");

    if (!current.includes(docId)) {
      current.push(docId);
      await db.execute(sql`
        UPDATE client_portal_tokens SET shared_documents = ${JSON.stringify(current)}::jsonb WHERE id = ${String(req.params.id)}
      `);
    }
    res.json({ success: true, sharedDocuments: current });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /portal/tokens/:id/share-doc/:docId ─── requires: reply perm ──────
router.delete("/portal/tokens/:id/share-doc/:docId", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "reply")) {
    res.status(403).json({ error: "ليس لديك صلاحية إدارة مشاركة المستندات", code: "NO_REPLY_PERM" }); return;
  }
  try {
    const rows = await db.execute(sql`SELECT shared_documents FROM client_portal_tokens WHERE id = ${String(req.params.id)}`);
    const row = sqlOne(rows) as any;
    if (!row) { res.status(404).json({ error: "رابط غير موجود" }); return; }

    const current: string[] = Array.isArray(row.shared_documents)
      ? row.shared_documents
      : JSON.parse(row.shared_documents || "[]");
    const updated = current.filter(id => id !== String(req.params.docId));
    await db.execute(sql`
      UPDATE client_portal_tokens SET shared_documents = ${JSON.stringify(updated)}::jsonb WHERE id = ${String(req.params.id)}
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
      SELECT * FROM case_timeline WHERE case_id = ${String(req.params.caseId)} ORDER BY happened_at ASC
    `);
    res.json(sqlAll(rows));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/timeline/:caseId ─── requires: timeline perm ────────────────
router.post("/portal/timeline/:caseId", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  const { isShared: isSharedCheck = true } = req.body;
  // Only enforce if the entry will be shared with the client
  if (isSharedCheck && !await checkCommPerm(u, "timeline")) {
    res.status(403).json({ error: "ليس لديك صلاحية إرسال تحديثات للعملاء", code: "NO_TIMELINE_PERM" }); return;
  }
  try {
    const { title, description, entryType = "note", happenedAt, isShared = true } = req.body;
    if (!title) { res.status(400).json({ error: "العنوان مطلوب" }); return; }
    const auth = getAuth(req);
    const id = randomUUID();

    await db.execute(sql`
      INSERT INTO case_timeline (id, case_id, entry_type, title, description, happened_at, is_shared, created_by, created_at)
      VALUES (
        ${id}, ${String(req.params.caseId)}, ${entryType}, ${title}, ${description ?? null},
        ${happenedAt ?? new Date().toISOString()}, ${isShared}, ${auth.userId ?? "system"}, NOW()
      )
    `);

    // Send real email notification if shared and client has email
    if (isShared) {
      try {
        const pRows = await db.execute(sql`
          SELECT client_email, client_name, token FROM client_portal_tokens
          WHERE case_id = ${String(req.params.caseId)} AND client_email IS NOT NULL
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
        res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/:token/upload (PUBLIC — client-facing) ─────────────────────
router.post("/portal/:token/upload", async (req: Request, res: Response) => {
  try {
    const { token } = req.params as Record<string, string>;
    const { fileName, fileType, fileSize, fileData } = req.body;

    const pRows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = sqlOne(pRows) as any;
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }
    if (!portalRow.allowed_to_upload) { res.status(403).json({ error: "رفع الملفات غير مسموح لهذه البوابة" }); return; }
    if (portalRow.expires_at && new Date(portalRow.expires_at) < new Date()) {
      res.status(410).json({ error: "انتهت صلاحية الرابط" }); return;
    }

    /* ── uploadGuard: unified security validation ── */
    if (fileData) {
      const guardResult = validateUpload({
        fileData,
        fileName: fileName ?? "uploaded_file",
        fileType,
        context: "portal",
      });
      if (!guardResult.ok) {
        res.status(guardResult.status ?? 400).json({ error: guardResult.error }); return;
      }
    }

    const id = randomUUID();
    let storedPath: string | null = null;

    // Upload to Object Storage if configured
    if (isObjectStorageConfigured() && fileData) {
      try {
        const buffer = Buffer.from(
          fileData.includes(",") ? fileData.split(",")[1] : fileData,
          "base64"
        );
        const MAX_BYTES = 5 * 1024 * 1024;
        if (buffer.length > MAX_BYTES) {
          res.status(413).json({ error: "حجم الملف يتجاوز 5 ميغابايت" }); return;
        }
        const key = entityIdToObjectKey(`portal-uploads/${id}`);
        await getStorageProvider().putObject(key, buffer, {
          contentType: fileType ?? "application/octet-stream",
        });
        storedPath = `/${getObjectStorageBucket()}/${key}`;
      } catch (storageErr) {
                res.status(500).json({ error: "فشل رفع الملف لمنظومة التخزين" }); return;
      }
    } else if (!isObjectStorageConfigured()) {
      res.status(503).json({ error: "منظومة التخزين غير مضبوطة (R2)" }); return;
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
        res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/uploads/:caseId — lawyer view of client uploads ──────────────
router.get("/portal/uploads/:caseId", requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT pu.id, pu.file_name, pu.file_type, pu.file_size, pu.uploaded_at,
             pu.is_read, pu.file_data, cpt.client_name, cpt.token
      FROM portal_uploads pu
      JOIN client_portal_tokens cpt ON cpt.token = pu.portal_token
      WHERE cpt.case_id = ${String(req.params.caseId)}
      ORDER BY pu.uploaded_at DESC
    `);
    res.json(sqlAll(rows));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/:token/uploads ───────────────────────────────────────────────
router.get("/portal/:token/uploads", async (req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT id, file_name, file_type, file_size, uploaded_at, is_read
      FROM portal_uploads WHERE portal_token = ${String(req.params.token)} ORDER BY uploaded_at DESC
    `);
    res.json(sqlAll(rows));
  } catch {
    res.json([]);
  }
});

// ─── POST /portal/:token/message (PUBLIC — client-facing) ─────────────────────
router.post("/portal/:token/message", async (req: Request, res: Response) => {
  try {
    const { token } = req.params as Record<string, string>;
    const { message, senderName, senderEmail } = req.body;
    const rows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = sqlOne(rows) as any;
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }

    await db.execute(sql`
      INSERT INTO messages (id, channel, direction, sender_name, sender_email, content, case_id, office_id, created_at)
      VALUES (
        ${randomUUID()}, 'portal', 'inbound', ${senderName ?? 'عميل'}, ${senderEmail ?? null},
        ${message}, ${portalRow.case_id}, ${portalRow.office_id ?? null}, NOW()
      )
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/case/:caseId/messages — firm inbox for portal channel ───────
router.get("/portal/case/:caseId/messages", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "reply")) {
    res.status(403).json({ error: "ليس لديك صلاحية الرد", code: "NO_REPLY_PERM" }); return;
  }
  try {
    const caseId = String(req.params.caseId);
    const c = sqlOne(await db.execute(sql`
      SELECT id FROM cases WHERE id::text = ${caseId} AND office_id = ${u.officeId} LIMIT 1
    `));
    if (!c) { res.status(404).json({ error: "القضية غير موجودة" }); return; }
    const rows = sqlAll(await db.execute(sql`
      SELECT id, direction, sender_name, content, created_at, read_at
      FROM messages
      WHERE case_id = ${caseId} AND channel = 'portal'
      ORDER BY created_at ASC
      LIMIT 200
    `));
    res.json({ success: true, messages: rows });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/case/:caseId/reply — lawyer reply to client ────────────────
router.post("/portal/case/:caseId/reply", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!await checkCommPerm(u, "reply")) {
    res.status(403).json({ error: "ليس لديك صلاحية الرد", code: "NO_REPLY_PERM" }); return;
  }
  try {
    const caseId = String(req.params.caseId);
    const message = String(req.body?.message ?? "").trim();
    if (!message) { res.status(400).json({ error: "الرسالة مطلوبة" }); return; }
    const c = sqlOne(await db.execute(sql`
      SELECT id FROM cases WHERE id::text = ${caseId} AND office_id = ${u.officeId} LIMIT 1
    `));
    if (!c) { res.status(404).json({ error: "القضية غير موجودة" }); return; }
    const id = randomUUID();
    await db.execute(sql`
      INSERT INTO messages
        (id, channel, direction, sender_name, sender_email, content, case_id, office_id, created_at)
      VALUES (
        ${id}, 'portal', 'outbound', ${req.body?.senderName ?? "المحامي"},
        ${u.email ?? null}, ${message}, ${caseId}, ${u.officeId}, NOW()
      )
    `);
    await db.execute(sql`
      UPDATE messages SET read_at = COALESCE(read_at, NOW())
      WHERE case_id = ${caseId} AND channel = 'portal' AND direction = 'inbound' AND read_at IS NULL
    `).catch(() => {});
    res.status(201).json({ success: true, id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

async function loadPortalForPublic(token: string) {
  const rows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
  const portalRow = sqlOne(rows) as any;
  if (!portalRow) return null;
  if (portalRow.expires_at && new Date(portalRow.expires_at) < new Date()) return null;
  if (portalRow.is_active === false) return null;
  return portalRow;
}

// ─── POST /portal/:token/appointments/:id/reschedule (PUBLIC — client) ──────
router.post("/portal/:token/appointments/:id/reschedule", async (req: Request, res: Response) => {
  try {
    const portalRow = await loadPortalForPublic(String(req.params.token));
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }
    const eventId = String(req.params.id);
    const startAt = String(req.body?.startAt ?? "");
    if (!startAt) { res.status(400).json({ error: "startAt مطلوب" }); return; }
    const endAt = req.body?.endAt ? String(req.body.endAt) : null;
    const upd = sqlOne(await db.execute(sql`
      UPDATE events SET
        start_at = ${startAt}::timestamptz,
        end_at = COALESCE(${endAt}::timestamptz, end_at),
        updated_at = NOW(),
        status = 'upcoming'
      WHERE id = ${eventId}
        AND case_id = ${portalRow.case_id}
        AND client_visible = TRUE
        AND status IS DISTINCT FROM 'cancelled'
      RETURNING id, start_at, end_at, status
    `));
    if (!upd) { res.status(404).json({ error: "الموعد غير موجود أو غير مرئي للعميل" }); return; }
    res.json({ success: true, appointment: upd });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ─── POST /portal/:token/appointments/:id/cancel (PUBLIC — client) ──────────
router.post("/portal/:token/appointments/:id/cancel", async (req: Request, res: Response) => {
  try {
    const portalRow = await loadPortalForPublic(String(req.params.token));
    if (!portalRow) { res.status(404).json({ error: "رابط غير صالح" }); return; }
    const eventId = String(req.params.id);
    const upd = sqlOne(await db.execute(sql`
      UPDATE events SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${eventId}
        AND case_id = ${portalRow.case_id}
        AND client_visible = TRUE
      RETURNING id, status
    `));
    if (!upd) { res.status(404).json({ error: "الموعد غير موجود أو غير مرئي للعميل" }); return; }
    res.json({ success: true, appointment: upd });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  COMMUNICATION PERMISSIONS SETTINGS
// ═══════════════════════════════════════════════════════════════

const ROLE_LABELS: Record<string, string> = {
  firm_owner: "مالك المكتب", office_manager: "مدير المكتب",
  lawyer: "محامي", trainee_lawyer: "محامي متدرب",
  accountant: "محاسب", secretary: "سكرتير",
  broker: "وسيط", collaborator: "متعاون",
};

/* GET /api/comm-settings — returns current settings for the office */
router.get("/comm-settings", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  try {
    const rows = sqlAll(await db.execute(sql`SELECT * FROM client_comm_settings WHERE office_id=${u.officeId}`));
    const s = rows[0] ?? {
      reply_roles:    DEFAULT_COMM_ROLES.reply,
      portal_roles:   DEFAULT_COMM_ROLES.portal,
      timeline_roles: DEFAULT_COMM_ROLES.timeline,
      intake_roles:   DEFAULT_COMM_ROLES.intake,
      require_reply_approval: false,
    };
    res.json({
      ...s,
      allRoles: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
      currentUserRole: u.officeRole,
      isAdmin: u.isAdmin,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/comm-settings — admin only: update role settings */
router.patch("/comm-settings", requireAuth, async (req: Request, res: Response) => {
  const u = await getOfficeUser(req);
  if (!u) { res.status(401).json({ error: "غير مصادق" }); return; }
  if (!u.isAdmin) { res.status(403).json({ error: "يجب أن تكون مديراً أو مالك مكتب لتعديل إعدادات التواصل" }); return; }
  try {
    const { reply_roles, portal_roles, timeline_roles, intake_roles, require_reply_approval } = req.body;
    const validRoles = Object.keys(ROLE_LABELS);
    const clean = (arr: any, def: string[]) =>
      Array.isArray(arr) ? arr.filter((r: any) => validRoles.includes(r)) : def;
    // Postgres text[] literal: {firm_owner,lawyer} — values are whitelisted so safe
    const toArr = (arr: string[]) => "{" + arr.join(",") + "}";

    const rr = toArr(clean(reply_roles,    DEFAULT_COMM_ROLES.reply));
    const pr = toArr(clean(portal_roles,   DEFAULT_COMM_ROLES.portal));
    const tr = toArr(clean(timeline_roles, DEFAULT_COMM_ROLES.timeline));
    const ir = toArr(clean(intake_roles,   DEFAULT_COMM_ROLES.intake));
    const approval = !!(require_reply_approval ?? false);

    // Re-resolve (fail-closed, defense in depth) the canonical office
    // immediately before writing — never trust a previously-computed
    // officeId for the write itself. writeClientCommSettings performs NO
    // write when resolveTenantId returns null.
    const headerTenant = req.headers?.["x-tenant-id"] as string | undefined;
    const outcome = await writeClientCommSettings(
      {
        userId: u.userId,
        headerTenant,
        roles: { replyRoles: rr, portalRoles: pr, timelineRoles: tr, intakeRoles: ir, requireReplyApproval: approval },
      },
      { resolveTenantId, db },
    );
    if (!outcome) { res.status(401).json({ error: "غير مصادق" }); return; }

    const updated = sqlAll(await db.execute(sql`SELECT * FROM client_comm_settings WHERE office_id=${outcome.officeId}`));
    res.json(updated[0] ?? { ok: true });
  } catch (e: any) {
        res.status(500).json({ error: e.message });
  }
});

export default router;
