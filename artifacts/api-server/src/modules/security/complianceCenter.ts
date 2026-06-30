import { Router } from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { auditLog, auditMeta } from "../../lib/auditLogger";

const router = Router();
const saGuard = requireSuperAdmin;

(async () => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS compliance_controls (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        framework   TEXT NOT NULL DEFAULT 'PDPL',
        control_id  TEXT NOT NULL,
        title       TEXT NOT NULL,
        description TEXT,
        status      TEXT DEFAULT 'pending',
        evidence    TEXT,
        owner       TEXT,
        due_date    DATE,
        updated_at  TIMESTAMPTZ DEFAULT NOW(),
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(framework, control_id)
      );
      CREATE TABLE IF NOT EXISTS data_requests (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_type TEXT NOT NULL,
        requester_id TEXT,
        office_id    TEXT,
        subject_email TEXT,
        status       TEXT DEFAULT 'pending',
        notes        TEXT,
        completed_at TIMESTAMPTZ,
        completed_by TEXT,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS retention_policies (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type   TEXT NOT NULL UNIQUE,
        retention_days  INTEGER NOT NULL,
        auto_delete     BOOLEAN DEFAULT false,
        legal_hold      BOOLEAN DEFAULT false,
        last_run        TIMESTAMPTZ,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS legal_holds (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title       TEXT NOT NULL,
        description TEXT,
        resources   TEXT[],
        office_id   TEXT,
        created_by  TEXT,
        expires_at  TIMESTAMPTZ,
        status      TEXT DEFAULT 'active',
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);
      CREATE INDEX IF NOT EXISTS idx_compliance_controls_framework ON compliance_controls(framework);
    `);

    await db.execute(sql`
      INSERT INTO compliance_controls (framework, control_id, title, description, status) VALUES
        ('PDPL', 'PDPL-1',  'حقوق الوصول إلى البيانات',        'المستخدم له حق الاطلاع على بياناته الشخصية', 'compliant'),
        ('PDPL', 'PDPL-2',  'حق التصحيح',                       'يمكن للمستخدم تصحيح بياناته غير الصحيحة', 'compliant'),
        ('PDPL', 'PDPL-3',  'حق الحذف',                         'طلبات حذف البيانات الشخصية', 'in_progress'),
        ('PDPL', 'PDPL-4',  'سياسة الاحتفاظ بالبيانات',         'تحديد فترات الاحتفاظ بكل نوع من البيانات', 'in_progress'),
        ('PDPL', 'PDPL-5',  'موافقة البيانات',                   'الحصول على موافقة صريحة قبل معالجة البيانات', 'compliant'),
        ('PDPL', 'PDPL-6',  'الإشعار بالانتهاكات',               'إشعار المختصين عند حدوث اختراق أمني', 'compliant'),
        ('PDPL', 'PDPL-7',  'نقل البيانات عبر الحدود',           'ضوابط نقل البيانات للخارج', 'pending'),
        ('PDPL', 'PDPL-8',  'تعيين مسؤول حماية البيانات',         'تعيين DPO مؤهّل', 'pending'),
        ('SOC2', 'SOC2-A1', 'إمكانية الوصول',                    'ضوابط إمكانية الوصول للنظام', 'compliant'),
        ('SOC2', 'SOC2-A2', 'سرية البيانات',                     'تشفير البيانات في حالة السكون والنقل', 'compliant'),
        ('SOC2', 'SOC2-A3', 'سلامة البيانات',                    'التحقق من سلامة البيانات', 'compliant'),
        ('SOC2', 'SOC2-A4', 'التوافر',                           'ضمان استمرارية الخدمة 99.9%', 'in_progress'),
        ('ISO27001', 'ISO-A5', 'سياسات أمن المعلومات',            'توثيق وتطبيق سياسات أمن المعلومات', 'in_progress'),
        ('ISO27001', 'ISO-A9', 'التحكم في الوصول',                'إدارة صلاحيات الوصول', 'compliant')
      ON CONFLICT (framework, control_id) DO NOTHING
    `).catch(() => {});

    await db.execute(sql`
      INSERT INTO retention_policies (resource_type, retention_days, auto_delete, legal_hold) VALUES
        ('audit_logs',    2555, false, true),
        ('login_logs',    365,  false, false),
        ('documents',     3650, false, true),
        ('cases',         3650, false, true),
        ('messages',      730,  false, false),
        ('system_events', 90,   true,  false)
      ON CONFLICT (resource_type) DO NOTHING
    `).catch(() => {});
  } catch {}
})();

async function safeQuery(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function safeOne(q: any): Promise<any> {
  return (await safeQuery(q))[0] ?? null;
}

/* ── Phase 6: Compliance Center ─────────────────────────────────────── */

router.get("/compliance/overview", saGuard, async (_req, res) => {
  try {
    const [controls, requests, policies, holds, termsAcceptance] = await Promise.all([
      safeQuery(sql`SELECT framework, status, COUNT(*) as count FROM compliance_controls GROUP BY framework, status ORDER BY framework`),
      safeQuery(sql`SELECT status, COUNT(*) as count FROM data_requests GROUP BY status`),
      safeQuery(sql`SELECT * FROM retention_policies ORDER BY resource_type`),
      safeQuery(sql`SELECT * FROM legal_holds WHERE status='active' ORDER BY created_at DESC`),
      safeOne(sql`
        SELECT COUNT(*) as total,
               SUM(CASE WHEN accepted_terms=true THEN 1 ELSE 0 END) as accepted
        FROM billing WHERE accepted_terms IS NOT NULL
      `).catch(() => null),
    ]);

    const totalControls   = controls.reduce((s: number, r: any) => s + Number(r.count), 0);
    const compliantCount  = controls.filter((c: any) => c.status === "compliant").reduce((s: number, r: any) => s + Number(r.count), 0);
    const complianceScore = totalControls > 0 ? Math.round((compliantCount / totalControls) * 100) : 0;

    res.json({ controls, requests, policies, holds, termsAcceptance, complianceScore, totalControls, compliantCount });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/compliance/controls", saGuard, async (req, res) => {
  const { framework } = req.query as any;
  const rows = framework
    ? await safeQuery(sql`SELECT * FROM compliance_controls WHERE framework=${framework} ORDER BY control_id`)
    : await safeQuery(sql`SELECT * FROM compliance_controls ORDER BY framework, control_id`);
  res.json(rows);
});

router.patch("/compliance/controls/:id", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const { status, evidence, owner, due_date } = req.body;
    const meta = auditMeta(req);
    const old = await safeOne(sql`SELECT * FROM compliance_controls WHERE id=${id}`);
    await db.execute(sql`
      UPDATE compliance_controls SET
        status=${status ?? old?.status},
        evidence=${evidence ?? old?.evidence},
        owner=${owner ?? old?.owner},
        due_date=${due_date ?? old?.due_date},
        updated_at=NOW()
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: "COMPLIANCE_CONTROL_UPDATED", resource: "compliance_controls", resourceId: id, oldValue: old, newValue: { status, evidence } });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/compliance/data-requests", saGuard, async (req, res) => {
  const { status } = req.query as any;
  const rows = status
    ? await safeQuery(sql`SELECT * FROM data_requests WHERE status=${status} ORDER BY created_at DESC`)
    : await safeQuery(sql`SELECT * FROM data_requests ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/compliance/data-requests", saGuard, async (req, res) => {
  try {
    const { request_type, subject_email, notes, office_id } = req.body;
    const meta = auditMeta(req);
    const [row] = await safeQuery(sql`
      INSERT INTO data_requests (request_type, requester_id, office_id, subject_email, notes)
      VALUES (${request_type}, ${meta.userId ?? null}, ${office_id ?? null}, ${subject_email}, ${notes ?? null})
      RETURNING id
    `);
    await auditLog({ ...meta, action: "DATA_REQUEST_CREATED", resource: "data_requests", resourceId: row?.id, details: `${request_type} for ${subject_email}` });
    res.json({ ok: true, id: row?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch("/compliance/data-requests/:id", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const { status, notes } = req.body;
    const meta = auditMeta(req);
    await db.execute(sql`
      UPDATE data_requests SET status=${status}, notes=${notes ?? null},
        completed_at=${status === 'completed' ? new Date().toISOString() : null},
        completed_by=${status === 'completed' ? (meta.userId ?? null) : null}
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: "DATA_REQUEST_UPDATED", resource: "data_requests", resourceId: id, details: `Status: ${status}` });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/compliance/retention-policies", saGuard, async (_req, res) => {
  const rows = await safeQuery(sql`SELECT * FROM retention_policies ORDER BY resource_type`);
  res.json(rows);
});

router.patch("/compliance/retention-policies/:id", saGuard, async (req, res) => {
  try {
    const { id } = req.params as any;
    const { retention_days, auto_delete, legal_hold } = req.body;
    const meta = auditMeta(req);
    await db.execute(sql`
      UPDATE retention_policies SET retention_days=${retention_days}, auto_delete=${auto_delete}, legal_hold=${legal_hold}
      WHERE id=${id}
    `);
    await auditLog({ ...meta, action: "RETENTION_POLICY_UPDATED", resource: "retention_policies", resourceId: id });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/compliance/legal-holds", saGuard, async (_req, res) => {
  const rows = await safeQuery(sql`SELECT * FROM legal_holds ORDER BY created_at DESC`);
  res.json(rows);
});

router.post("/compliance/legal-holds", saGuard, async (req, res) => {
  try {
    const { title, description, resources, office_id, expires_at } = req.body;
    const meta = auditMeta(req);
    const [row] = await safeQuery(sql`
      INSERT INTO legal_holds (title, description, resources, office_id, created_by, expires_at)
      VALUES (${title}, ${description ?? null}, ${resources ?? []}::text[], ${office_id ?? null}, ${meta.userId ?? null}, ${expires_at ?? null})
      RETURNING id
    `);
    await auditLog({ ...meta, action: "LEGAL_HOLD_CREATED", resource: "legal_holds", resourceId: row?.id, details: title });
    res.json({ ok: true, id: row?.id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/compliance/report", saGuard, async (req, res) => {
  try {
    const meta = auditMeta(req);
    const [controls, requests, holds, auditCoverage, termsData] = await Promise.all([
      safeQuery(sql`SELECT * FROM compliance_controls ORDER BY framework, control_id`),
      safeQuery(sql`SELECT request_type, status, COUNT(*) as count FROM data_requests GROUP BY request_type, status`),
      safeQuery(sql`SELECT * FROM legal_holds WHERE status='active'`),
      safeOne(sql`SELECT COUNT(DISTINCT resource) as covered FROM audit_logs`),
      safeOne(sql`SELECT COUNT(*) as total, SUM(CASE WHEN accepted_terms THEN 1 ELSE 0 END) as accepted FROM billing`).catch(() => null),
    ]);

    const total     = controls.length;
    const compliant = controls.filter((c: any) => c.status === "compliant").length;
    const score     = total > 0 ? Math.round((compliant / total) * 100) : 0;

    res.json({
      generatedAt: new Date().toISOString(),
      complianceScore: score,
      controls: { total, compliant, inProgress: controls.filter((c: any) => c.status === "in_progress").length, pending: controls.filter((c: any) => c.status === "pending").length },
      dataRequests: requests,
      legalHolds: holds.length,
      auditCoverage: Number(auditCoverage?.covered ?? 0),
      termsAcceptance: termsData,
      frameworks: [...new Set(controls.map((c: any) => c.framework))],
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
