/**
 * 🧠 SaaS Operating System — عدالة AI  (Core OS v2)
 * ════════════════════════════════════════════════════
 * 4 طبقات:
 *  1. 📡 Event System    — تتبع الأحداث الحية
 *  2. 🧠 AI CEO Engine   — القرار الاستراتيجي
 *  3. ⚙️  Action Queue   — تنفيذ آمن (بدون تعديل Prod)
 *  4. 🧪 Safety Guard    — حماية من القرارات الخاطئة
 *
 * Routes (all isSuperAdmin):
 *  POST /saas-os/track         — تتبع حدث
 *  GET  /saas-os/events        — عرض الأحداث + مقاييسها
 *  GET  /saas-os/actions       — قائمة انتظار الإجراءات
 *  GET  /saas-os/snapshot      — لقطة مقاييس المنصة الحية
 *  GET  /saas-os/optimize      — محرك التحسين التلقائي
 *  POST /saas-os/forecast      — AI Forecasting (Gemini)
 *  POST /saas-os/ceo-decision  — AI CEO Decision Layer
 *  POST /saas-os/run           — Orchestrator كامل + Safety
 */

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { callAI } from "../ai/aiChat";

const router = Router();

/* ── isSuperAdmin guard ────────────────────────────────────────────── */
function isSuperAdmin(req: any): boolean {
  try {
    const auth = getAuth(req);
    const meta = (auth as any)?.sessionClaims?.publicMetadata as any;
    if (meta?.role === "super_admin") return true;
    const allowed = (process.env.VITE_SUPER_ADMIN_EMAILS ?? "").split(",").map(s => s.trim());
    const email = (auth as any)?.sessionClaims?.email as string ?? "";
    return allowed.includes(email);
  } catch { return false; }
}

function ctGuard(req: any, res: any, next: any) {
  if (!isSuperAdmin(req)) return res.status(403).json({ error: "super_admin only" });
  next();
}

/* ── sqlOne helper ─────────────────────────────────────────────────── */
function toRows(r: any): any[] {
  return Array.isArray(r) ? r : (r?.rows ?? []);
}

/* ═══════════════════════════════════════════════════════════════════
   1. SNAPSHOT — مقاييس المنصة الحية
═══════════════════════════════════════════════════════════════════ */

async function buildSnapshot() {
  const mem = process.memoryUsage();
  const memPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);

  const [officesRow, usersRow, casesRow, invoiceRow, revenueRow,
         newOfficesRow, aiRow, pendingRow, overdueRow, churnRow] = await Promise.all([

    db.execute(sql`SELECT COUNT(*)::int AS n FROM office_registry WHERE status = 'active'`),
    db.execute(sql`SELECT COUNT(DISTINCT user_id)::int AS n FROM office_members`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM cases`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM client_invoices WHERE status = 'paid'`),
    db.execute(sql`SELECT COALESCE(SUM(total),0)::float AS n FROM client_invoices WHERE status = 'paid'`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM office_registry WHERE joined_at > NOW() - INTERVAL '30 days'`),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM ai_tasks WHERE created_at > NOW() - INTERVAL '24 hours'`).catch(() => db.execute(sql`SELECT 0::int AS n`)),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM ai_tasks WHERE status = 'pending'`).catch(() => db.execute(sql`SELECT 0::int AS n`)),
    db.execute(sql`SELECT COUNT(*)::int AS n FROM client_invoices WHERE status IN ('pending','draft') AND due_date IS NOT NULL AND due_date < to_char(NOW(), 'YYYY-MM-DD')`),
    db.execute(sql`
      SELECT COUNT(*)::int AS n FROM office_registry
      WHERE status = 'active'
        AND joined_at < NOW() - INTERVAL '60 days'
        AND id NOT IN (
          SELECT DISTINCT office_id FROM office_members
          WHERE created_at > NOW() - INTERVAL '30 days'
        )
    `).catch(() => db.execute(sql`SELECT 0::int AS n`)),
  ]);

  const g = (r: any) => Number(toRows(r)[0]?.n ?? 0);

  const activeOffices   = g(officesRow);
  const totalUsers      = g(usersRow);
  const totalCases      = g(casesRow);
  const paidInvoices    = g(invoiceRow);
  const totalRevenue    = g(revenueRow);
  const newOffices30d   = g(newOfficesRow);
  const aiTasks24h      = g(aiRow);
  const aiPending       = g(pendingRow);
  const overdueInvoices = g(overdueRow);
  const atRiskOffices   = g(churnRow);

  const avgRevenuePerOffice = activeOffices > 0 ? Math.round(totalRevenue / activeOffices) : 0;
  const churnRisk = activeOffices > 0 ? Math.round((atRiskOffices / activeOffices) * 100) : 0;
  const dbStart = Date.now();
  await db.execute(sql`SELECT 1`);
  const dbLatency = Date.now() - dbStart;

  return {
    platform: {
      activeOffices,
      totalUsers,
      totalCases,
      newOffices30d,
      atRiskOffices,
      churnRisk,
    },
    finance: {
      totalRevenue,
      paidInvoices,
      overdueInvoices,
      avgRevenuePerOffice,
      mrr: Math.round(totalRevenue / 12),
    },
    ai: {
      tasks24h: aiTasks24h,
      pending: aiPending,
    },
    system: {
      memPct,
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      dbLatencyMs: dbLatency,
      uptimeMin: Math.round(process.uptime() / 60),
    },
    capturedAt: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   2. AUTO OPTIMIZER — محرك التحسين التلقائي (rule-based)
═══════════════════════════════════════════════════════════════════ */

interface OptimizationAction {
  priority: "critical" | "high" | "medium" | "low";
  category: "retention" | "revenue" | "growth" | "ops" | "ai";
  action: string;
  reason: string;
  metric?: string;
}

function runOptimizer(snap: Awaited<ReturnType<typeof buildSnapshot>>): OptimizationAction[] {
  const actions: OptimizationAction[] = [];
  const { platform, finance, ai, system } = snap;

  /* Churn & Retention */
  if (platform.churnRisk > 20) {
    actions.push({
      priority: "critical", category: "retention",
      action: "تفعيل حملة الاحتفاظ — Retention Campaign",
      reason: `${platform.churnRisk}% من المكاتب في خطر الإيقاف`,
      metric: `${platform.atRiskOffices} مكتب معرَّض للفقدان`,
    });
  }

  /* Revenue */
  if (finance.overdueInvoices > 5) {
    actions.push({
      priority: "high", category: "revenue",
      action: "تفعيل تحصيل الفواتير المتأخرة تلقائياً",
      reason: `${finance.overdueInvoices} فاتورة متأخرة السداد`,
      metric: `خطر فقدان إيرادات`,
    });
  }
  if (finance.avgRevenuePerOffice < 500) {
    actions.push({
      priority: "high", category: "revenue",
      action: "مراجعة استراتيجية التسعير — اقتراح رفع الأسعار",
      reason: `متوسط إيراد المكتب منخفض: ${finance.avgRevenuePerOffice} ر.س`,
      metric: `MRR الحالي: ${finance.mrr} ر.س`,
    });
  }

  /* Growth */
  if (platform.newOffices30d < 3) {
    actions.push({
      priority: "high", category: "growth",
      action: "تكثيف جهود التسويق وبرامج الإحالة",
      reason: `مكاتب جديدة هذا الشهر: ${platform.newOffices30d} فقط`,
      metric: "نمو أقل من المستهدف",
    });
  }
  if (platform.activeOffices > 50) {
    actions.push({
      priority: "medium", category: "growth",
      action: "إطلاق خطة Enterprise للمكاتب الكبيرة",
      reason: `${platform.activeOffices} مكتب نشط — جاهز للتوسع`,
      metric: "حجم السوق يدعم Enterprise",
    });
  }

  /* AI Usage */
  if (ai.pending > 20) {
    actions.push({
      priority: "high", category: "ai",
      action: "زيادة طاقة معالجة مهام AI",
      reason: `${ai.pending} مهمة AI معلّقة`,
      metric: "احتمال تأخر استجابة المستخدمين",
    });
  }
  if (ai.tasks24h > 100) {
    actions.push({
      priority: "low", category: "ai",
      action: "تطوير قدرات AI لتلبية الطلب المتزايد",
      reason: `${ai.tasks24h} طلب AI في 24 ساعة — طلب قوي`,
      metric: "فرصة توسع في الميزات",
    });
  }

  /* System */
  if (system.memPct > 85) {
    actions.push({
      priority: "critical", category: "ops",
      action: "ترقية الخادم — زيادة الذاكرة الفورية",
      reason: `استهلاك ذاكرة: ${system.memPct}%`,
      metric: "خطر انهيار الخدمة",
    });
  }
  if (system.dbLatencyMs > 500) {
    actions.push({
      priority: "high", category: "ops",
      action: "تحسين قاعدة البيانات — إضافة indexes",
      reason: `زمن استجابة DB: ${system.dbLatencyMs}ms`,
      metric: "أداء أقل من المطلوب",
    });
  }

  return actions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.priority] - order[b.priority];
  });
}

/* ═══════════════════════════════════════════════════════════════════
   3. AI FORECAST — توقع المستقبل
═══════════════════════════════════════════════════════════════════ */

async function runForecast(snap: Awaited<ReturnType<typeof buildSnapshot>>) {
  const prompt = `أنت محلل SaaS متخصص في التنبؤ المالي.

بيانات منصة "عدالة AI" الحالية:
- مكاتب نشطة: ${snap.platform.activeOffices}
- مستخدمون: ${snap.platform.totalUsers}
- مكاتب جديدة (30 يوم): ${snap.platform.newOffices30d}
- مكاتب معرَّضة للإيقاف: ${snap.platform.atRiskOffices} (خطر churn: ${snap.platform.churnRisk}%)
- إجمالي الإيرادات: ${snap.finance.totalRevenue} ر.س
- MRR المقدَّر: ${snap.finance.mrr} ر.س
- فواتير متأخرة: ${snap.finance.overdueInvoices}
- متوسط إيراد/مكتب: ${snap.finance.avgRevenuePerOffice} ر.س
- قضايا إجمالية: ${snap.platform.totalCases}
- مهام AI / 24h: ${snap.ai.tasks24h}

اكتب تقرير توقعات مختصر وعملي بالعربية، يشمل:
1. **توقع الإيراد خلال 7 أيام** (رقم + مبرر)
2. **توقع الإيراد خلال 30 يوم** (رقم + مبرر)
3. **توقع نمو المكاتب** (هل سيتسارع أو يتباطأ؟)
4. **مستوى خطر الـ Churn** (منخفض/متوسط/عالٍ + سبب)
5. **الفرصة الذهبية** (ما الذي يمكن أن يُضاعف النمو؟)

أجب بشكل موجز وعملي — مديرو المنصة سيتخذون قرارات بناء على توقعاتك.`;

  try {
    return (await callAI("أنت محلل SaaS خبير.", prompt, [], "auto")).reply;
  } catch {
    return `[Forecast] تعذّر الاتصال بالنموذج. المقاييس: MRR=${snap.finance.mrr} ر.س، نمو=${snap.platform.newOffices30d}/شهر، churn=${snap.platform.churnRisk}%.`;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   4. AI CEO DECISION — القرار الاستراتيجي
═══════════════════════════════════════════════════════════════════ */

async function runCeoDecision(
  snap: Awaited<ReturnType<typeof buildSnapshot>>,
  forecast: string,
  actions: OptimizationAction[]
) {
  const topActions = actions.slice(0, 5).map(a => `• [${a.priority.toUpperCase()}] ${a.action} — ${a.reason}`).join("\n");

  const prompt = `أنت الرئيس التنفيذي (CEO) لمنصة SaaS قانونية "عدالة AI".

📊 المقاييس الحالية:
- مكاتب نشطة: ${snap.platform.activeOffices} | مستخدمون: ${snap.platform.totalUsers}
- MRR: ${snap.finance.mrr} ر.س | خطر churn: ${snap.platform.churnRisk}%
- مكاتب جديدة/شهر: ${snap.platform.newOffices30d}
- فواتير متأخرة: ${snap.finance.overdueInvoices}

🔮 التوقعات:
${forecast.substring(0, 600)}

⚙️ الإجراءات المقترحة:
${topActions}

اتخذ قرارًا استراتيجيًا بالعربية يشمل:

**الأولويات الثلاث الأولى** (ما الذي يجب فعله الآن؟)
**ما يجب تجنّبه** (قرارات خاطئة قد تُضر المنصة)
**الاتجاه الاستراتيجي** (أين المنصة بعد 90 يومًا؟)
**مؤشر الصحة العام** (من 10 — وتبرير الرقم)

كن حاسمًا ومباشرًا — أنت تقود شركة وليس تقدم تقريرًا أكاديميًا.`;

  try {
    return (await callAI("أنت CEO خبير في SaaS القانوني.", prompt, [], "auto")).reply;
  } catch {
    return `[CEO] تعذّر الاتصال بالنموذج. أولوية قصوى: معالجة ${snap.platform.atRiskOffices} مكتب في خطر + ${snap.finance.overdueInvoices} فاتورة متأخرة.`;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   LAYER 1 — EVENT SYSTEM  📡
   جدول: os_events (auto-created)
═══════════════════════════════════════════════════════════════════ */

async function ensureOsEventTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS os_events (
      id         BIGSERIAL PRIMARY KEY,
      event      TEXT        NOT NULL,
      data       JSONB       NOT NULL DEFAULT '{}',
      source     TEXT        NOT NULL DEFAULT 'manual',
      office_id  TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS os_action_queue (
      id          BIGSERIAL PRIMARY KEY,
      type        TEXT        NOT NULL,
      payload     JSONB       NOT NULL DEFAULT '{}',
      status      TEXT        NOT NULL DEFAULT 'queued',
      safety_ok   BOOLEAN     NOT NULL DEFAULT TRUE,
      triggered_by TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureOsEventTables().catch(() => {});

/** تسجيل حدث في الـ DB */
async function trackEvent(event: string, data: Record<string, any> = {}, source = "api", officeId?: string) {
  await db.execute(sql`
    INSERT INTO os_events (event, data, source, office_id)
    VALUES (${event}, ${JSON.stringify(data)}::jsonb, ${source}, ${officeId ?? null})
  `);
}

/** احسب مقاييس الأحداث خلال فترة (hours) */
async function calcEventMetrics(hours = 24) {
  const rows = toRows(await db.execute(sql`
    SELECT event, COUNT(*)::int AS cnt,
           COALESCE(SUM((data->>'amount')::float), 0)::float AS total_amount
    FROM os_events
    WHERE created_at > NOW() - (${hours} || ' hours')::interval
    GROUP BY event
    ORDER BY cnt DESC
  `));

  const byEvent: Record<string, { count: number; amount: number }> = {};
  for (const r of rows) {
    byEvent[r.event] = { count: Number(r.cnt), amount: Number(r.total_amount) };
  }

  return {
    signups:  byEvent["signup"]?.count  ?? 0,
    payments: byEvent["payment"]?.count ?? 0,
    revenue:  byEvent["payment"]?.amount ?? 0,
    cancels:  byEvent["cancel"]?.count  ?? 0,
    logins:   byEvent["login"]?.count   ?? 0,
    errors:   byEvent["error"]?.count   ?? 0,
    total:    rows.reduce((s, r) => s + Number(r.cnt), 0),
    growth:   (byEvent["signup"]?.count ?? 0) - (byEvent["cancel"]?.count ?? 0),
    byEvent,
    windowHours: hours,
  };
}

/** آخر N حدث */
async function getRecentEvents(limit = 30) {
  return toRows(await db.execute(sql`
    SELECT id, event, data, source, office_id, created_at
    FROM os_events
    ORDER BY created_at DESC
    LIMIT ${limit}
  `));
}

/* ═══════════════════════════════════════════════════════════════════
   LAYER 3 — ACTION QUEUE  ⚙️
   تنفيذ آمن: تسجيل فقط، لا تعديل في Prod
═══════════════════════════════════════════════════════════════════ */

async function enqueueAction(type: string, payload: Record<string, any>, safetyOk: boolean, triggeredBy = "ai-os") {
  await db.execute(sql`
    INSERT INTO os_action_queue (type, payload, status, safety_ok, triggered_by)
    VALUES (${type}, ${JSON.stringify(payload)}::jsonb, 'queued', ${safetyOk}, ${triggeredBy})
  `);
}

async function getActionQueue(limit = 20) {
  return toRows(await db.execute(sql`
    SELECT id, type, payload, status, safety_ok, triggered_by, created_at
    FROM os_action_queue
    ORDER BY created_at DESC
    LIMIT ${limit}
  `));
}

/* ═══════════════════════════════════════════════════════════════════
   LAYER 4 — SAFETY GUARD  🧪
   يمنع تنفيذ القرارات الخاطئة
═══════════════════════════════════════════════════════════════════ */

interface SafetyResult {
  ok: boolean;
  score: number;       /* 0-100 */
  violations: string[];
  warnings: string[];
}

function runSafetyCheck(snap: Awaited<ReturnType<typeof buildSnapshot>>, eventMetrics?: Awaited<ReturnType<typeof calcEventMetrics>>): SafetyResult {
  const violations: string[] = [];
  const warnings:  string[] = [];
  let score = 100;

  /* Critical violations — يوقف التنفيذ */
  if (snap.finance.totalRevenue < 0) {
    violations.push("إيرادات سالبة — بيانات مشبوهة");
    score -= 40;
  }
  if (snap.system.memPct > 95) {
    violations.push(`الذاكرة بلغت ${snap.system.memPct}% — خطر الانهيار`);
    score -= 30;
  }
  if (snap.system.dbLatencyMs > 2000) {
    violations.push(`DB latency: ${snap.system.dbLatencyMs}ms — اتصال غير مستقر`);
    score -= 25;
  }
  if (eventMetrics && eventMetrics.cancels > eventMetrics.signups * 2 && eventMetrics.signups > 0) {
    violations.push(`Churn متسارع: ${eventMetrics.cancels} إلغاء مقابل ${eventMetrics.signups} تسجيل`);
    score -= 20;
  }

  /* Warnings — يُنبّه لكن لا يوقف */
  if (snap.platform.churnRisk > 30) warnings.push(`خطر churn مرتفع: ${snap.platform.churnRisk}%`);
  if (snap.finance.overdueInvoices > 10) warnings.push(`${snap.finance.overdueInvoices} فاتورة متأخرة`);
  if (snap.system.memPct > 80) warnings.push(`ذاكرة: ${snap.system.memPct}%`);
  if (eventMetrics && eventMetrics.errors > 20) warnings.push(`${eventMetrics.errors} خطأ في آخر 24h`);

  return {
    ok: violations.length === 0,
    score: Math.max(0, score),
    violations,
    warnings,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════════════════ */

/* GET /saas-os/snapshot */
router.get("/saas-os/snapshot", ctGuard, async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    res.json({ ok: true, data: snap });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* GET /saas-os/optimize */
router.get("/saas-os/optimize", ctGuard, async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    const actions = runOptimizer(snap);
    res.json({ ok: true, data: actions, capturedAt: snap.capturedAt });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* POST /saas-os/forecast */
router.post("/saas-os/forecast", ctGuard, async (_req, res) => {
  try {
    const snap = await buildSnapshot();
    const forecast = await runForecast(snap);
    res.json({ ok: true, data: forecast, capturedAt: snap.capturedAt });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* POST /saas-os/ceo-decision */
router.post("/saas-os/ceo-decision", ctGuard, async (req, res) => {
  const { forecast = "", actions = [] } = req.body ?? {};
  try {
    const snap = await buildSnapshot();
    const decision = await runCeoDecision(snap, forecast, actions);
    res.json({ ok: true, data: decision, capturedAt: snap.capturedAt });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* POST /saas-os/track — Event System */
router.post("/saas-os/track", ctGuard, async (req, res) => {
  const { event, data = {}, source = "manual", office_id } = req.body ?? {};
  if (!event || typeof event !== "string") {
    return res.status(400).json({ ok: false, error: "event name required" });
  }
  try {
    await trackEvent(event, data, source, office_id);
    res.json({ ok: true, event, ts: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* GET /saas-os/events — Event stream + metrics */
router.get("/saas-os/events", ctGuard, async (req, res) => {
  const hours = Number(req.query.hours ?? 24);
  try {
    const [metrics, recent] = await Promise.all([
      calcEventMetrics(hours),
      getRecentEvents(40),
    ]);
    res.json({ ok: true, data: { metrics, recent } });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* GET /saas-os/actions — Action queue */
router.get("/saas-os/actions", ctGuard, async (_req, res) => {
  try {
    const actions = await getActionQueue(30);
    res.json({ ok: true, data: actions });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* POST /saas-os/run — Full Orchestrator + Safety */
router.post("/saas-os/run", ctGuard, async (_req, res) => {
  try {
    const [snap, eventMetrics] = await Promise.all([
      buildSnapshot(),
      calcEventMetrics(24),
    ]);

    /* 🧪 Safety Check — قبل أي قرار */
    const safety  = runSafetyCheck(snap, eventMetrics);
    const actions = runOptimizer(snap);

    if (!safety.ok) {
      /* سجّل المحاولة المحجوبة */
      await enqueueAction("blocked_run", {
        violations: safety.violations,
        score: safety.score,
      }, false, "saas-os").catch(() => {});

      return res.json({
        ok: true,
        data: {
          snapshot: snap,
          eventMetrics,
          safety,
          actions,
          forecast:  null,
          decision:  null,
          blocked:   true,
          blockReason: safety.violations.join(" | "),
        },
      });
    }

    /* ✅ Safety passed — run AI layers */
    const forecast = await runForecast(snap);
    const decision = await runCeoDecision(snap, forecast, actions);

    /* ⚙️ Enqueue top-3 proposed actions */
    for (const a of actions.slice(0, 3)) {
      await enqueueAction("ai_proposal", {
        priority: a.priority, category: a.category,
        action: a.action, reason: a.reason,
      }, true, "ceo-ai").catch(() => {});
    }

    /* Persist to system_events */
    await db.execute(sql`
      INSERT INTO system_events (type, payload, severity, source)
      VALUES ('saas_os_run', ${JSON.stringify({
        offices: snap.platform.activeOffices,
        mrr: snap.finance.mrr,
        churnRisk: snap.platform.churnRisk,
        safetyScore: safety.score,
        actionsCount: actions.length,
      })}::jsonb, 'info', 'saas-os')
    `).catch(() => {});

    res.json({
      ok: true,
      data: { snapshot: snap, eventMetrics, safety, actions, forecast, decision, blocked: false },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
