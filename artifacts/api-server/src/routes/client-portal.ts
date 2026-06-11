import { Router, type Request, type Response } from "express";
import { db, casesTable, clientsTable, invoicesTable, documentsTable, messagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

// ─── POST /portal/create-token ────────────────────────────────────────────────
router.post("/portal/create-token", async (req: Request, res: Response) => {
  try {
    const { caseId, clientEmail, clientName, expiryDays = 30 } = req.body;
    if (!caseId) { res.status(400).json({ error: "caseId مطلوب" }); return; }

    const token = randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + expiryDays * 86400000);

    await db.execute(sql`
      INSERT INTO client_portal_tokens (id, case_id, token, client_email, client_name, expires_at, created_at)
      VALUES (${randomUUID()}, ${caseId}, ${token}, ${clientEmail ?? null}, ${clientName ?? null}, ${expiresAt.toISOString()}, NOW())
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
    const rows = await db.execute(sql`
      SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1
    `);
    const portalRow = rows.rows?.[0] as any;
    if (!portalRow) { res.status(404).json({ error: "رابط البوابة غير صالح" }); return; }
    if (portalRow.expires_at && new Date(portalRow.expires_at) < new Date()) {
      res.status(410).json({ error: "انتهت صلاحية الرابط" }); return;
    }

    // Update access count
    await db.execute(sql`
      UPDATE client_portal_tokens
      SET access_count = access_count + 1, last_accessed = NOW()
      WHERE token = ${token}
    `);

    const caseId = portalRow.case_id;
    const [caseRows, invRows, docRows] = await Promise.all([
      db.execute(sql`SELECT * FROM cases WHERE id = ${caseId} LIMIT 1`),
      db.execute(sql`SELECT * FROM invoices WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 10`),
      db.execute(sql`SELECT id, file_name, file_type, file_size, created_at FROM documents WHERE case_id = ${caseId} ORDER BY created_at DESC LIMIT 20`),
    ]);

    const caseData = caseRows.rows?.[0] as any;
    if (!caseData) { res.status(404).json({ error: "القضية غير موجودة" }); return; }

    res.json({
      portal: {
        clientName: portalRow.client_name,
        clientEmail: portalRow.client_email,
        expiresAt: portalRow.expires_at,
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
      invoices: invRows.rows ?? [],
      documents: docRows.rows ?? [],
    });
  } catch (e: any) {
    console.error("portal/:token:", e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /portal/tokens/:caseId ───────────────────────────────────────────────
router.get("/portal/tokens/:caseId", async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;
    const rows = await db.execute(sql`
      SELECT * FROM client_portal_tokens WHERE case_id = ${caseId} ORDER BY created_at DESC
    `);
    res.json(rows.rows ?? []);
  } catch (e: any) {
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

// ─── POST /portal/:token/message ──────────────────────────────────────────────
router.post("/portal/:token/message", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { message, senderName, senderEmail } = req.body;
    const rows = await db.execute(sql`SELECT * FROM client_portal_tokens WHERE token = ${token} LIMIT 1`);
    const portalRow = rows.rows?.[0] as any;
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
