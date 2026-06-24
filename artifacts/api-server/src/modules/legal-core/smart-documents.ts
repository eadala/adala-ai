import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import express, { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();
const GEMINI_KEY = process.env.GEMINI_API_KEY;

function rows(r: any): any[] {
  if (Array.isArray(r)) return r;
  if (r?.rows) return r.rows;
  return [];
}

/* ── Gemini Vision Analysis ── */
async function analyzeDocument(
  fileData: string,
  fileType: string,
  fileName: string,
): Promise<Record<string, any> | null> {
  if (!GEMINI_KEY) return null;

  const isVisual = fileType.startsWith("image/") || fileType === "application/pdf";
  const base64   = fileData.includes(",") ? fileData.split(",")[1] : fileData;

  const prompt = `أنت محلل قانوني خبير. حلل هذا المستند القانوني واستخرج المعلومات الآتية.
أجب بـ JSON صالح فقط بدون أي نص خارجه:
{
  "summary": "ملخص شامل للمستند في 3-5 جمل عربية",
  "document_type": "نوع المستند: عقد أو صك أو حكم أو مذكرة أو وثيقة أو إشعار أو شهادة أو أخرى",
  "parties": ["اسم الطرف الأول", "اسم الطرف الثاني"],
  "dates": ["كل التواريخ المذكورة بصيغتها الكاملة"],
  "amounts": ["كل المبالغ المالية مع العملة"],
  "deed_numbers": ["أرقام الصكوك أو القضايا أو المراجع"],
  "keywords": ["5-8 كلمات مفتاحية قانونية"],
  "risk_notes": "أي مخاطر أو ملاحظات قانونية جوهرية، أو null إن لم توجد"
}
اسم الملف: ${fileName}`;

  try {
    const parts: any[] = isVisual && base64
      ? [{ inline_data: { mime_type: fileType, data: base64 } }, { text: prompt }]
      : [{ text: `${prompt}\n\n(تحليل بناءً على اسم الملف فقط — المحتوى غير متاح)` }];

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
        }),
      },
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const text  = (data as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function toArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; }
    catch { return [v]; }
  }
  return [];
}

/* ════════════════════════════════════════════
   GET /smart-documents
   ════════════════════════════════════════════ */
router.get("/smart-documents", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId                          = (req as any).tenantId as string;
    const { entityType, entityId } = req.query as Record<string, string>;

    const filter =
      entityType === "case"     && entityId ? sql` AND case_id     = ${entityId}` :
      entityType === "client"   && entityId ? sql` AND client_id   = ${entityId}` :
      entityType === "contract" && entityId ? sql` AND contract_id = ${entityId}` :
      sql``;

    const result = await db.execute(
      sql`SELECT id, office_id, case_id, client_id, contract_id,
                 file_name, file_type, file_size, file_url,
                 cloud_provider, cloud_file_id, cloud_file_url,
                 ai_analyzed, ai_summary, ai_parties, ai_dates, ai_amounts,
                 ai_document_type, ai_keywords, ai_deed_numbers, ai_risk_notes,
                 uploaded_by, notes, created_at
          FROM   smart_documents
          WHERE  office_id = ${tenantId} ${filter}
          ORDER  BY created_at DESC`,
    );

    res.json(rows(result).map(d => ({
      ...d,
      ai_parties:     toArray(d.ai_parties),
      ai_dates:       toArray(d.ai_dates),
      ai_amounts:     toArray(d.ai_amounts),
      ai_keywords:    toArray(d.ai_keywords),
      ai_deed_numbers: toArray(d.ai_deed_numbers),
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   POST /smart-documents
   ════════════════════════════════════════════ */
router.post("/smart-documents", express.json({ limit: "8mb" }), requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const {
      fileName, fileType, fileData, fileSize,
      caseId, clientId, contractId,
      uploadedBy, notes, autoAnalyze,
    } = req.body;

    if (!fileName) return res.status(400).json({ error: "اسم الملف مطلوب" });

    /* Run AI analysis synchronously if requested */
    let analysis: Record<string, any> | null = null;
    if (autoAnalyze && fileData && GEMINI_KEY) {
      analysis = await analyzeDocument(
        fileData,
        fileType ?? "application/octet-stream",
        fileName,
      );
    }

    const insertResult = await db.execute(sql`
      INSERT INTO smart_documents (
        office_id, case_id, client_id, contract_id,
        file_name, file_type, file_size,
        cloud_provider, uploaded_by, notes,
        ai_analyzed,
        ai_summary, ai_parties, ai_dates, ai_amounts,
        ai_document_type, ai_keywords, ai_deed_numbers, ai_risk_notes
      ) VALUES (
        ${tenantId},
        ${caseId     ?? null}, ${clientId   ?? null}, ${contractId ?? null},
        ${fileName},  ${fileType ?? "application/octet-stream"},
        ${fileSize  ?? 0},
        'local', ${uploadedBy ?? null}, ${notes ?? null},
        ${!!analysis},
        ${analysis?.summary      ?? null},
        ${JSON.stringify(analysis?.parties      ?? [])}::text[],
        ${JSON.stringify(analysis?.dates        ?? [])}::text[],
        ${JSON.stringify(analysis?.amounts      ?? [])}::text[],
        ${analysis?.document_type ?? null},
        ${JSON.stringify(analysis?.keywords     ?? [])}::text[],
        ${JSON.stringify(analysis?.deed_numbers ?? [])}::text[],
        ${analysis?.risk_notes   ?? null}
      )
      RETURNING id, file_name, file_type, file_size, ai_analyzed,
                ai_summary, ai_parties, ai_dates, ai_amounts,
                ai_document_type, ai_keywords, ai_deed_numbers, ai_risk_notes,
                created_at
    `);

    const created = rows(insertResult)[0];
    if (!created) throw new Error("فشل إنشاء المستند");

    auditLog({
      ...auditMeta(req),
      action: "upload",
      resource: "smart_document",
      resourceId: String(created.id),
      details: `ملف: ${fileName}`,
    }).catch(() => {});

    res.status(201).json({
      ...created,
      ai_parties:      toArray(created.ai_parties),
      ai_dates:        toArray(created.ai_dates),
      ai_amounts:      toArray(created.ai_amounts),
      ai_keywords:     toArray(created.ai_keywords),
      ai_deed_numbers: toArray(created.ai_deed_numbers),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   POST /smart-documents/:id/analyze
   ════════════════════════════════════════════ */
router.post("/smart-documents/:id/analyze", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const id       = String((req.params as Record<string, string>).id);
    const { fileData, fileType, fileName: nameOverride } = req.body;

    if (!GEMINI_KEY) return res.status(400).json({ error: "خدمة التحليل الذكي غير متاحة حالياً" });

    /* fetch doc metadata */
    const docRes = await db.execute(sql`
      SELECT id, file_name, file_type
      FROM smart_documents
      WHERE id = ${id}::uuid AND office_id = ${tenantId}
    `);
    const doc = rows(docRes)[0];
    if (!doc) return res.status(404).json({ error: "المستند غير موجود" });

    const analysis = await analyzeDocument(
      fileData ?? "",
      fileType ?? doc.file_type,
      nameOverride ?? doc.file_name,
    );
    if (!analysis) return res.status(500).json({ error: "فشل تحليل المستند — تحقق من مفتاح Gemini" });

    await db.execute(sql`
      UPDATE smart_documents SET
        ai_analyzed     = TRUE,
        ai_summary      = ${analysis.summary      ?? null},
        ai_parties      = ${JSON.stringify(analysis.parties      ?? [])}::text[],
        ai_dates        = ${JSON.stringify(analysis.dates        ?? [])}::text[],
        ai_amounts      = ${JSON.stringify(analysis.amounts      ?? [])}::text[],
        ai_document_type = ${analysis.document_type ?? null},
        ai_keywords     = ${JSON.stringify(analysis.keywords     ?? [])}::text[],
        ai_deed_numbers = ${JSON.stringify(analysis.deed_numbers ?? [])}::text[],
        ai_risk_notes   = ${analysis.risk_notes   ?? null},
        updated_at      = NOW()
      WHERE id = ${id}::uuid AND office_id = ${tenantId}
    `);

    res.json({ success: true, analysis });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   DELETE /smart-documents/:id
   ════════════════════════════════════════════ */
router.delete("/smart-documents/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const id       = String((req.params as Record<string, string>).id);
    await db.execute(sql`
      DELETE FROM smart_documents
      WHERE id = ${id}::uuid AND office_id = ${tenantId}
    `);
    auditLog({ ...auditMeta(req), action: "delete", resource: "smart_document", resourceId: id }).catch(() => {});
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   GET /smart-documents/cloud-connections
   ════════════════════════════════════════════ */
router.get("/smart-documents/cloud-connections", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const result = await db.execute(sql`
      SELECT id, provider, display_name, account_email, account_name, is_active, created_at
      FROM   cloud_storage_connections
      WHERE  office_id = ${tenantId}
      ORDER  BY created_at
    `);
    res.json(rows(result));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   POST /smart-documents/cloud-connections
   ════════════════════════════════════════════ */
router.post("/smart-documents/cloud-connections", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { provider, displayName, accountEmail, accountName } = req.body;
    if (!provider) return res.status(400).json({ error: "provider مطلوب" });

    const result = await db.execute(sql`
      INSERT INTO cloud_storage_connections
        (office_id, provider, display_name, account_email, account_name)
      VALUES
        (${tenantId}, ${provider}, ${displayName ?? null}, ${accountEmail ?? null}, ${accountName ?? null})
      ON CONFLICT (office_id, provider) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        account_email = EXCLUDED.account_email,
        account_name  = EXCLUDED.account_name,
        is_active     = TRUE,
        updated_at    = NOW()
      RETURNING id, provider, display_name, account_email, account_name, is_active
    `);
    res.status(201).json(rows(result)[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ════════════════════════════════════════════
   DELETE /smart-documents/cloud-connections/:id
   ════════════════════════════════════════════ */
router.delete("/smart-documents/cloud-connections/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const id       = String((req.params as Record<string, string>).id);
    await db.execute(sql`
      UPDATE cloud_storage_connections
      SET    is_active = FALSE, updated_at = NOW()
      WHERE  id = ${id}::uuid AND office_id = ${tenantId}
    `);
    res.status(204).end();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
