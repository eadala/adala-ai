import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { callAI } from "../ai/aiChat";

const router = Router();

/* ── Auth helpers ──────────────────────────────────────── */
function requireAuth(req: any, res: any, next: any) {
  requireAuthWithTenant(req, res, next);
}

function sqlOne(r: any) { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return rows[0] ?? null; }
function sqlAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

/* ══════════════════════════════════════════════════════════
   TABLES — Idempotent CREATE IF NOT EXISTS
══════════════════════════════════════════════════════════ */
export async function ensureBankruptcyTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bankruptcy_cases (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id     TEXT NOT NULL,
      case_number   TEXT NOT NULL,
      debtor_name   TEXT NOT NULL,
      debtor_type   TEXT NOT NULL DEFAULT 'individual',
      procedure_type TEXT NOT NULL DEFAULT 'liquidation',
      court_name    TEXT,
      trustee_name  TEXT,
      trustee_id    TEXT,
      status        TEXT NOT NULL DEFAULT 'active',
      notes         TEXT,
      start_date    DATE,
      end_date      DATE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_creditors (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id     UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'unsecured',
      email       TEXT,
      phone       TEXT,
      national_id TEXT,
      address     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_claims (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id        UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      creditor_id    UUID NOT NULL REFERENCES bk_creditors(id) ON DELETE CASCADE,
      office_id      TEXT NOT NULL,
      claim_number   TEXT,
      amount         NUMERIC(18,2) NOT NULL DEFAULT 0,
      currency       TEXT NOT NULL DEFAULT 'SAR',
      priority_level TEXT NOT NULL DEFAULT 'unsecured',
      status         TEXT NOT NULL DEFAULT 'pending',
      submitted_at   DATE,
      reviewed_at    DATE,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_claim_documents (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id     UUID NOT NULL REFERENCES bk_claims(id) ON DELETE CASCADE,
      file_name    TEXT NOT NULL,
      file_url     TEXT,
      uploaded_by  TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_assets (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id         UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id       TEXT NOT NULL,
      asset_name      TEXT NOT NULL,
      asset_type      TEXT NOT NULL DEFAULT 'real_estate',
      description     TEXT,
      estimated_value NUMERIC(18,2) DEFAULT 0,
      market_value    NUMERIC(18,2) DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      location        TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_asset_valuations (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id         UUID NOT NULL REFERENCES bk_assets(id) ON DELETE CASCADE,
      valuator_name    TEXT NOT NULL,
      valuation_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      valuation_date   DATE,
      report_file      TEXT,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_meetings (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id      UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id    TEXT NOT NULL,
      title        TEXT NOT NULL,
      meeting_date TIMESTAMPTZ,
      location     TEXT,
      meeting_type TEXT NOT NULL DEFAULT 'creditors',
      status       TEXT NOT NULL DEFAULT 'scheduled',
      minutes_text TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_distributions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id             UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id           TEXT NOT NULL,
      distribution_round  INT NOT NULL DEFAULT 1,
      total_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
      distribution_date   DATE,
      status              TEXT NOT NULL DEFAULT 'draft',
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_distribution_items (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      distribution_id  UUID NOT NULL REFERENCES bk_distributions(id) ON DELETE CASCADE,
      creditor_id      UUID NOT NULL REFERENCES bk_creditors(id) ON DELETE CASCADE,
      claim_id         UUID REFERENCES bk_claims(id),
      allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      payment_status   TEXT NOT NULL DEFAULT 'pending',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_reports (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id      UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id    TEXT NOT NULL,
      report_type  TEXT NOT NULL DEFAULT 'progress',
      report_title TEXT NOT NULL,
      content      TEXT,
      generated_by TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_ai_analysis (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id       UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id     TEXT NOT NULL,
      analysis_type TEXT NOT NULL DEFAULT 'general',
      input_source  TEXT,
      result        TEXT,
      generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_cases_office     ON bankruptcy_cases(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_creditors_case   ON bk_creditors(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_claims_case      ON bk_claims(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_assets_case      ON bk_assets(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_meetings_case    ON bk_meetings(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_distributions_case ON bk_distributions(case_id)`);
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD — GET /api/bankruptcy/dashboard
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/dashboard", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const [cases, creditors, claims, assets, meetings, distributions] = await Promise.all([
      db.execute(sql`SELECT status, COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId} GROUP BY status`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_creditors WHERE office_id=${officeId}`),
      db.execute(sql`SELECT SUM(amount) as total, COUNT(*) as cnt FROM bk_claims WHERE office_id=${officeId}`),
      db.execute(sql`SELECT SUM(estimated_value) as total, COUNT(*) as cnt FROM bk_assets WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_meetings WHERE office_id=${officeId} AND meeting_date > NOW() AND status='scheduled'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_distributions WHERE office_id=${officeId} AND status='draft'`),
    ]);

    const caseRows = sqlAll(cases);
    const totalCases = caseRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const activeCases = Number(caseRows.find((r: any) => r.status === "active")?.cnt ?? 0);
    const closedCases = Number(caseRows.find((r: any) => r.status === "closed")?.cnt ?? 0);

    res.json({
      totalCases,
      activeCases,
      closedCases,
      casesByStatus: caseRows,
      totalCreditors: Number(sqlOne(creditors)?.cnt ?? 0),
      totalClaims: Number(sqlOne(claims)?.cnt ?? 0),
      totalClaimsAmount: Number(sqlOne(claims)?.total ?? 0),
      totalAssets: Number(sqlOne(assets)?.cnt ?? 0),
      totalAssetsValue: Number(sqlOne(assets)?.total ?? 0),
      upcomingMeetings: Number(sqlOne(meetings)?.cnt ?? 0),
      pendingDistributions: Number(sqlOne(distributions)?.cnt ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   CASES CRUD
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const rows = sqlAll(await db.execute(sql`
      SELECT *, (
        SELECT COUNT(*) FROM bk_creditors WHERE case_id=bankruptcy_cases.id
      ) AS creditor_count,
      (
        SELECT COUNT(*) FROM bk_claims WHERE case_id=bankruptcy_cases.id
      ) AS claim_count
      FROM bankruptcy_cases WHERE office_id=${officeId}
      ORDER BY created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const { case_number, debtor_name, debtor_type, procedure_type, court_name, trustee_name, notes, start_date } = req.body;
    if (!case_number || !debtor_name) return res.status(400).json({ error: "رقم الملف واسم المدين مطلوبان" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bankruptcy_cases (office_id, case_number, debtor_name, debtor_type, procedure_type, court_name, trustee_name, notes, start_date)
      VALUES (${officeId}, ${case_number}, ${debtor_name}, ${debtor_type ?? "individual"}, ${procedure_type ?? "liquidation"}, ${court_name ?? null}, ${trustee_name ?? null}, ${notes ?? null}, ${start_date ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/bankruptcy/cases/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    const row = sqlOne(await db.execute(sql`
      SELECT * FROM bankruptcy_cases WHERE id=${id}::uuid AND office_id=${officeId}
    `));
    if (!row) return res.status(404).json({ error: "الملف غير موجود" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/cases/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    const { debtor_name, debtor_type, procedure_type, court_name, trustee_name, status, notes, start_date, end_date } = req.body;
    const row = sqlOne(await db.execute(sql`
      UPDATE bankruptcy_cases SET
        debtor_name=${debtor_name}, debtor_type=${debtor_type}, procedure_type=${procedure_type},
        court_name=${court_name ?? null}, trustee_name=${trustee_name ?? null},
        status=${status}, notes=${notes ?? null},
        start_date=${start_date ?? null}, end_date=${end_date ?? null},
        updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "الملف غير موجود" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/bankruptcy/cases/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    await db.execute(sql`UPDATE bankruptcy_cases SET status='archived', updated_at=NOW() WHERE id=${id}::uuid AND office_id=${officeId}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   CREDITORS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/creditors", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT c.*, (SELECT COUNT(*) FROM bk_claims WHERE creditor_id=c.id) as claim_count,
             (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE creditor_id=c.id) as total_claims
      FROM bk_creditors c
      WHERE c.case_id=${caseId}::uuid AND c.office_id=${officeId}
      ORDER BY c.created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/creditors", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { name, type, email, phone, national_id, address } = req.body;
    if (!name) return res.status(400).json({ error: "اسم الدائن مطلوب" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_creditors (case_id, office_id, name, type, email, phone, national_id, address)
      VALUES (${caseId}::uuid, ${officeId}, ${name}, ${type ?? "unsecured"}, ${email ?? null}, ${phone ?? null}, ${national_id ?? null}, ${address ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/bankruptcy/creditors/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    await db.execute(sql`DELETE FROM bk_creditors WHERE id=${id}::uuid AND office_id=${officeId}`);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   CLAIMS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/claims", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT cl.*, cr.name as creditor_name
      FROM bk_claims cl
      LEFT JOIN bk_creditors cr ON cr.id=cl.creditor_id
      WHERE cl.case_id=${caseId}::uuid AND cl.office_id=${officeId}
      ORDER BY cl.created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/claims", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { creditor_id, claim_number, amount, currency, priority_level, status, submitted_at, notes } = req.body;
    if (!creditor_id || !amount) return res.status(400).json({ error: "الدائن والمبلغ مطلوبان" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_claims (case_id, creditor_id, office_id, claim_number, amount, currency, priority_level, status, submitted_at, notes)
      VALUES (${caseId}::uuid, ${creditor_id}::uuid, ${officeId}, ${claim_number ?? null}, ${amount}, ${currency ?? "SAR"}, ${priority_level ?? "unsecured"}, ${status ?? "pending"}, ${submitted_at ?? null}, ${notes ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/claims/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    const { status, notes, reviewed_at } = req.body;
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_claims SET status=${status}, notes=${notes ?? null}, reviewed_at=${reviewed_at ?? null}
      WHERE id=${id}::uuid AND office_id=${officeId} RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   ASSETS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/assets", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT a.*, (SELECT COUNT(*) FROM bk_asset_valuations WHERE asset_id=a.id) as valuation_count
      FROM bk_assets a
      WHERE a.case_id=${caseId}::uuid AND a.office_id=${officeId}
      ORDER BY a.created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/assets", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { asset_name, asset_type, description, estimated_value, market_value, location, status } = req.body;
    if (!asset_name) return res.status(400).json({ error: "اسم الأصل مطلوب" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_assets (case_id, office_id, asset_name, asset_type, description, estimated_value, market_value, location, status)
      VALUES (${caseId}::uuid, ${officeId}, ${asset_name}, ${asset_type ?? "real_estate"}, ${description ?? null}, ${estimated_value ?? 0}, ${market_value ?? 0}, ${location ?? null}, ${status ?? "active"})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   MEETINGS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/meetings", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_meetings WHERE case_id=${caseId}::uuid AND office_id=${officeId}
      ORDER BY meeting_date DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/meetings", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { title, meeting_date, location, meeting_type } = req.body;
    if (!title) return res.status(400).json({ error: "عنوان الاجتماع مطلوب" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_meetings (case_id, office_id, title, meeting_date, location, meeting_type)
      VALUES (${caseId}::uuid, ${officeId}, ${title}, ${meeting_date ?? null}, ${location ?? null}, ${meeting_type ?? "creditors"})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   DISTRIBUTIONS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/distributions", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT d.*, (SELECT COUNT(*) FROM bk_distribution_items WHERE distribution_id=d.id) as item_count
      FROM bk_distributions d
      WHERE d.case_id=${caseId}::uuid AND d.office_id=${officeId}
      ORDER BY d.created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/distributions", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { distribution_round, total_amount, distribution_date, notes } = req.body;
    if (!total_amount) return res.status(400).json({ error: "إجمالي المبلغ مطلوب" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_distributions (case_id, office_id, distribution_round, total_amount, distribution_date, notes)
      VALUES (${caseId}::uuid, ${officeId}, ${distribution_round ?? 1}, ${total_amount}, ${distribution_date ?? null}, ${notes ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   REPORTS
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/reports", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_reports WHERE case_id=${caseId}::uuid AND office_id=${officeId}
      ORDER BY created_at DESC
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/bankruptcy/cases/:id/reports", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { report_type, report_title, content, generated_by } = req.body;
    if (!report_title) return res.status(400).json({ error: "عنوان التقرير مطلوب" });
    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_reports (case_id, office_id, report_type, report_title, content, generated_by)
      VALUES (${caseId}::uuid, ${officeId}, ${report_type ?? "progress"}, ${report_title}, ${content ?? null}, ${generated_by ?? null})
      RETURNING *
    `));
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   AI ANALYSIS
══════════════════════════════════════════════════════════ */
router.post("/bankruptcy/cases/:id/ai-analysis", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const { analysis_type, prompt, context } = req.body;

    const caseRow = sqlOne(await db.execute(sql`
      SELECT * FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}
    `));
    if (!caseRow) return res.status(404).json({ error: "الملف غير موجود" });

    const systemPrompt = `أنت مستشار قانوني متخصص في قانون الإفلاس وإعادة التنظيم المالي في المملكة العربية السعودية.
تحلل ملفات الإفلاس وتقدم توصيات قانونية ومالية دقيقة.
الملف الحالي: ${caseRow.debtor_name} | النوع: ${caseRow.procedure_type} | الحالة: ${caseRow.status}
${context ? `السياق: ${context}` : ""}`;

    const userPrompt = prompt || `قدّم تحليلاً شاملاً لملف الإفلاس رقم ${caseRow.case_number} للمدين ${caseRow.debtor_name}.`;
    const result = await callAI(systemPrompt, userPrompt, officeId);

    await db.execute(sql`
      INSERT INTO bk_ai_analysis (case_id, office_id, analysis_type, input_source, result)
      VALUES (${caseId}::uuid, ${officeId}, ${analysis_type ?? "general"}, ${userPrompt.slice(0, 500)}, ${result})
    `);

    res.json({ result, caseId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/bankruptcy/cases/:id/ai-history", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_ai_analysis WHERE case_id=${caseId}::uuid AND office_id=${officeId}
      ORDER BY generated_at DESC LIMIT 20
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
