import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import {
  callBkAI,
  saveReportToStorage,
  tgBkCaseStatus,
  tgBkMeeting,
  tgBkDistribution,
  tgBkAlert,
  tgBkAiAnalysis,
} from "./bankruptcyIntegrations";

const router = Router();

/* ── Auth & DB helpers ─────────────────────────────────── */
function requireAuth(req: any, res: any, next: any) {
  requireAuthWithTenant(req, res, next);
}
function sqlOne(r: any) { const rows = Array.isArray(r) ? r : (r?.rows ?? []); return rows[0] ?? null; }
function sqlAll(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

/* UUID validation — prevents 500 errors from malformed IDs */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUUID(v: string): boolean { return UUID_RE.test(v); }
function badId(res: any, msg = "معرف غير صالح") { res.status(400).json({ error: msg }); return null; }

/* Status whitelists */
const CASE_STATUSES   = ["active", "suspended", "claims_review", "asset_management", "distribution", "closed", "archived"];
const CLAIM_STATUSES  = ["pending", "submitted", "under_review", "approved", "partially_approved", "rejected", "disputed", "finalized"];
const ASSET_STATUSES  = ["identified", "valuation", "listed", "sold", "collected", "closed", "active"];
const DIST_STATUSES   = ["draft", "approved", "executing", "executed", "cancelled"];
const MEET_STATUSES   = ["scheduled", "completed", "cancelled"];

/* ══════════════════════════════════════════════════════════
   TABLES — Idempotent CREATE IF NOT EXISTS
══════════════════════════════════════════════════════════ */
export async function ensureBankruptcyTables() {
  /* ── Core tables ── */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bankruptcy_cases (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id       TEXT NOT NULL,
      case_number     TEXT NOT NULL,
      debtor_name     TEXT NOT NULL,
      debtor_type     TEXT NOT NULL DEFAULT 'company'
                        CHECK (debtor_type IN ('individual','company','partnership')),
      procedure_type  TEXT NOT NULL DEFAULT 'liquidation'
                        CHECK (procedure_type IN ('liquidation','reorganization','protective_settlement','restructuring')),
      court_name      TEXT,
      trustee_name    TEXT,
      trustee_id      TEXT,
      status          TEXT NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','suspended','claims_review','asset_management','distribution','closed','archived')),
      notes           TEXT,
      start_date      DATE,
      end_date        DATE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (office_id, case_number)
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_creditors (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id     UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id   TEXT NOT NULL,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'unsecured'
                    CHECK (type IN ('secured','unsecured','preferred','government','subordinated')),
      email       TEXT,
      phone       TEXT,
      national_id TEXT,
      address     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_claims (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id        UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      creditor_id    UUID NOT NULL REFERENCES bk_creditors(id) ON DELETE CASCADE,
      office_id      TEXT NOT NULL,
      claim_number   TEXT,
      amount         NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
      currency       TEXT NOT NULL DEFAULT 'SAR'
                       CHECK (currency IN ('SAR','USD','EUR','GBP','AED','KWD','BHD','QAR','OMR')),
      priority_level TEXT NOT NULL DEFAULT 'unsecured'
                       CHECK (priority_level IN ('secured','preferred','unsecured','subordinated')),
      status         TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','submitted','under_review','approved','partially_approved','rejected','disputed','finalized')),
      submitted_at   DATE,
      reviewed_at    DATE,
      notes          TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_claim_documents (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      claim_id     UUID NOT NULL REFERENCES bk_claims(id) ON DELETE CASCADE,
      office_id    TEXT NOT NULL,
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
      asset_type      TEXT NOT NULL DEFAULT 'real_estate'
                        CHECK (asset_type IN ('real_estate','vehicle','equipment','inventory','cash','receivables','intellectual','securities','other')),
      description     TEXT,
      estimated_value NUMERIC(18,2) DEFAULT 0 CHECK (estimated_value >= 0),
      market_value    NUMERIC(18,2) DEFAULT 0 CHECK (market_value >= 0),
      status          TEXT NOT NULL DEFAULT 'identified'
                        CHECK (status IN ('identified','valuation','listed','sold','collected','closed','active')),
      location        TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_asset_valuations (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      asset_id         UUID NOT NULL REFERENCES bk_assets(id) ON DELETE CASCADE,
      office_id        TEXT NOT NULL,
      valuator_name    TEXT NOT NULL,
      valuation_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (valuation_amount >= 0),
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
      meeting_type TEXT NOT NULL DEFAULT 'creditors'
                     CHECK (meeting_type IN ('creditors','trustee','court','committee','valuation','other')),
      status       TEXT NOT NULL DEFAULT 'scheduled'
                     CHECK (status IN ('scheduled','completed','cancelled')),
      minutes_text TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_distributions (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id             UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id           TEXT NOT NULL,
      distribution_round  INT NOT NULL DEFAULT 1 CHECK (distribution_round > 0),
      total_amount        NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (total_amount > 0),
      distribution_date   DATE,
      status              TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','approved','executing','executed','cancelled')),
      notes               TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_distribution_items (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      distribution_id  UUID NOT NULL REFERENCES bk_distributions(id) ON DELETE CASCADE,
      creditor_id      UUID NOT NULL REFERENCES bk_creditors(id) ON DELETE CASCADE,
      claim_id         UUID REFERENCES bk_claims(id),
      office_id        TEXT NOT NULL,
      allocated_amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (allocated_amount >= 0),
      payment_status   TEXT NOT NULL DEFAULT 'pending'
                         CHECK (payment_status IN ('pending','processing','paid','failed')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_reports (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id      UUID NOT NULL REFERENCES bankruptcy_cases(id) ON DELETE CASCADE,
      office_id    TEXT NOT NULL,
      report_type  TEXT NOT NULL DEFAULT 'progress'
                     CHECK (report_type IN ('progress','financial','assets','claims','trustee','final','court')),
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
      analysis_type TEXT NOT NULL DEFAULT 'general'
                      CHECK (analysis_type IN ('general','claims','assets','risk','financial','summary','trustee_report')),
      input_source  TEXT,
      result        TEXT,
      token_count   INT DEFAULT 0,
      generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  /* ── Indexes — existing + composite ── */
  // Primary lookup indexes
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_cases_office         ON bankruptcy_cases(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_cases_office_status  ON bankruptcy_cases(office_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_cases_office_date    ON bankruptcy_cases(office_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_creditors_case       ON bk_creditors(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_creditors_office     ON bk_creditors(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_creditors_case_off   ON bk_creditors(case_id, office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_claims_case          ON bk_claims(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_claims_office        ON bk_claims(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_claims_creditor      ON bk_claims(creditor_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_claims_status        ON bk_claims(case_id, status)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_assets_case          ON bk_assets(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_assets_office        ON bk_assets(office_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_asset_vals_asset     ON bk_asset_valuations(asset_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_meetings_case        ON bk_meetings(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_meetings_date        ON bk_meetings(meeting_date)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_meetings_office_date ON bk_meetings(office_id, meeting_date)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_distributions_case   ON bk_distributions(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_dist_items_dist      ON bk_distribution_items(distribution_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_dist_items_creditor  ON bk_distribution_items(creditor_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_reports_case         ON bk_reports(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_ai_case              ON bk_ai_analysis(case_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_ai_office_date       ON bk_ai_analysis(office_id, generated_at DESC)`);

  /* ── Ad-hoc column migrations (idempotent) ── */
  await db.execute(sql`ALTER TABLE bk_asset_valuations ADD COLUMN IF NOT EXISTS office_id TEXT`);
  await db.execute(sql`ALTER TABLE bk_distribution_items ADD COLUMN IF NOT EXISTS office_id TEXT`);
  await db.execute(sql`ALTER TABLE bk_creditors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE bk_claims ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE bk_assets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE bk_meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE bk_distributions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`);
  await db.execute(sql`ALTER TABLE bk_ai_analysis ADD COLUMN IF NOT EXISTS token_count INT DEFAULT 0`);

  /* ══ Phase 1: Timeline Engine ══ */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_timeline (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      case_id      TEXT,
      entity_type  VARCHAR(50),
      entity_id    TEXT,
      action_type  VARCHAR(100) NOT NULL,
      description  TEXT,
      performed_by TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_timeline_case   ON bk_timeline(case_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_timeline_office ON bk_timeline(office_id, created_at DESC)`);

  /* ══ Phase 2: Audit Log System ══ */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_audit_logs (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      user_id      TEXT,
      action       VARCHAR(50) NOT NULL,
      entity_type  VARCHAR(50),
      entity_id    TEXT,
      old_data     JSONB,
      new_data     JSONB,
      ip_address   VARCHAR(255),
      user_agent   TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_audit_office ON bk_audit_logs(office_id, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_audit_entity ON bk_audit_logs(entity_type, entity_id)`);

  /* ══ Phase 3: Notification Center ══ */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bk_notifications (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id      TEXT NOT NULL,
      user_id        TEXT,
      title          VARCHAR(255) NOT NULL,
      message        TEXT,
      type           VARCHAR(50) NOT NULL DEFAULT 'info',
      status         VARCHAR(20) NOT NULL DEFAULT 'unread',
      related_case   TEXT,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at        TIMESTAMPTZ
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_notif_office ON bk_notifications(office_id, status, created_at DESC)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_bk_notif_user   ON bk_notifications(user_id, status)`);

  /* ══ Phase 6: Soft-delete flag ══ */
  await db.execute(sql`ALTER TABLE bankruptcy_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE bk_creditors    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
  await db.execute(sql`ALTER TABLE bk_claims       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`);
}

/* ══════════════════════════════════════════════════════════
   SECURITY HELPER: verify case belongs to office
══════════════════════════════════════════════════════════ */
async function verifyCase(caseId: string, officeId: string): Promise<boolean> {
  const row = sqlOne(await db.execute(sql`
    SELECT id FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}
  `));
  return !!row;
}

/* ══════════════════════════════════════════════════════════
   ENTERPRISE HELPERS — fire-and-forget, never throws
══════════════════════════════════════════════════════════ */

async function logTimeline(
  officeId: string, caseId: string,
  entityType: string, entityId: string,
  actionType: string, description: string,
  performedBy?: string
) {
  try {
    await db.execute(sql`
      INSERT INTO bk_timeline (office_id, case_id, entity_type, entity_id, action_type, description, performed_by)
      VALUES (${officeId}, ${caseId}, ${entityType}, ${entityId}, ${actionType}, ${description}, ${performedBy ?? null})
    `);
  } catch (_) {}
}

async function logAudit(
  officeId: string, userId: string | null,
  action: string, entityType: string, entityId: string,
  newData?: any, oldData?: any,
  ip?: string, ua?: string
) {
  try {
    await db.execute(sql`
      INSERT INTO bk_audit_logs (office_id, user_id, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
      VALUES (${officeId}, ${userId}, ${action}, ${entityType}, ${entityId},
              ${oldData ? JSON.stringify(oldData) : null}::jsonb,
              ${newData ? JSON.stringify(newData) : null}::jsonb,
              ${ip ?? null}, ${ua ?? null})
    `);
  } catch (_) {}
}

async function sendNotification(
  officeId: string, caseId: string,
  title: string, message: string, type: string
) {
  try {
    await db.execute(sql`
      INSERT INTO bk_notifications (office_id, related_case, title, message, type)
      VALUES (${officeId}, ${caseId}, ${title}, ${message}, ${type})
    `);
  } catch (_) {}
}

/* ══════════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/dashboard", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const [cases, creditors, claims, assets, meetings, distributions] = await Promise.all([
      db.execute(sql`SELECT status, COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId} GROUP BY status`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_creditors WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COALESCE(SUM(amount),0) as total, COUNT(*) as cnt FROM bk_claims WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COALESCE(SUM(estimated_value),0) as total, COUNT(*) as cnt FROM bk_assets WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_meetings WHERE office_id=${officeId} AND meeting_date > NOW() AND status='scheduled'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_distributions WHERE office_id=${officeId} AND status='draft'`),
    ]);

    const caseRows = sqlAll(cases);
    const totalCases = caseRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);

    res.json({
      totalCases,
      activeCases:       Number(caseRows.find((r: any) => r.status === "active")?.cnt ?? 0),
      closedCases:       Number(caseRows.find((r: any) => r.status === "closed")?.cnt ?? 0),
      suspendedCases:    Number(caseRows.find((r: any) => r.status === "suspended")?.cnt ?? 0),
      casesByStatus:     caseRows,
      totalCreditors:    Number(sqlOne(creditors)?.cnt ?? 0),
      totalClaims:       Number(sqlOne(claims)?.cnt ?? 0),
      totalClaimsAmount: Number(sqlOne(claims)?.total ?? 0),
      totalAssets:       Number(sqlOne(assets)?.cnt ?? 0),
      totalAssetsValue:  Number(sqlOne(assets)?.total ?? 0),
      upcomingMeetings:  Number(sqlOne(meetings)?.cnt ?? 0),
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
    const status = req.query.status as string | undefined;
    const limit  = Math.min(Number(req.query.limit ?? 100), 200);
    const offset = Number(req.query.offset ?? 0);

    const rows = sqlAll(await db.execute(sql`
      SELECT bc.*,
        (SELECT COUNT(*) FROM bk_creditors  WHERE case_id=bc.id) AS creditor_count,
        (SELECT COUNT(*) FROM bk_claims     WHERE case_id=bc.id) AS claim_count,
        (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE case_id=bc.id) AS total_claims_amount
      FROM bankruptcy_cases bc
      WHERE bc.office_id=${officeId}
        ${status ? sql`AND bc.status=${status}` : sql``}
      ORDER BY bc.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
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

    if (!case_number?.trim()) return res.status(400).json({ error: "رقم الملف مطلوب" });
    if (!debtor_name?.trim())  return res.status(400).json({ error: "اسم المدين مطلوب" });
    if (case_number.length > 50) return res.status(400).json({ error: "رقم الملف طويل جداً (50 حرف كحد أقصى)" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bankruptcy_cases
        (office_id, case_number, debtor_name, debtor_type, procedure_type, court_name, trustee_name, notes, start_date)
      VALUES
        (${officeId}, ${case_number.trim()}, ${debtor_name.trim()},
         ${debtor_type ?? "company"}, ${procedure_type ?? "liquidation"},
         ${court_name?.trim() ?? null}, ${trustee_name?.trim() ?? null},
         ${notes?.trim() ?? null}, ${start_date ?? null})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, row.id, 'case', row.id, 'case_created', `تم إنشاء ملف الإفلاس: ${row.debtor_name} (${row.case_number})`, req.auth?.userId);
    void logAudit(officeId, req.auth?.userId ?? null, 'CREATE', 'bankruptcy_case', row.id, row);
  } catch (err: any) {
    if (err.message?.includes("unique")) return res.status(409).json({ error: "رقم الملف موجود مسبقاً في هذا المكتب" });
    res.status(500).json({ error: err.message });
  }
});

router.get("/bankruptcy/cases/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);

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
    if (!isUUID(id)) return badId(res);

    const { debtor_name, debtor_type, procedure_type, court_name, trustee_name, status, notes, start_date, end_date } = req.body;
    if (status && !CASE_STATUSES.includes(status)) return res.status(400).json({ error: `حالة غير صالحة. القيم المتاحة: ${CASE_STATUSES.join(", ")}` });
    if (!debtor_name?.trim()) return res.status(400).json({ error: "اسم المدين مطلوب" });

    const row = sqlOne(await db.execute(sql`
      UPDATE bankruptcy_cases SET
        debtor_name=${debtor_name.trim()}, debtor_type=${debtor_type},
        procedure_type=${procedure_type}, court_name=${court_name?.trim() ?? null},
        trustee_name=${trustee_name?.trim() ?? null}, status=${status ?? "active"},
        notes=${notes?.trim() ?? null}, start_date=${start_date ?? null},
        end_date=${end_date ?? null}, updated_at=NOW()
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
    if (!isUUID(id)) return badId(res);
    await db.execute(sql`
      UPDATE bankruptcy_cases SET status='archived', updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
    `);
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT c.*,
        (SELECT COUNT(*) FROM bk_claims WHERE creditor_id=c.id) AS claim_count,
        (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE creditor_id=c.id) AS total_claims
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
    if (!isUUID(caseId)) return badId(res);

    // Security: verify case belongs to this office
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { name, type, email, phone, national_id, address } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "اسم الدائن مطلوب" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_creditors (case_id, office_id, name, type, email, phone, national_id, address)
      VALUES (${caseId}::uuid, ${officeId}, ${name.trim()}, ${type ?? "unsecured"},
              ${email?.trim() ?? null}, ${phone?.trim() ?? null},
              ${national_id?.trim() ?? null}, ${address?.trim() ?? null})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, caseId, 'creditor', row.id, 'creditor_added', `تم إضافة الدائن: ${req.body.name}`, req.auth?.userId);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/bankruptcy/creditors/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT cl.*, cr.name AS creditor_name, cr.type AS creditor_type
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
    if (!isUUID(caseId)) return badId(res);
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { creditor_id, claim_number, amount, currency, priority_level, status, submitted_at, notes } = req.body;
    if (!creditor_id) return res.status(400).json({ error: "الدائن مطلوب" });
    if (!isUUID(String(creditor_id))) return badId(res, "معرف الدائن غير صالح");
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "المبلغ يجب أن يكون رقماً موجباً" });

    // Verify creditor belongs to same case
    const credOk = sqlOne(await db.execute(sql`
      SELECT id FROM bk_creditors WHERE id=${creditor_id}::uuid AND case_id=${caseId}::uuid AND office_id=${officeId}
    `));
    if (!credOk) return res.status(400).json({ error: "الدائن غير مرتبط بهذا الملف" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_claims
        (case_id, creditor_id, office_id, claim_number, amount, currency, priority_level, status, submitted_at, notes)
      VALUES
        (${caseId}::uuid, ${creditor_id}::uuid, ${officeId},
         ${claim_number?.trim() ?? null}, ${amt}, ${currency ?? "SAR"},
         ${priority_level ?? "unsecured"}, ${status ?? "pending"},
         ${submitted_at ?? null}, ${notes?.trim() ?? null})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, caseId, 'claim', row.id, 'claim_submitted', `مطالبة جديدة بمبلغ ${amt.toLocaleString("ar-SA")} ر.س`, req.auth?.userId);
    void logAudit(officeId, req.auth?.userId ?? null, 'CREATE', 'claim', row.id, row);
    void sendNotification(officeId, caseId, 'تم تقديم مطالبة جديدة', `مطالبة بمبلغ ${amt.toLocaleString("ar-SA")} ر.س`, 'claim');
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/claims/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);

    const { status, notes, reviewed_at } = req.body;
    if (status && !CLAIM_STATUSES.includes(status))
      return res.status(400).json({ error: `حالة المطالبة غير صالحة. المتاح: ${CLAIM_STATUSES.join(", ")}` });

    const row = sqlOne(await db.execute(sql`
      UPDATE bk_claims SET
        status=${status}, notes=${notes?.trim() ?? null},
        reviewed_at=${reviewed_at ?? null}, updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "المطالبة غير موجودة" });
    res.json(row);
    const claimStatus = req.body.status ?? "";
    if (claimStatus) {
      void logTimeline(officeId, row.case_id, 'claim', id, `claim_${claimStatus}`, `تم تغيير حالة المطالبة إلى: ${claimStatus}`, req.auth?.userId);
      void logAudit(officeId, req.auth?.userId ?? null, claimStatus === 'approved' ? 'APPROVE' : claimStatus === 'rejected' ? 'REJECT' : 'UPDATE', 'claim', id, row, undefined, req.ip, req.headers['user-agent']);
      if (claimStatus === 'approved') void sendNotification(officeId, row.case_id, 'تمت الموافقة على المطالبة', 'تم قبول المطالبة وسيتم تضمينها في التوزيع', 'claim');
      if (claimStatus === 'rejected') void sendNotification(officeId, row.case_id, 'رُفضت المطالبة', 'تم رفض المطالبة من قِبل أمين الإفلاس', 'claim');
    }
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT a.*,
        (SELECT COUNT(*) FROM bk_asset_valuations WHERE asset_id=a.id) AS valuation_count,
        (SELECT COALESCE(MAX(valuation_amount),0) FROM bk_asset_valuations WHERE asset_id=a.id) AS latest_valuation
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
    if (!isUUID(caseId)) return badId(res);
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { asset_name, asset_type, description, estimated_value, market_value, location, status } = req.body;
    if (!asset_name?.trim()) return res.status(400).json({ error: "اسم الأصل مطلوب" });
    const ev = Number(estimated_value ?? 0);
    const mv = Number(market_value ?? 0);
    if (isNaN(ev) || ev < 0) return res.status(400).json({ error: "القيمة التقديرية غير صالحة" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_assets
        (case_id, office_id, asset_name, asset_type, description, estimated_value, market_value, location, status)
      VALUES
        (${caseId}::uuid, ${officeId}, ${asset_name.trim()},
         ${asset_type ?? "real_estate"}, ${description?.trim() ?? null},
         ${ev}, ${mv < 0 ? 0 : mv}, ${location?.trim() ?? null},
         ${status ?? "identified"})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, caseId, 'asset', row.id, 'asset_created', `تم إضافة أصل: ${req.body.asset_name}`, req.auth?.userId);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/assets/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);
    const { asset_name, asset_type, description, estimated_value, market_value, location, status } = req.body;
    if (status && !ASSET_STATUSES.includes(status))
      return res.status(400).json({ error: `حالة الأصل غير صالحة` });
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_assets SET
        asset_name=${asset_name?.trim()}, asset_type=${asset_type},
        description=${description?.trim() ?? null}, estimated_value=${Number(estimated_value ?? 0)},
        market_value=${Number(market_value ?? 0)}, location=${location?.trim() ?? null},
        status=${status}, updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "الأصل غير موجود" });
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* POST valuation to an asset */
router.post("/bankruptcy/assets/:id/valuations", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const assetId = String(req.params.id);
    if (!isUUID(assetId)) return badId(res);

    // Verify asset belongs to this office
    const assetRow = sqlOne(await db.execute(sql`SELECT id FROM bk_assets WHERE id=${assetId}::uuid AND office_id=${officeId}`));
    if (!assetRow) return res.status(404).json({ error: "الأصل غير موجود" });

    const { valuator_name, valuation_amount, valuation_date, report_file } = req.body;
    if (!valuator_name?.trim()) return res.status(400).json({ error: "اسم المُقيِّم مطلوب" });
    const va = Number(valuation_amount ?? 0);
    if (isNaN(va) || va < 0) return res.status(400).json({ error: "قيمة التقييم غير صالحة" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_asset_valuations (asset_id, office_id, valuator_name, valuation_amount, valuation_date, report_file)
      VALUES (${assetId}::uuid, ${officeId}, ${valuator_name.trim()}, ${va}, ${valuation_date ?? null}, ${report_file ?? null})
      RETURNING *
    `));
    // Update asset market value with latest valuation
    await db.execute(sql`UPDATE bk_assets SET market_value=${va}, updated_at=NOW() WHERE id=${assetId}::uuid`);
    res.status(201).json(row);
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_meetings
      WHERE case_id=${caseId}::uuid AND office_id=${officeId}
      ORDER BY meeting_date DESC NULLS LAST
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
    if (!isUUID(caseId)) return badId(res);
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { title, meeting_date, location, meeting_type } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "عنوان الاجتماع مطلوب" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_meetings (case_id, office_id, title, meeting_date, location, meeting_type)
      VALUES (${caseId}::uuid, ${officeId}, ${title.trim()},
              ${meeting_date ?? null}, ${location?.trim() ?? null},
              ${meeting_type ?? "creditors"})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, caseId, 'meeting', row.id, 'meeting_scheduled', `اجتماع مجدول: ${req.body.title}`, req.auth?.userId);
    void sendNotification(officeId, caseId, 'تم جدولة اجتماع جديد', `${req.body.title} — ${req.body.meeting_date ?? "تاريخ غير محدد"}`, 'meeting');
    /* ① Telegram: meeting scheduled */
    void (async () => {
      const bCase = sqlOne(await db.execute(sql`SELECT debtor_name FROM bankruptcy_cases WHERE id=${caseId}::uuid`).catch(() => null));
      void tgBkMeeting(officeId, bCase?.debtor_name ?? caseId, title.trim(), meeting_date ?? null, meeting_type ?? "creditors");
    })();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/meetings/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);
    const { status, minutes_text, title, meeting_date, location } = req.body;
    if (status && !MEET_STATUSES.includes(status))
      return res.status(400).json({ error: `حالة الاجتماع غير صالحة` });
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_meetings SET
        status=${status}, minutes_text=${minutes_text?.trim() ?? null},
        title=${title?.trim()}, meeting_date=${meeting_date ?? null},
        location=${location?.trim() ?? null}, updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
      RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "الاجتماع غير موجود" });
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT d.*,
        (SELECT COUNT(*) FROM bk_distribution_items WHERE distribution_id=d.id) AS item_count,
        (SELECT COALESCE(SUM(allocated_amount),0) FROM bk_distribution_items WHERE distribution_id=d.id) AS distributed_amount
      FROM bk_distributions d
      WHERE d.case_id=${caseId}::uuid AND d.office_id=${officeId}
      ORDER BY d.distribution_round ASC
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
    if (!isUUID(caseId)) return badId(res);
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { distribution_round, total_amount, distribution_date, notes } = req.body;
    const amt = Number(total_amount);
    if (isNaN(amt) || amt <= 0) return res.status(400).json({ error: "إجمالي المبلغ يجب أن يكون رقماً موجباً" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_distributions
        (case_id, office_id, distribution_round, total_amount, distribution_date, notes)
      VALUES
        (${caseId}::uuid, ${officeId}, ${Number(distribution_round ?? 1)},
         ${amt}, ${distribution_date ?? null}, ${notes?.trim() ?? null})
      RETURNING *
    `));
    res.status(201).json(row);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/bankruptcy/distributions/:id", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const id = String(req.params.id);
    if (!isUUID(id)) return badId(res);
    const { status, notes } = req.body;
    if (status && !DIST_STATUSES.includes(status))
      return res.status(400).json({ error: `حالة التوزيع غير صالحة` });
    const row = sqlOne(await db.execute(sql`
      UPDATE bk_distributions SET status=${status}, notes=${notes?.trim() ?? null}, updated_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId} RETURNING *
    `));
    if (!row) return res.status(404).json({ error: "جولة التوزيع غير موجودة" });
    res.json(row);
    const distStatus = req.body.status ?? "";
    if (distStatus) {
      void logTimeline(officeId, row.case_id, 'distribution', id, `distribution_${distStatus}`, `تم تغيير حالة التوزيع إلى: ${distStatus}`, req.auth?.userId);
      if (distStatus === 'approved') void sendNotification(officeId, row.case_id, 'تمت الموافقة على التوزيع', 'تمت الموافقة على جولة التوزيع وسيبدأ التنفيذ', 'distribution');
      if (distStatus === 'executed') void sendNotification(officeId, row.case_id, 'اكتمل التوزيع', 'تم تنفيذ جولة التوزيع بنجاح', 'distribution');
      /* ② Telegram: distribution approved/executed */
      void (async () => {
        const bCase = sqlOne(await db.execute(sql`SELECT debtor_name FROM bankruptcy_cases WHERE id=${row.case_id}::uuid`).catch(() => null));
        void tgBkDistribution(officeId, bCase?.debtor_name ?? row.case_id, row.distribution_round, row.total_amount, distStatus);
      })();
    }
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
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_reports
      WHERE case_id=${caseId}::uuid AND office_id=${officeId}
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
    if (!isUUID(caseId)) return badId(res);
    if (!(await verifyCase(caseId, officeId))) return res.status(404).json({ error: "الملف غير موجود" });

    const { report_type, report_title, content, generated_by } = req.body;
    if (!report_title?.trim()) return res.status(400).json({ error: "عنوان التقرير مطلوب" });

    const row = sqlOne(await db.execute(sql`
      INSERT INTO bk_reports (case_id, office_id, report_type, report_title, content, generated_by)
      VALUES (${caseId}::uuid, ${officeId}, ${report_type ?? "progress"},
              ${report_title.trim()}, ${content?.trim() ?? null}, ${generated_by ?? null})
      RETURNING *
    `));
    res.status(201).json(row);
    void logTimeline(officeId, caseId, 'report', row.id, 'report_generated', `تقرير: ${req.body.report_title}`, req.auth?.userId);
    void saveReportToStorage({ officeId, caseId, title: report_title.trim(), content: content?.trim() ?? null, reportId: row.id, reportType: report_type ?? "progress" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   AI ANALYSIS
══════════════════════════════════════════════════════════ */
const AI_TYPES = ["general","claims","assets","risk","financial","summary","trustee_report"];
const PROMPT_MAX = 3000;

router.post("/bankruptcy/cases/:id/ai-analysis", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    if (!isUUID(caseId)) return badId(res);

    const { analysis_type, prompt, context } = req.body;
    if (prompt && prompt.length > PROMPT_MAX)
      return res.status(400).json({ error: `النص طويل جداً (${PROMPT_MAX} حرف كحد أقصى)` });
    if (analysis_type && !AI_TYPES.includes(analysis_type))
      return res.status(400).json({ error: `نوع التحليل غير صالح` });

    const caseRow = sqlOne(await db.execute(sql`
      SELECT bc.*,
        (SELECT COUNT(*) FROM bk_creditors WHERE case_id=bc.id) AS creditor_count,
        (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE case_id=bc.id) AS total_claims,
        (SELECT COALESCE(SUM(estimated_value),0) FROM bk_assets WHERE case_id=bc.id) AS total_assets
      FROM bankruptcy_cases bc
      WHERE bc.id=${caseId}::uuid AND bc.office_id=${officeId}
    `));
    if (!caseRow) return res.status(404).json({ error: "الملف غير موجود" });

    const typePrompts: Record<string, string> = {
      general:        "قدّم تحليلاً شاملاً للملف",
      claims:         "قيّم المطالبات: الأولويات، الصحة القانونية، احتمالية القبول والرفض",
      assets:         "قيّم الأصول: السيولة، إمكانية البيع، القيمة السوقية المتوقعة",
      risk:           "استخرج جميع المخاطر القانونية والمالية والتشغيلية",
      financial:      "أجرِ تحليلاً مالياً شاملاً: نسبة الاسترداد، الفجوة المالية، التوصيات",
      summary:        "أنتج ملخصاً تنفيذياً للملف لرفعه للمحكمة",
      trustee_report: "أنتج تقرير أمين إفلاس متكاملاً وفق نظام الإفلاس السعودي 1439هـ",
    };

    const systemPrompt = `أنت مستشار قانوني ومالي متخصص في نظام الإفلاس السعودي (نظام الإفلاس 1439هـ وتعديلاته).
تحلل ملفات الإفلاس وتقدم توصيات قانونية ومالية دقيقة ومنهجية.

بيانات الملف الحالي:
- رقم الملف: ${caseRow.case_number}
- المدين: ${caseRow.debtor_name} (${caseRow.debtor_type})
- نوع الإجراء: ${caseRow.procedure_type}
- الحالة: ${caseRow.status}
- المحكمة: ${caseRow.court_name ?? "غير محدد"}
- أمين الإفلاس: ${caseRow.trustee_name ?? "غير محدد"}
- عدد الدائنين: ${caseRow.creditor_count ?? 0}
- إجمالي المطالبات: ${Number(caseRow.total_claims ?? 0).toLocaleString("ar-SA")} ريال
- إجمالي الأصول: ${Number(caseRow.total_assets ?? 0).toLocaleString("ar-SA")} ريال
${context ? `\nسياق إضافي: ${context}` : ""}

يجب أن تكون إجاباتك منظمة ومفصلة وعملية.`;

    const userPrompt = prompt?.trim() || (typePrompts[analysis_type] ?? typePrompts.general);
    const result = await callBkAI(systemPrompt, userPrompt, officeId, "bankruptcy_analysis", req.auth?.userId ?? "system");

    await db.execute(sql`
      INSERT INTO bk_ai_analysis
        (case_id, office_id, analysis_type, input_source, result, token_count)
      VALUES
        (${caseId}::uuid, ${officeId},
         ${analysis_type ?? "general"},
         ${userPrompt.slice(0, 500)},
         ${result},
         ${Math.ceil(result.length / 4)})
    `);

    void tgBkAiAnalysis(officeId, caseRow.debtor_name ?? caseId, analysis_type ?? "general");
    res.json({ result, caseId, analysisType: analysis_type ?? "general" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/bankruptcy/cases/:id/ai-history", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    if (!isUUID(caseId)) return badId(res);

    const rows = sqlAll(await db.execute(sql`
      SELECT id, analysis_type, input_source, result, token_count, generated_at
      FROM bk_ai_analysis
      WHERE case_id=${caseId}::uuid AND office_id=${officeId}
      ORDER BY generated_at DESC
      LIMIT 20
    `));
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ── Summary stats per case (used in case detail view) ── */
router.get("/bankruptcy/cases/:id/summary", requireAuth, async (req: any, res) => {
  try {
    const officeId = req.tenantId as string;
    const caseId = String(req.params.id);
    if (!isUUID(caseId)) return badId(res);

    const bkCase = sqlOne(await db.execute(sql`
      SELECT * FROM bankruptcy_cases WHERE id=${caseId}::uuid AND office_id=${officeId}
    `));
    if (!bkCase) return res.status(404).json({ error: "الملف غير موجود" });

    const [creditors, claims, assets, meetings, dists] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_creditors WHERE case_id=${caseId}::uuid`),
      db.execute(sql`SELECT COUNT(*) as cnt, COALESCE(SUM(amount),0) as total, status FROM bk_claims WHERE case_id=${caseId}::uuid GROUP BY status`),
      db.execute(sql`SELECT COUNT(*) as cnt, COALESCE(SUM(estimated_value),0) as total FROM bk_assets WHERE case_id=${caseId}::uuid`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_meetings WHERE case_id=${caseId}::uuid`),
      db.execute(sql`SELECT COUNT(*) as cnt, COALESCE(SUM(total_amount),0) as total FROM bk_distributions WHERE case_id=${caseId}::uuid`),
    ]);

    const claimRows = sqlAll(claims);
    res.json({
      case: bkCase,
      creditorCount: Number(sqlOne(creditors)?.cnt ?? 0),
      claimsByStatus: claimRows,
      totalClaims: claimRows.reduce((s: number, r: any) => s + Number(r.cnt), 0),
      totalClaimsAmount: claimRows.reduce((s: number, r: any) => s + Number(r.total), 0),
      assetCount: Number(sqlOne(assets)?.cnt ?? 0),
      totalAssetsValue: Number(sqlOne(assets)?.total ?? 0),
      meetingCount: Number(sqlOne(meetings)?.cnt ?? 0),
      distributionCount: Number(sqlOne(dists)?.cnt ?? 0),
      totalDistributed: Number(sqlOne(dists)?.total ?? 0),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/* ══════════════════════════════════════════════════════════
   PHASE 1: TIMELINE ENGINE
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/cases/:id/timeline", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const rows   = sqlAll(await db.execute(sql`
      SELECT * FROM bk_timeline
      WHERE case_id=${caseId} AND office_id=${officeId}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get("/bankruptcy/timeline", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const limit  = Math.min(Number(req.query.limit ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const rows   = sqlAll(await db.execute(sql`
      SELECT t.*, bc.debtor_name, bc.case_number
      FROM bk_timeline t
      LEFT JOIN bankruptcy_cases bc ON bc.id::text = t.case_id
      WHERE t.office_id=${officeId}
      ORDER BY t.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 2: AUDIT LOGS (immutable, read-only)
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/audit-logs", requireAuth, async (req: any, res) => {
  const officeId  = req.tenantId as string;
  const action     = req.query.action     as string | undefined;
  const entityType = req.query.entity_type as string | undefined;
  const limit      = Math.min(Number(req.query.limit ?? 50), 200);
  const offset     = Number(req.query.offset ?? 0);
  try {
    const rows = sqlAll(await db.execute(sql`
      SELECT * FROM bk_audit_logs
      WHERE office_id=${officeId}
        ${action     ? sql`AND action=${action}`           : sql``}
        ${entityType ? sql`AND entity_type=${entityType}` : sql``}
      ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}
    `));
    res.json(rows);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 3: NOTIFICATION CENTER
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/notifications", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const limit    = Math.min(Number(req.query.limit ?? 50), 100);
  try {
    const rows       = sqlAll(await db.execute(sql`
      SELECT n.*, bc.debtor_name, bc.case_number
      FROM bk_notifications n
      LEFT JOIN bankruptcy_cases bc ON bc.id::text = n.related_case
      WHERE n.office_id=${officeId}
      ORDER BY n.created_at DESC LIMIT ${limit}
    `));
    const unreadCount = rows.filter((r: any) => r.status === "unread").length;
    res.json({ notifications: rows, unreadCount });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* NOTE: specific path BEFORE parameterized path */
router.put("/bankruptcy/notifications/read-all", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    await db.execute(sql`
      UPDATE bk_notifications SET status='read', read_at=NOW()
      WHERE office_id=${officeId} AND status='unread'
    `);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put("/bankruptcy/notifications/:id/read", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const id       = String(req.params.id);
  if (!isUUID(id)) return badId(res);
  try {
    await db.execute(sql`
      UPDATE bk_notifications SET status='read', read_at=NOW()
      WHERE id=${id}::uuid AND office_id=${officeId}
    `);
    res.json({ ok: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 4: EXECUTIVE DASHBOARD
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/executive-dashboard", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const [caseStats, claimStats, assetStats, distStats, monthlyActivity, timelineCount] =
      await Promise.all([
        db.execute(sql`SELECT status, COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId} AND deleted_at IS NULL GROUP BY status`),
        db.execute(sql`SELECT status, COUNT(*) as cnt, COALESCE(SUM(amount),0) as total FROM bk_claims WHERE office_id=${officeId} GROUP BY status`),
        db.execute(sql`SELECT asset_type, COUNT(*) as cnt, COALESCE(SUM(estimated_value),0) as total FROM bk_assets WHERE office_id=${officeId} GROUP BY asset_type ORDER BY total DESC`),
        db.execute(sql`SELECT COALESCE(SUM(total_amount),0) as total_distributed, COUNT(*) as cnt FROM bk_distributions WHERE office_id=${officeId} AND status='executed'`),
        db.execute(sql`SELECT TO_CHAR(DATE_TRUNC('month',created_at),'YYYY-MM') as month, COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId} AND created_at >= NOW()-INTERVAL '6 months' GROUP BY month ORDER BY month`),
        db.execute(sql`SELECT COUNT(*) as cnt FROM bk_timeline WHERE office_id=${officeId}`),
      ]);

    const caseRows   = sqlAll(caseStats);
    const claimRows  = sqlAll(claimStats);
    const distRow    = sqlOne(distStats);
    const totalCases = caseRows.reduce((s: number, r: any) => s + Number(r.cnt), 0);
    const totalClaims$ = claimRows.reduce((s: number, r: any) => s + Number(r.total), 0);
    const totalDist    = Number(distRow?.total_distributed ?? 0);
    const totalAssets$ = sqlAll(assetStats).reduce((s: number, r: any) => s + Number(r.total), 0);
    const approved$    = Number(claimRows.find((r: any) => r.status === "approved")?.total ?? 0);

    res.json({
      casesByStatus:    caseRows,
      totalCases,
      activeCases:      Number(caseRows.find((r: any) => r.status === "active")?.cnt ?? 0),
      closedCases:      Number(caseRows.find((r: any) => r.status === "closed")?.cnt ?? 0),
      claimsByStatus:   claimRows,
      totalClaims:      claimRows.reduce((s: number, r: any) => s + Number(r.cnt), 0),
      totalClaimsAmount: totalClaims$,
      approvedAmount:   approved$,
      totalDistributed: totalDist,
      totalAssetsValue: totalAssets$,
      assetsByType:     sqlAll(assetStats),
      monthlyActivity:  sqlAll(monthlyActivity),
      timelineEvents:   Number(sqlOne(timelineCount)?.cnt ?? 0),
      recoveryRate:     totalClaims$ > 0 ? Math.round((totalDist / totalClaims$) * 100) : 0,
      distributionRate: approved$ > 0 ? Math.round((totalDist / approved$) * 100) : 0,
      caseCompletionRate: totalCases > 0
        ? Math.round((Number(caseRows.find((r: any) => r.status === "closed")?.cnt ?? 0) / totalCases) * 100)
        : 0,
    });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 5: AI ASSISTANT QUICK ACTIONS
══════════════════════════════════════════════════════════ */
const AI_QUICK_ACTIONS: Record<string, { type: string; prompt: string }> = {
  analyze_claims:     { type: "claims",        prompt: "قيّم جميع المطالبات: صحتها القانونية، أولوياتها، واحتمالية القبول والرفض لكل مطالبة" },
  financial_analysis: { type: "financial",      prompt: "أجرِ تحليلاً مالياً شاملاً: نسبة الاسترداد المتوقعة، الفجوة المالية، والتوصيات العاجلة" },
  trustee_report:     { type: "trustee_report", prompt: "أنتج تقرير أمين إفلاس متكاملاً وفق نظام الإفلاس السعودي 1439هـ يتضمن جميع الإجراءات والتوصيات" },
  meeting_minutes:    { type: "general",        prompt: "اكتب محضر اجتماع دائنين رسمي يتضمن جدول الأعمال والقرارات والتوصيات والمقررات" },
  case_summary:       { type: "summary",        prompt: "أنتج ملخصاً تنفيذياً شاملاً للملف مع جميع الإحصاءات المالية لرفعه للمحكمة" },
  legal_risks:        { type: "risk",           prompt: "استخرج وحلّل جميع المخاطر القانونية المحتملة وقدّم خطة تخفيف منها" },
  financial_risks:    { type: "financial",      prompt: "استخرج وحلّل جميع المخاطر المالية وقدّم خطة عمل لمعالجتها" },
  recommendations:    { type: "general",        prompt: "بناءً على جميع معطيات الملف، قدّم توصيات استراتيجية شاملة لأمين الإفلاس والمحكمة" },
};

router.post("/bankruptcy/cases/:id/ai-assistant", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  const caseId   = String(req.params.id);
  if (!isUUID(caseId)) return badId(res);
  try {
    const { action } = req.body;
    const qa = AI_QUICK_ACTIONS[action];
    if (!qa) return res.status(400).json({ error: `الإجراء غير معروف. المتاح: ${Object.keys(AI_QUICK_ACTIONS).join(", ")}` });

    const caseRow = sqlOne(await db.execute(sql`
      SELECT bc.*,
        (SELECT COUNT(*) FROM bk_creditors WHERE case_id=bc.id) AS creditor_count,
        (SELECT COALESCE(SUM(amount),0) FROM bk_claims WHERE case_id=bc.id) AS total_claims,
        (SELECT COALESCE(SUM(estimated_value),0) FROM bk_assets WHERE case_id=bc.id) AS total_assets,
        (SELECT COALESCE(SUM(total_amount),0) FROM bk_distributions WHERE case_id=bc.id AND status='executed') AS total_distributed,
        (SELECT COUNT(*) FROM bk_claims WHERE case_id=bc.id AND status='approved') AS approved_claims,
        (SELECT COUNT(*) FROM bk_claims WHERE case_id=bc.id AND status='rejected') AS rejected_claims
      FROM bankruptcy_cases bc WHERE bc.id=${caseId}::uuid AND bc.office_id=${officeId}
    `));
    if (!caseRow) return res.status(404).json({ error: "الملف غير موجود" });

    const systemPrompt = `أنت مساعد ذكي متخصص في نظام الإفلاس السعودي (نظام الإفلاس 1439هـ وتعديلاته).
بيانات الملف الحالي:
رقم الملف: ${caseRow.case_number} | المدين: ${caseRow.debtor_name} (${caseRow.debtor_type})
نوع الإجراء: ${caseRow.procedure_type} | الحالة: ${caseRow.status}
المحكمة: ${caseRow.court_name ?? "غير محدد"} | أمين الإفلاس: ${caseRow.trustee_name ?? "غير محدد"}
عدد الدائنين: ${caseRow.creditor_count} | إجمالي المطالبات: ${Number(caseRow.total_claims).toLocaleString("ar-SA")} ر.س
إجمالي الأصول: ${Number(caseRow.total_assets).toLocaleString("ar-SA")} ر.س | إجمالي الموزَّع: ${Number(caseRow.total_distributed).toLocaleString("ar-SA")} ر.س
مطالبات مقبولة: ${caseRow.approved_claims} | مطالبات مرفوضة: ${caseRow.rejected_claims}
قدّم إجابة مفصلة ومنظمة ومهنية باللغة العربية مع ترقيم واضح للنقاط.`;

    const result = await callBkAI(systemPrompt, qa.prompt, officeId, "bankruptcy_qa", req.auth?.userId ?? "system");
    await db.execute(sql`
      INSERT INTO bk_ai_analysis (case_id, office_id, analysis_type, input_source, result, token_count)
      VALUES (${caseId}::uuid, ${officeId}, ${qa.type}, ${action}, ${result}, ${Math.ceil(result.length / 4)})
    `);
    void logTimeline(officeId, caseId, 'ai', caseId, 'ai_assistant_executed', `تحليل ذكي: ${action}`, req.auth?.userId);
    void tgBkAiAnalysis(officeId, caseRow.debtor_name ?? caseId, qa.type ?? "general");
    res.json({ result, action, analysisType: qa.type, caseId });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════
   PHASE 6: HEALTH CHECK
══════════════════════════════════════════════════════════ */
router.get("/bankruptcy/health", requireAuth, async (req: any, res) => {
  const officeId = req.tenantId as string;
  try {
    const [caseCount, timelineCount, notifCount, auditCount] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as cnt FROM bankruptcy_cases WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_timeline WHERE office_id=${officeId}`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_notifications WHERE office_id=${officeId} AND status='unread'`),
      db.execute(sql`SELECT COUNT(*) as cnt FROM bk_audit_logs WHERE office_id=${officeId}`),
    ]);
    res.json({
      status:         "healthy",
      officeId,
      isolation:      "tenant_verified",
      tables:         ["bankruptcy_cases","bk_creditors","bk_claims","bk_assets","bk_meetings","bk_distributions","bk_reports","bk_ai_analysis","bk_timeline","bk_audit_logs","bk_notifications"],
      counts: {
        cases:         Number(sqlOne(caseCount)?.cnt ?? 0),
        timelineEvents: Number(sqlOne(timelineCount)?.cnt ?? 0),
        unreadNotifs:  Number(sqlOne(notifCount)?.cnt ?? 0),
        auditRecords:  Number(sqlOne(auditCount)?.cnt ?? 0),
      },
      timestamp:      new Date().toISOString(),
      version:        "2.0-enterprise",
    });
  } catch (err: any) { res.status(500).json({ status: "unhealthy", error: err.message }); }
});

export default router;
