/**
 * Managed Integrations Hub — مركز التكاملات المُدار
 * ────────────────────────────────────────────────
 * المبدأ: المطور/مالك المنصة يملك جميع المفاتيح مركزياً.
 * العملاء يرون الحالة ويطلبون التفعيل عبر الدعم الفني.
 * لا عميل يلمس API key مباشرة أبداً.
 *
 * الجداول:
 *   platform_integrations    — كتالوج التكاملات + المفاتيح (مشفّر)
 *   office_integration_status — حالة كل تكامل لكل مكتب
 *   integration_requests      — طلبات التفعيل/التعديل من العملاء
 */
import { Router, Request, Response } from "express";
import { requireAuthWithTenant, requireSuperAdmin } from "../../middlewares/requireAuth";
import { getRequiredTenantId, TenantRequiredError, tenantRequiredResponse } from "../../core/tenantContext";
import { db }                        from "@workspace/db";
import { sql }                       from "drizzle-orm";
import { getAuth }                   from "@clerk/express";

const router = Router();
const adminOnly = requireSuperAdmin;

/* ── helpers ─────────────────────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); }
  catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q); return r[0] ?? null;
}

/* ══════════════════════════════════════════════════════════════
   CATALOG — التكاملات المتاحة في المنصة
══════════════════════════════════════════════════════════════ */
const INTEGRATION_CATALOG = [
  {
    key: "ai",
    name_ar: "الذكاء الاصطناعي",
    name_en: "AI Engine",
    category: "intelligence",
    icon: "🤖",
    color: "#8B5CF6",
    description: "تحليل القضايا، صياغة العقود، المساعد القانوني — مدعوم بـ Gemini و Claude و GPT",
    plan_required: "free",
    docs_url: "#",
    features: ["تحليل قانوني ذكي","صياغة وثائق","محادثة قانونية","توجيه ذكي متعدد النماذج"],
  },
  {
    key: "telegram",
    name_ar: "تيليجرام",
    name_en: "Telegram Bot",
    category: "communication",
    icon: "✈️",
    color: "#0088cc",
    description: "إشعارات فورية عبر Telegram — جلسات، فواتير، قضايا، تنبيهات",
    plan_required: "pro",
    docs_url: "#",
    features: ["إشعارات الجلسات","تنبيهات الفواتير","تحديثات القضايا","تخزين الملفات"],
  },
  {
    key: "whatsapp",
    name_ar: "واتساب أعمال",
    name_en: "WhatsApp Business",
    category: "communication",
    icon: "💬",
    color: "#25D366",
    description: "تواصل مع العملاء عبر WhatsApp Business API — رسائل تلقائية وتأكيدات",
    plan_required: "enterprise",
    docs_url: "#",
    features: ["رسائل تلقائية للعملاء","تأكيد المواعيد","إشعارات الفواتير","ردود ذكية"],
  },
  {
    key: "email",
    name_ar: "البريد الإلكتروني",
    name_en: "Email SMTP",
    category: "communication",
    icon: "📧",
    color: "#EF4444",
    description: "إرسال بريد إلكتروني مخصص بدومين المكتب عبر SMTP أو SendGrid",
    plan_required: "basic",
    docs_url: "#",
    features: ["بريد بدومين المكتب","قوالب مخصصة","إشعارات تلقائية","تقارير الإرسال"],
  },
  {
    key: "stripe",
    name_ar: "بوابة Stripe",
    name_en: "Stripe Payments",
    category: "payments",
    icon: "💳",
    color: "#635BFF",
    description: "استقبال مدفوعات البطاقات الائتمانية والدفع الإلكتروني عبر Stripe Connect",
    plan_required: "pro",
    docs_url: "#",
    features: ["بطاقات ائتمانية","Apple Pay / Google Pay","اشتراكات تلقائية","تقارير مالية"],
  },
  {
    key: "moyasar",
    name_ar: "بوابة Moyasar",
    name_en: "Moyasar Payments",
    category: "payments",
    icon: "🏦",
    color: "#1A56DB",
    description: "بوابة دفع سعودية — مدى، STCPay، بطاقات محلية ودولية",
    plan_required: "pro",
    docs_url: "#",
    features: ["بطاقة مدى","STCPay","Apple Pay","تحويل بنكي"],
  },
  {
    key: "sms",
    name_ar: "الرسائل القصيرة SMS",
    name_en: "SMS Gateway",
    category: "communication",
    icon: "📱",
    color: "#F59E0B",
    description: "إرسال رسائل SMS للعملاء — تذكيرات الجلسات وتأكيدات الحجوزات",
    plan_required: "basic",
    docs_url: "#",
    features: ["تذكيرات الجلسات","تأكيد الحجوزات","رمز التحقق OTP","تنبيهات المدفوعات"],
  },
  {
    key: "gdrive",
    name_ar: "Google Drive",
    name_en: "Google Drive",
    category: "storage",
    icon: "📂",
    color: "#4285F4",
    description: "نسخ احتياطي تلقائي للمستندات والعقود إلى Google Drive",
    plan_required: "pro",
    docs_url: "#",
    features: ["نسخ احتياطي تلقائي","مشاركة الملفات","تنظيم المستندات","مزامنة لحظية"],
  },
  {
    key: "webhook",
    name_ar: "Webhook / Zapier",
    name_en: "Webhooks",
    category: "automation",
    icon: "⚡",
    color: "#FF4A00",
    description: "ربط المنصة بأي نظام خارجي عبر Webhooks — Zapier، Make، Power Automate",
    plan_required: "enterprise",
    docs_url: "#",
    features: ["إرسال أحداث لحظية","Zapier / Make","ربط ERP خارجي","أتمتة متقدمة"],
  },
  {
    key: "esign",
    name_ar: "التوقيع الإلكتروني",
    name_en: "eSign",
    category: "legal",
    icon: "✍️",
    color: "#10B981",
    description: "توقيع العقود والوثائق إلكترونياً بموثوقية قانونية — مدعوم داخلياً",
    plan_required: "pro",
    docs_url: "#",
    features: ["توقيع رقمي موثّق","رابط مشاركة آمن","سجل توقيعات","متوافق مع الأنظمة"],
  },
  {
    key: "push",
    name_ar: "إشعارات التطبيق",
    name_en: "Push Notifications",
    category: "communication",
    icon: "🔔",
    color: "#EC4899",
    description: "إشعارات فورية على متصفح العميل — لا يحتاج تطبيقاً",
    plan_required: "basic",
    docs_url: "#",
    features: ["إشعارات المتصفح","تنبيهات فورية","إشعارات القضايا","تذكيرات المهام"],
  },
  {
    key: "nafath",
    name_ar: "نفاذ (Nafath)",
    name_en: "Nafath Identity",
    category: "identity",
    icon: "🪪",
    color: "#1A56DB",
    description: "التحقق من هوية العملاء السعوديين عبر بوابة نفاذ الحكومية",
    plan_required: "enterprise",
    docs_url: "#",
    features: ["تحقق هوية وطنية","توقيع رقمي معتمد","KYC قانوني","امتثال نظامي"],
  },
];

const PLAN_ORDER = ["free","basic","starter","pro","growth","advanced","enterprise","elite"];
function planIndex(slug: string) { return PLAN_ORDER.indexOf(slug.toLowerCase()); }

/* ══════════════════════════════════════════════════════════════
   DB SETUP
══════════════════════════════════════════════════════════════ */
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS platform_integrations (
        key          TEXT PRIMARY KEY,
        name_ar      TEXT NOT NULL,
        name_en      TEXT NOT NULL,
        category     TEXT NOT NULL DEFAULT 'other',
        icon         TEXT NOT NULL DEFAULT '🔌',
        color        TEXT NOT NULL DEFAULT '#6B7280',
        description  TEXT NOT NULL DEFAULT '',
        plan_required TEXT NOT NULL DEFAULT 'free',
        docs_url     TEXT,
        features     JSONB DEFAULT '[]',
        global_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        config       JSONB DEFAULT '{}',
        notes        TEXT,
        updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS office_integration_status (
        id             SERIAL PRIMARY KEY,
        office_id      TEXT NOT NULL,
        integration_key TEXT NOT NULL,
        is_active      BOOLEAN NOT NULL DEFAULT FALSE,
        activated_at   TIMESTAMPTZ,
        deactivated_at TIMESTAMPTZ,
        config         JSONB DEFAULT '{}',
        notes          TEXT,
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(office_id, integration_key)
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ois_office ON office_integration_status(office_id)
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS integration_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        office_id       TEXT NOT NULL,
        office_name     TEXT,
        integration_key TEXT NOT NULL,
        request_type    TEXT NOT NULL DEFAULT 'activate',
        message         TEXT,
        status          TEXT NOT NULL DEFAULT 'pending',
        admin_notes     TEXT,
        resolved_by     TEXT,
        resolved_at     TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ir_status ON integration_requests(status, created_at DESC)
    `);

    /* Seed catalog from hardcoded list */
    for (const itg of INTEGRATION_CATALOG) {
      await db.execute(sql`
        INSERT INTO platform_integrations
          (key, name_ar, name_en, category, icon, color, description, plan_required, features)
        VALUES
          (${itg.key}, ${itg.name_ar}, ${itg.name_en}, ${itg.category},
           ${itg.icon}, ${itg.color}, ${itg.description}, ${itg.plan_required},
           ${JSON.stringify(itg.features)}::jsonb)
        ON CONFLICT (key) DO NOTHING
      `);
    }
    tablesReady = true;
  } catch { /* non-blocking */ }
}
ensureTables();

/* ══════════════════════════════════════════════════════════════
   OFFICE — USER-FACING ROUTES
══════════════════════════════════════════════════════════════ */

function handleTenantError(err: unknown, res: Response) {
  if (err instanceof TenantRequiredError) {
    return res.status(403).json(tenantRequiredResponse());
  }
  throw err;
}

/** GET /api/integrations — list all integrations + this office's status */
router.get("/integrations", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const officeId = getRequiredTenantId(req);
    const officePlan = await one(sql`
      SELECT plan FROM office_page WHERE office_id = ${officeId}
      UNION ALL
      SELECT p.slug AS plan FROM office_members om
        JOIN office_page op ON op.office_id = om.office_id
        JOIN plans p ON p.id = op.plan_id
      WHERE om.user_id = ${officeId} LIMIT 1
    `) as any;
    const planSlug  = officePlan?.plan ?? "free";
    const planIdx   = planIndex(planSlug);

    /* All integrations */
    const integrations = await rows(sql`SELECT * FROM platform_integrations ORDER BY global_enabled DESC, plan_required ASC`);
    /* Office statuses */
    const statuses     = await rows(sql`SELECT * FROM office_integration_status WHERE office_id = ${officeId}`);
    const statusMap    = Object.fromEntries(statuses.map((s: any) => [s.integration_key, s]));
    /* Pending requests */
    const pending      = await rows(sql`
      SELECT integration_key, status FROM integration_requests
      WHERE office_id = ${officeId} AND status IN ('pending','in_progress')
    `);
    const pendingMap = Object.fromEntries(pending.map((p: any) => [p.integration_key, p.status]));

    const result = integrations.map((itg: any) => {
      const st        = statusMap[itg.key];
      const planOk    = planIdx >= planIndex(itg.plan_required ?? "free");
      const isActive  = !!(st?.is_active);
      const isPending = !!pendingMap[itg.key];

      let uiStatus: "active" | "inactive" | "locked" | "pending" | "disabled";
      if (!itg.global_enabled)   uiStatus = "disabled";
      else if (!planOk)          uiStatus = "locked";
      else if (isActive)         uiStatus = "active";
      else if (isPending)        uiStatus = "pending";
      else                       uiStatus = "inactive";

      return {
        key:          itg.key,
        name_ar:      itg.name_ar,
        name_en:      itg.name_en,
        category:     itg.category,
        icon:         itg.icon,
        color:        itg.color,
        description:  itg.description,
        plan_required: itg.plan_required,
        features:     itg.features ?? [],
        docs_url:     itg.docs_url,
        ui_status:    uiStatus,
        plan_ok:      planOk,
        activated_at: st?.activated_at ?? null,
        notes:        st?.notes ?? null,
        pending_request: pendingMap[itg.key] ?? null,
      };
    });

    res.json({ integrations: result, office_plan: planSlug });
  } catch (err: unknown) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/integrations/request — submit activation/help request */
router.post("/integrations/request", requireAuthWithTenant, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const officeId = getRequiredTenantId(req);
    const { integration_key, request_type = "activate", message } = req.body;
    if (!integration_key) return res.status(422).json({ error: "integration_key مطلوب" });

    /* Get office name */
    const office = await one(sql`SELECT name FROM offices WHERE id = ${officeId} LIMIT 1`).catch(() => null);

    /* Check for existing pending request */
    const existing = await one(sql`
      SELECT id FROM integration_requests
      WHERE office_id = ${officeId} AND integration_key = ${integration_key}
        AND status IN ('pending','in_progress')
      LIMIT 1
    `);
    if (existing) return res.status(409).json({ error: "يوجد طلب معلق بالفعل لهذا التكامل" });

    await db.execute(sql`
      INSERT INTO integration_requests (office_id, office_name, integration_key, request_type, message)
      VALUES (${officeId}, ${office?.name ?? officeId}, ${integration_key}, ${request_type}, ${message ?? null})
    `);
    res.json({ success: true, message: "تم إرسال طلبك — سيتواصل معك فريق الدعم خلال 24 ساعة" });
  } catch (err: unknown) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/** GET /api/integrations/my-requests — my pending/resolved requests */
router.get("/integrations/my-requests", requireAuthWithTenant, async (req: Request, res: Response) => {
  try {
    const officeId = getRequiredTenantId(req);
    const data = await rows(sql`
      SELECT ir.*, pi.name_ar, pi.icon, pi.color
      FROM integration_requests ir
      LEFT JOIN platform_integrations pi ON pi.key = ir.integration_key
      WHERE ir.office_id = ${officeId}
      ORDER BY ir.created_at DESC
      LIMIT 50
    `);
    res.json({ requests: data });
  } catch (err: unknown) {
    if (handleTenantError(err, res)) return;
    res.status(500).json({ error: (err as Error).message });
  }
});

/* ══════════════════════════════════════════════════════════════
   ADMIN ROUTES
══════════════════════════════════════════════════════════════ */

/** GET /api/admin/integrations — full catalog with global config */
router.get("/admin/integrations", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const data = await rows(sql`
      SELECT pi.*,
        COUNT(DISTINCT ois.office_id) FILTER (WHERE ois.is_active = true) AS active_offices,
        COUNT(DISTINCT ir.id)         FILTER (WHERE ir.status = 'pending') AS pending_requests
      FROM platform_integrations pi
      LEFT JOIN office_integration_status ois ON ois.integration_key = pi.key
      LEFT JOIN integration_requests ir ON ir.integration_key = pi.key
      GROUP BY pi.key
      ORDER BY pi.plan_required ASC, pi.name_ar ASC
    `);
    res.json({ integrations: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** PUT /api/admin/integrations/:key — update integration (keys, toggle, notes) */
router.put("/admin/integrations/:key", adminOnly, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const key = String(req.params.key ?? "");
    const { global_enabled, config, notes, plan_required } = req.body;
    await db.execute(sql`
      UPDATE platform_integrations SET
        global_enabled = COALESCE(${global_enabled ?? null}, global_enabled),
        config         = COALESCE(${config ? JSON.stringify(config) : null}::jsonb, config),
        notes          = COALESCE(${notes         ?? null}, notes),
        plan_required  = COALESCE(${plan_required ?? null}, plan_required),
        updated_at     = NOW()
      WHERE key = ${key}
    `);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** GET /api/admin/integrations/office-matrix — per-office status matrix */
router.get("/admin/integrations/office-matrix", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const statuses = await rows(sql`
      SELECT ois.*, pi.name_ar, pi.icon, pi.color, pi.category
      FROM office_integration_status ois
      JOIN platform_integrations pi ON pi.key = ois.integration_key
      ORDER BY ois.office_id, pi.name_ar
    `);
    /* Group by office */
    const byOffice: Record<string, any[]> = {};
    for (const s of statuses) {
      if (!byOffice[s.office_id]) byOffice[s.office_id] = [];
      byOffice[s.office_id].push(s);
    }
    res.json({ matrix: byOffice });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** POST /api/admin/integrations/:key/offices/:officeId — activate/deactivate for office */
router.post("/admin/integrations/:key/offices/:officeId", adminOnly, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const key      = String(req.params.key      ?? "");
    const officeId = String(req.params.officeId ?? "");
    const { is_active, notes, config } = req.body;

    await db.execute(sql`
      INSERT INTO office_integration_status (office_id, integration_key, is_active, activated_at, notes, config)
      VALUES (
        ${officeId}, ${key}, ${!!is_active},
        ${is_active ? sql`NOW()` : sql`NULL`},
        ${notes  ?? null},
        ${config ? JSON.stringify(config) : "{}"}::jsonb
      )
      ON CONFLICT (office_id, integration_key) DO UPDATE SET
        is_active      = EXCLUDED.is_active,
        activated_at   = CASE WHEN EXCLUDED.is_active = true THEN NOW() ELSE office_integration_status.activated_at END,
        deactivated_at = CASE WHEN EXCLUDED.is_active = false THEN NOW() ELSE NULL END,
        notes          = COALESCE(EXCLUDED.notes, office_integration_status.notes),
        config         = COALESCE(EXCLUDED.config, office_integration_status.config),
        updated_at     = NOW()
    `);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** GET /api/admin/integration-requests — all requests with filters */
router.get("/admin/integration-requests", adminOnly, async (req: Request, res: Response) => {
  try {
    const status = (req.query as any).status ?? "pending";
    const filter = status === "all" ? sql`` : sql`WHERE ir.status = ${status}`;
    const data = await rows(sql`
      SELECT ir.*, pi.name_ar, pi.icon, pi.color, pi.plan_required
      FROM integration_requests ir
      LEFT JOIN platform_integrations pi ON pi.key = ir.integration_key
      ${filter}
      ORDER BY ir.created_at DESC
      LIMIT 100
    `);
    const counts = await one(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved')    AS resolved,
        COUNT(*)                                       AS total
      FROM integration_requests
    `);
    res.json({ requests: data, counts });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** PUT /api/admin/integration-requests/:id — respond/resolve a request */
router.put("/admin/integration-requests/:id", adminOnly, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const id = String(req.params.id ?? "");
    const { status, admin_notes, activate_office } = req.body;

    await db.execute(sql`
      UPDATE integration_requests SET
        status      = ${status       ?? "resolved"},
        admin_notes = ${admin_notes  ?? null},
        resolved_at = NOW()
      WHERE id = ${id}::uuid
    `);

    /* If admin approves, auto-activate for the office */
    if (activate_office) {
      const request = await one(sql`SELECT * FROM integration_requests WHERE id = ${id}::uuid LIMIT 1`);
      if (request) {
        await db.execute(sql`
          INSERT INTO office_integration_status (office_id, integration_key, is_active, activated_at)
          VALUES (${request.office_id}, ${request.integration_key}, TRUE, NOW())
          ON CONFLICT (office_id, integration_key) DO UPDATE SET
            is_active = TRUE, activated_at = NOW(), updated_at = NOW()
        `);
      }
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/** GET /api/admin/integration-requests/counts — quick badge count */
router.get("/admin/integration-requests/counts", adminOnly, async (_req, res) => {
  try {
    const counts = await one(sql`
      SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending FROM integration_requests
    `);
    res.json({ pending: Number(counts?.pending ?? 0) });
  } catch { res.json({ pending: 0 }); }
});

export default router;
