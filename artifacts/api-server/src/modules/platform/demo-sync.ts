/**
 * 🔄 Demo Sync Engine — عدالة AI
 * ══════════════════════════════════════════════════════════
 * يزامن مكاتب الديمو/الاختبار مع إعدادات الإنتاج الحالية.
 *
 * Production = plan_cms + office_registry defaults  (مصدر الحقيقة)
 * Demo Tenants = يجب أن تعكس الإنتاج دائماً
 *
 * Routes (isSuperAdmin):
 *  GET  /demo-sync/status   — حالة جميع مكاتب الديمو + Drift score
 *  POST /demo-sync/run      — تشغيل المزامنة الكاملة
 *  GET  /demo-sync/history  — سجل المزامنات السابقة
 *  POST /demo-sync/reseed/:officeId — إعادة زرع بيانات ديمو لمكتب
 */

import { Router }    from "express";
import { requireSuperAdmin } from "../../middlewares/requireAuth";
import { db }        from "@workspace/db";
import { sql }       from "drizzle-orm";
import { getAuth }   from "@clerk/express";
import cron          from "node-cron";
import { logger }    from "../../lib/logger";

const router = Router();
const guard = requireSuperAdmin;

/* ── Demo office registry ───────────────────────────────────────── */
// office_registry columns: id(text), office_name, plan_name, status, clerk_user_id, owner_email, joined_at
const DEMO_OFFICES = [
  { id: "ddddeeee-0000-0000-0000-000000000099", label: "مكتب التجربة",  targetPlan: "Professional" },
  { id: "aaaabbbb-0001-0001-0001-000000000001", label: "مكتب الشمال",   targetPlan: "Professional" },
  { id: "bbbbcccc-0002-0002-0002-000000000002", label: "مكتب الجنوب",   targetPlan: "Professional" },
];

/* ── Guard ──────────────────────────────────────────────────────── */
function toRows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }

/* ══════════════════════════════════════════════════════════════════
   PRODUCTION SOURCE — reads the authoritative config from plan_cms
══════════════════════════════════════════════════════════════════ */
async function fetchProductionConfig() {
  const plans = toRows(await db.execute(sql`
    SELECT id, name_ar, monthly_price, yearly_price, features, feature_flags, limits,
           recommended, sort_order, updated_at
    FROM plan_cms
    ORDER BY sort_order ASC
  `).catch(() => ({ rows: [] })));

  const recommendedPlan = plans.find((p: any) => p.recommended) ?? plans[1] ?? plans[0];

  return {
    plans,
    recommendedPlan,
    version: `prod-${Date.now()}`,
    capturedAt: new Date().toISOString(),
  };
}

/* ══════════════════════════════════════════════════════════════════
   DRIFT GUARD — compares demo offices vs production config
══════════════════════════════════════════════════════════════════ */
async function detectDrift(prodConfig: any) {
  const issues: Array<{
    officeId: string; label: string; type: string; detail: string; severity: "critical"|"high"|"medium"|"low"
  }> = [];

  for (const demo of DEMO_OFFICES) {
    // office_registry.id is text — no ::uuid cast
    const rows = toRows(await db.execute(sql`
      SELECT id, office_name, plan_name, status, joined_at
      FROM office_registry WHERE id = ${demo.id}
    `).catch(() => ({ rows: [] })));

    if (rows.length === 0) {
      issues.push({ officeId: demo.id, label: demo.label, type: "MISSING_OFFICE", detail: "المكتب غير موجود في قاعدة البيانات", severity: "critical" });
      continue;
    }

    const office = rows[0];

    if (office.status !== "active") {
      issues.push({ officeId: demo.id, label: demo.label, type: "INACTIVE", detail: `الحالة: ${office.status}`, severity: "high" });
    }

    // Check if plan_name matches targetPlan (case-insensitive)
    const currentPlan = String(office.plan_name ?? "").toLowerCase();
    const targetPlan  = String(demo.targetPlan).toLowerCase();
    if (currentPlan !== targetPlan) {
      issues.push({ officeId: demo.id, label: demo.label, type: "PLAN_DRIFT", detail: `الخطة الحالية "${office.plan_name}" ≠ المطلوبة "${demo.targetPlan}"`, severity: "medium" });
    }

    // cases.office_id is text
    const caseCount = toRows(await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM cases WHERE office_id = ${demo.id}
    `).catch(() => []));
    if (Number(caseCount[0]?.cnt ?? 0) === 0) {
      issues.push({ officeId: demo.id, label: demo.label, type: "NO_DEMO_DATA", detail: "لا توجد قضايا تجريبية", severity: "medium" });
    }

    // clients.office_id is text
    const clientCount = toRows(await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM clients WHERE office_id = ${demo.id}
    `).catch(() => []));
    if (Number(clientCount[0]?.cnt ?? 0) === 0) {
      issues.push({ officeId: demo.id, label: demo.label, type: "NO_DEMO_CLIENTS", detail: "لا يوجد عملاء تجريبيون", severity: "medium" });
    }
  }

  return issues;
}

/* ══════════════════════════════════════════════════════════════════
   SYNC ENGINE — applies production config to demo offices
══════════════════════════════════════════════════════════════════ */
async function syncDemoOffices(prodConfig: any) {
  const actions: Array<{ officeId: string; label: string; action: string; result: string; ms: number }> = [];
  const errors: string[] = [];

  for (const demo of DEMO_OFFICES) {
    /* 1. Update plan_name to targetPlan (office already exists, id is text) */
    const t0 = Date.now();
    try {
      await db.execute(sql`
        UPDATE office_registry
        SET plan_name = ${demo.targetPlan}, status = 'active'
        WHERE id = ${demo.id}
      `);
      actions.push({ officeId: demo.id, label: demo.label, action: "SYNC_PLAN", result: `plan_name → ${demo.targetPlan}`, ms: Date.now()-t0 });
    } catch (e: any) {
      errors.push(`${demo.label}: plan sync failed — ${e.message}`);
    }

    /* 2. Ensure demo clients exist (clients.id=uuid, clients.office_id=text) */
    const t1 = Date.now();
    const demoClients = getDemoClients(demo.id);
    let clientsAdded = 0;
    for (const c of demoClients) {
      await db.execute(sql`
        INSERT INTO clients (id, full_name, email, phone, type, office_id, created_at, updated_at)
        VALUES (${c.id}::uuid, ${c.name}, ${c.email}, ${c.phone}, ${c.type}, ${demo.id}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `).then(() => { clientsAdded++; }).catch(() => {});
    }
    actions.push({ officeId: demo.id, label: demo.label, action: "SYNC_CLIENTS", result: `${clientsAdded}/${demoClients.length} عميل`, ms: Date.now()-t1 });

    /* 3. Ensure demo cases exist (cases.id=text, cases.office_id=text, no client_id — uses client_name) */
    const t2 = Date.now();
    const demoCases = getDemoCases(demo.id);
    let casesAdded = 0;
    for (const c of demoCases) {
      await db.execute(sql`
        INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
        VALUES (${c.id}, ${c.title}, ${c.cn}, ${c.caseType}, ${c.status}, ${c.clientName}, ${demo.id}, NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `).then(() => { casesAdded++; }).catch(() => {});
    }
    actions.push({ officeId: demo.id, label: demo.label, action: "SYNC_CASES", result: `${casesAdded}/${demoCases.length} قضية`, ms: Date.now()-t2 });

    /* 4. Log */
    await db.execute(sql`
      INSERT INTO demo_sync_log (office_id, office_label, synced_plan, actions_count, triggered_by, synced_at)
      VALUES (${demo.id}, ${demo.label}, ${demo.targetPlan}, ${3}, 'manual', NOW())
    `).catch(() => {});
  }

  return { actions, errors, syncedCount: DEMO_OFFICES.length };
}

/* ── Demo seed data per office ──────────────────────────────────── */
function getDemoClients(officeId: string) {
  const prefix = officeId.replace(/-/g,"").slice(0,8);
  return [
    { id: `${prefix.slice(0,4)}cc01-0000-0000-0000-000000000001`, name: "شركة النخبة للاستثمار",     email: `info+${prefix}@nukhba.sa`,    phone: "0501234567", type: "company"    },
    { id: `${prefix.slice(0,4)}cc02-0000-0000-0000-000000000002`, name: "خالد الزهراني",              email: `k+${prefix}@zahrani.sa`,      phone: "0559876543", type: "individual" },
    { id: `${prefix.slice(0,4)}cc03-0000-0000-0000-000000000003`, name: "مجموعة الأفق التجارية",     email: `legal+${prefix}@ufuq.sa`,    phone: "0112345678", type: "company"    },
  ];
}
function getDemoCases(officeId: string) {
  const prefix = officeId.replace(/-/g,"").slice(0,8);
  const clients = getDemoClients(officeId);
  return [
    { id: `${prefix.slice(0,4)}ca01-0000-0000-0000-000000000001`, title: "نزاع عقاري — حي الملقا",         caseType: "عقاري",       status: "open",    clientName: clients[0].name, cn: `${new Date().getFullYear()}/E/1024` },
    { id: `${prefix.slice(0,4)}ca02-0000-0000-0000-000000000002`, title: "مطالبة تأمينية — حادثة مرورية", caseType: "تأمين",       status: "open",    clientName: clients[1].name, cn: `${new Date().getFullYear()}/T/0387` },
    { id: `${prefix.slice(0,4)}ca03-0000-0000-0000-000000000003`, title: "عقد شراكة تجارية — تحكيم",     caseType: "تجاري",       status: "pending", clientName: clients[2].name, cn: `${new Date().getFullYear()}/C/0291` },
    { id: `${prefix.slice(0,4)}ca04-0000-0000-0000-000000000004`, title: "دعوى عمالية — فصل تعسفي",      caseType: "عمالي",       status: "open",    clientName: clients[1].name, cn: `${new Date().getFullYear()}/L/0534` },
    { id: `${prefix.slice(0,4)}ca05-0000-0000-0000-000000000005`, title: "ملكية فكرية — علامة تجارية",    caseType: "ملكية فكرية", status: "closed",  clientName: clients[0].name, cn: `${new Date().getFullYear()-1}/IP/198` },
  ];
}

/* ── Ensure sync log table ──────────────────────────────────────── */
async function ensureTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS demo_sync_log (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id    TEXT NOT NULL,
      office_label TEXT NOT NULL,
      synced_plan  TEXT,
      actions_count INT DEFAULT 0,
      triggered_by TEXT DEFAULT 'manual',
      synced_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});
}
ensureTables();

/* ══════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════ */

/* GET /demo-sync/status */
router.get("/demo-sync/status", guard, async (_req, res) => {
  try {
    const prodConfig = await fetchProductionConfig();
    const driftIssues = await detectDrift(prodConfig);

    const officeSnapshots = await Promise.all(DEMO_OFFICES.map(async demo => {
      const rows = toRows(await db.execute(sql`
        SELECT id, office_name, plan_name, status, joined_at FROM office_registry WHERE id = ${demo.id}
      `).catch(() => ({ rows: [] })));
      const casesR  = toRows(await db.execute(sql`SELECT COUNT(*) AS cnt FROM cases   WHERE office_id = ${demo.id}`).catch(() => []));
      const clientsR = toRows(await db.execute(sql`SELECT COUNT(*) AS cnt FROM clients WHERE office_id = ${demo.id}`).catch(() => []));
      const office = rows[0] ?? null;
      const myDrift = driftIssues.filter(d => d.officeId === demo.id);
      return {
        ...demo,
        exists: !!office,
        plan: office?.plan_name ?? null,
        status: office?.status ?? "missing",
        joinedAt: office?.joined_at ?? null,
        caseCount: Number(casesR[0]?.cnt ?? 0),
        clientCount: Number(clientsR[0]?.cnt ?? 0),
        drift: myDrift,
        driftScore: myDrift.filter(d => d.severity === "critical").length * 3
                  + myDrift.filter(d => d.severity === "high").length * 2
                  + myDrift.filter(d => d.severity === "medium").length,
        inSync: myDrift.length === 0,
      };
    }));

    const lastSync = toRows(await db.execute(sql`
      SELECT * FROM demo_sync_log ORDER BY synced_at DESC LIMIT 5
    `).catch(() => []));

    res.json({
      demoOffices: officeSnapshots,
      prodConfig: { planCount: prodConfig.plans.length, capturedAt: prodConfig.capturedAt },
      totalDrift: driftIssues.length,
      criticalDrift: driftIssues.filter(d => d.severity === "critical").length,
      allInSync: driftIssues.length === 0,
      lastSync,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /demo-sync/run */
router.post("/demo-sync/run", guard, async (req, res) => {
  try {
    const t0 = Date.now();
    const prodConfig = await fetchProductionConfig();
    const driftBefore = await detectDrift(prodConfig);
    const syncResult = await syncDemoOffices(prodConfig);
    const driftAfter = await detectDrift(prodConfig);

    await db.execute(sql`
      INSERT INTO demo_sync_log (office_id, office_label, synced_plan, actions_count, triggered_by, synced_at)
      VALUES (gen_random_uuid()::text, 'all-offices', 'professional', ${syncResult.actions.length}, 'manual', NOW())
    `).catch(() => {});

    logger.info({ actions: syncResult.actions.length, ms: Date.now()-t0 }, "[DemoSync] Sync complete");

    res.json({
      status: "SYNC_COMPLETE",
      driftBefore: driftBefore.length,
      driftAfter: driftAfter.length,
      driftFixed: driftBefore.length - driftAfter.length,
      syncedOffices: DEMO_OFFICES.length,
      actions: syncResult.actions,
      errors: syncResult.errors,
      elapsedMs: Date.now() - t0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* GET /demo-sync/history */
router.get("/demo-sync/history", guard, async (_req, res) => {
  try {
    const rows = toRows(await db.execute(sql`
      SELECT * FROM demo_sync_log ORDER BY synced_at DESC LIMIT 50
    `));
    res.json({ history: rows, total: rows.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* POST /demo-sync/reseed/:officeId */
router.post("/demo-sync/reseed/:officeId", guard, async (req, res) => {
  try {
    const { officeId } = req.params as Record<string,string>;
    const demo = DEMO_OFFICES.find(d => d.id === officeId);
    if (!demo) return res.status(400).json({ error: "ليس مكتب ديمو معروفاً" });

    const clients = getDemoClients(officeId);
    const cases   = getDemoCases(officeId);
    let seeded = 0;

    for (const c of clients) {
      await db.execute(sql`
        INSERT INTO clients (id, full_name, email, phone, type, office_id, created_at, updated_at)
        VALUES (${c.id}::uuid, ${c.name}, ${c.email}, ${c.phone}, ${c.type}, ${demo.id}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET full_name=EXCLUDED.full_name, email=EXCLUDED.email
      `).catch(() => {});
      seeded++;
    }
    for (const c of cases) {
      await db.execute(sql`
        INSERT INTO cases (id, title, case_number, case_type, status, client_name, office_id, created_at, updated_at)
        VALUES (${c.id}, ${c.title}, ${c.cn}, ${c.caseType}, ${c.status}, ${c.clientName}, ${demo.id}, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, status=EXCLUDED.status, updated_at=NOW()
      `).catch(() => {});
      seeded++;
    }

    res.json({ status: "RESEEDED", officeId, label: demo.label, seeded });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════════════════════
   CRON — auto sync every hour (development only — skip in production)
══════════════════════════════════════════════════════════════════ */
cron.schedule("0 * * * *", async () => {
  if (process.env.NODE_ENV === "production") return; // no demo sync in prod
  try {
    logger.info("[DemoSync] Hourly auto-sync starting…");
    const prodConfig = await fetchProductionConfig();
    const result = await syncDemoOffices(prodConfig);
    await db.execute(sql`
      INSERT INTO demo_sync_log (office_id, office_label, synced_plan, actions_count, triggered_by, synced_at)
      VALUES (gen_random_uuid()::text, 'all-offices', 'professional', ${result.actions.length}, 'cron', NOW())
    `).catch(() => {});
    logger.info({ actions: result.actions.length }, "[DemoSync] Hourly sync done ✅");
  } catch (e: any) {
    logger.error({ err: e.message }, "[DemoSync] Hourly sync failed");
  }
});

export default router;
