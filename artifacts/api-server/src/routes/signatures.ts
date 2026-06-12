import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

async function sqlAll(q: any) {
  const r = await db.execute(q) as any;
  return Array.isArray(r) ? r : (r?.rows ?? []);
}
async function sqlOne(q: any) {
  const rows = await sqlAll(q);
  return rows[0] ?? null;
}

async function ensureSchema() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_signatures (
      id            TEXT PRIMARY KEY,
      document_id   TEXT NOT NULL,
      document_title TEXT,
      document_content TEXT,
      signer_name   TEXT NOT NULL,
      signer_email  TEXT,
      sign_token    TEXT UNIQUE NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      signature_text TEXT,
      signed_at     TIMESTAMPTZ,
      ip_address    TEXT,
      notes         TEXT,
      requested_by  TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// POST /api/signatures/request — create signature request (auth required)
router.post("/signatures/request", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const { documentId, signerName, signerEmail, notes } = req.body;
    if (!documentId || !signerName) {
      res.status(400).json({ error: "documentId و signerName مطلوبان" }); return;
    }
    const auth = (req as any).auth;
    const doc = await sqlOne(sql`SELECT id, title, content FROM legal_documents WHERE id = ${documentId} LIMIT 1`);
    if (!doc) { res.status(404).json({ error: "الوثيقة غير موجودة" }); return; }

    const id = randomUUID();
    const signToken = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    await db.execute(sql`
      INSERT INTO document_signatures
        (id, document_id, document_title, document_content, signer_name, signer_email, sign_token, status, notes, requested_by)
      VALUES
        (${id}, ${documentId}, ${doc.title}, ${doc.content}, ${signerName}, ${signerEmail ?? null},
         ${signToken}, 'pending', ${notes ?? null}, ${auth?.userId ?? null})
    `);
    const host = `${req.protocol}://${req.get("host")}`;
    const signUrl = `${host}/sign/${signToken}`;
    res.json({ success: true, id, signToken, signUrl });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/signatures/token/:token — public, get request by token
router.get("/signatures/token/:token", async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const row = await sqlOne(sql`
      SELECT id, document_title, document_content, signer_name, signer_email,
             status, created_at, signed_at
      FROM document_signatures WHERE sign_token = ${req.params.token} LIMIT 1
    `);
    if (!row) { res.status(404).json({ error: "رابط التوقيع غير صالح" }); return; }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/signatures/token/:token/sign — public, submit signature
router.post("/signatures/token/:token/sign", async (req: Request, res: Response) => {
  try {
    const { signatureText, fullName } = req.body;
    if (!signatureText?.trim()) { res.status(400).json({ error: "التوقيع مطلوب" }); return; }
    const row = await sqlOne(sql`SELECT * FROM document_signatures WHERE sign_token = ${req.params.token} LIMIT 1`);
    if (!row) { res.status(404).json({ error: "رابط التوقيع غير صالح" }); return; }
    if (row.status === "signed") { res.status(400).json({ error: "تم التوقيع على هذه الوثيقة مسبقاً" }); return; }
    const ip = String(req.headers["x-forwarded-for"] ?? req.ip ?? "unknown");
    await db.execute(sql`
      UPDATE document_signatures
      SET status = 'signed',
          signature_text = ${signatureText},
          signed_at = NOW(),
          ip_address = ${ip},
          signer_name = COALESCE(${fullName ?? null}, signer_name)
      WHERE sign_token = ${req.params.token}
    `);
    res.json({ success: true, message: "تم التوقيع بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/signatures/document/:docId — all signatures for a document (auth)
router.get("/signatures/document/:docId", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const rows = await sqlAll(sql`
      SELECT id, signer_name, signer_email, status, signed_at, created_at, sign_token
      FROM document_signatures WHERE document_id = ${req.params.docId}
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/signatures — list all (auth)
router.get("/signatures", requireAuth, async (req: Request, res: Response) => {
  try {
    await ensureSchema();
    const rows = await sqlAll(sql`
      SELECT id, document_id, document_title, signer_name, signer_email,
             status, signed_at, created_at
      FROM document_signatures
      ORDER BY created_at DESC LIMIT 100
    `);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
