/**
 * AI Provider Engine — محرك مزودي الذكاء الاصطناعي
 * ─────────────────────────────────────────────────
 * يُدير:
 *   • إعدادات المزودين (تفعيل/تعطيل، أولوية، تكلفة)
 *   • إعدادات كل مكتب (المزود المفضل، الوضع، التوجيه الذكي)
 *   • محرك السياسة الذكية (smart routing per task type)
 *   • توزيع الخدمة على العملاء (service distribution)
 *   • إحصائيات التكلفة بالريال السعودي
 */
import { Router, Request, Response } from "express";
import { requireAuth, requireAuthWithTenant, requirePermission, requireSuperAdmin } from "../../middlewares/requireAuth";
import { db }                        from "@workspace/db";
import { sql }                       from "drizzle-orm";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q); return r[0] ?? null;
}

const adminOnly = requireSuperAdmin;

/* ══════════════════════════════════════════════════════════════════
   DB SETUP
══════════════════════════════════════════════════════════════════ */
let tablesReady = false;
async function ensureTables() {
  if (tablesReady) return;
  try {
    /* global provider configuration */
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_provider_config (
        id               SERIAL PRIMARY KEY,
        provider         TEXT NOT NULL UNIQUE,
        label_ar         TEXT NOT NULL DEFAULT '',
        enabled          BOOLEAN NOT NULL DEFAULT TRUE,
        priority         INTEGER NOT NULL DEFAULT 5,
        cost_per_token   NUMERIC(10,6) NOT NULL DEFAULT 0,
        cost_per_request NUMERIC(8,4)  NOT NULL DEFAULT 0,
        monthly_limit    INTEGER,
        current_usage    INTEGER NOT NULL DEFAULT 0,
        model_name       TEXT NOT NULL DEFAULT '',
        notes            TEXT,
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* per-office AI preferences */
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS office_ai_settings (
        id                  SERIAL PRIMARY KEY,
        office_id           TEXT NOT NULL UNIQUE,
        preferred_provider  TEXT NOT NULL DEFAULT 'auto',
        mode                TEXT NOT NULL DEFAULT 'balanced',
        allowed_providers   TEXT[] DEFAULT ARRAY['gemini','claude','openai','deepseek'],
        max_monthly_spend   NUMERIC(8,2),
        smart_routing       BOOLEAN NOT NULL DEFAULT TRUE,
        custom_rules        JSONB   DEFAULT '{}',
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    /* enhance usage_logs with SAR cost column */
    await db.execute(sql`
      ALTER TABLE ai_usage_logs
        ADD COLUMN IF NOT EXISTS cost_sar    NUMERIC(8,6) DEFAULT 0,
        ADD COLUMN IF NOT EXISTS token_count INTEGER      DEFAULT 0,
        ADD COLUMN IF NOT EXISTS policy_used TEXT
    `).catch(() => {});

    /* seed default providers */
    const providers = [
      { provider: "gemini",   label: "Gemini 2.5 Flash",    priority: 1, cost: 0.0001, req_cost: 0.0000, model: "gemini-2.5-flash" },
      { provider: "deepseek", label: "DeepSeek Chat",        priority: 2, cost: 0.0002, req_cost: 0.0000, model: "deepseek-chat" },
      { provider: "openai",   label: "GPT-4o mini",         priority: 3, cost: 0.0010, req_cost: 0.0000, model: "gpt-4o-mini" },
      { provider: "claude",   label: "Claude 3.5 Haiku",    priority: 4, cost: 0.0008, req_cost: 0.0000, model: "claude-3-5-haiku-20241022" },
      { provider: "ollama",   label: "Ollama (محلي)",        priority: 5, cost: 0.0000, req_cost: 0.0000, model: "gemma3:4b" },
    ];
    for (const p of providers) {
      await db.execute(sql`
        INSERT INTO ai_provider_config (provider, label_ar, priority, cost_per_token, cost_per_request, model_name)
        VALUES (${p.provider}, ${p.label}, ${p.priority}, ${p.cost}, ${p.req_cost}, ${p.model})
        ON CONFLICT (provider) DO NOTHING
      `);
    }
    tablesReady = true;
  } catch { /* non-blocking */ }
}
ensureTables();

/* ══════════════════════════════════════════════════════════════════
   SMART ROUTING POLICY ENGINE
══════════════════════════════════════════════════════════════════ */
export interface RoutingContext {
  taskType?:      string;
  mode?:          "fast" | "balanced" | "accurate";
  officeSettings?: any;
  availableKeys:  Record<string, boolean>;
}

/**
 * Legal task → best provider mapping
 */
const LEGAL_TASK_ROUTING: Record<string, string[]> = {
  contract_draft:    ["claude", "openai", "gemini"],
  contract_review:   ["claude", "openai", "gemini"],
  document_draft:    ["claude", "openai", "gemini"],
  case_analysis:     ["openai", "claude", "gemini"],
  legal_research:    ["openai", "gemini", "claude"],
  opponent_sim:      ["openai", "claude", "gemini"],
  legal_assistant:   ["gemini", "openai", "claude"],
  summary:           ["gemini", "deepseek", "openai"],
  custom:            ["gemini", "openai", "claude"],
};

/**
 * Mode → tier mapping
 */
const MODE_PROVIDERS: Record<string, string[]> = {
  fast:      ["gemini", "deepseek", "openai", "claude"],
  balanced:  ["gemini", "openai", "claude", "deepseek"],
  accurate:  ["claude", "openai", "gemini", "deepseek"],
};

export function selectProvider(ctx: RoutingContext): string {
  const preferred = ctx.officeSettings?.preferred_provider;
  const mode      = ctx.mode ?? ctx.officeSettings?.mode ?? "balanced";
  const taskType  = ctx.taskType ?? "custom";
  const smartOn   = ctx.officeSettings?.smart_routing !== false;
  const allowed: string[] = ctx.officeSettings?.allowed_providers ?? ["gemini","claude","openai","deepseek"];

  /* 1. Explicit non-auto preferred provider */
  if (preferred && preferred !== "auto" && ctx.availableKeys[preferred] && allowed.includes(preferred)) {
    return preferred;
  }

  /* 2. Smart legal routing (if enabled) */
  if (smartOn) {
    const taskRoutes = LEGAL_TASK_ROUTING[taskType] ?? LEGAL_TASK_ROUTING.custom;
    for (const p of taskRoutes) {
      if (ctx.availableKeys[p] && allowed.includes(p)) return p;
    }
  }

  /* 3. Mode-based routing */
  const modeRoutes = MODE_PROVIDERS[mode] ?? MODE_PROVIDERS.balanced;
  for (const p of modeRoutes) {
    if (ctx.availableKeys[p] && allowed.includes(p)) return p;
  }

  /* 4. Any available */
  for (const p of ["gemini", "deepseek", "openai", "claude"]) {
    if (ctx.availableKeys[p]) return p;
  }

  return "fallback";
}

/* ══════════════════════════════════════════════════════════════════
   OFFICE SETTINGS HELPERS (exported for use in aiGateway)
══════════════════════════════════════════════════════════════════ */
const settingsCache = new Map<string, { data: any; ts: number }>();
const SETTINGS_TTL  = 5 * 60 * 1000; // 5 min

export async function getOfficeAISettings(officeId: string): Promise<any> {
  const now    = Date.now();
  const cached = settingsCache.get(officeId);
  if (cached && now - cached.ts < SETTINGS_TTL) return cached.data;

  try {
    const row = await one(sql`SELECT * FROM office_ai_settings WHERE office_id = ${officeId} LIMIT 1`);
    const data = row ?? { preferred_provider: "auto", mode: "balanced", smart_routing: true, allowed_providers: ["gemini","claude","openai","deepseek"] };
    settingsCache.set(officeId, { data, ts: now });
    return data;
  } catch { return { preferred_provider: "auto", mode: "balanced", smart_routing: true }; }
}

export function invalidateOfficeSettingsCache(officeId: string) {
  settingsCache.delete(officeId);
}

/* ══════════════════════════════════════════════════════════════════
   ROUTES — ADMIN
══════════════════════════════════════════════════════════════════ */

/* GET /api/ai/gateway/providers — list all provider configs */
router.get("/ai/gateway/providers", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const data = await rows(sql`SELECT * FROM ai_provider_config ORDER BY priority ASC`);
    res.json({ providers: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PUT /api/ai/gateway/providers/:provider — update provider config */
router.put("/ai/gateway/providers/:provider", adminOnly, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const { provider } = req.params as Record<string, string>;
    const { enabled, priority, cost_per_token, cost_per_request, monthly_limit, notes, model_name } = req.body;

    await db.execute(sql`
      UPDATE ai_provider_config
      SET enabled          = COALESCE(${enabled          ?? null}, enabled),
          priority         = COALESCE(${priority         ?? null}, priority),
          cost_per_token   = COALESCE(${cost_per_token   ?? null}, cost_per_token),
          cost_per_request = COALESCE(${cost_per_request ?? null}, cost_per_request),
          monthly_limit    = COALESCE(${monthly_limit    ?? null}, monthly_limit),
          notes            = COALESCE(${notes            ?? null}, notes),
          model_name       = COALESCE(${model_name       ?? null}, model_name),
          updated_at       = NOW()
      WHERE provider = ${provider}
    `);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /api/ai/gateway/service-distribution — per-office AI usage breakdown */
router.get("/ai/gateway/service-distribution", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const dist = await rows(sql`
      SELECT
        u.office_id,
        COUNT(*)                                          AS total_requests,
        COALESCE(SUM(u.cost_points), 0)                  AS total_points,
        COALESCE(SUM(u.cost_sar), 0)                     AS total_sar,
        COUNT(*) FILTER (WHERE u.model_used = 'gemini')  AS gemini_count,
        COUNT(*) FILTER (WHERE u.model_used = 'claude')  AS claude_count,
        COUNT(*) FILTER (WHERE u.model_used = 'openai')  AS openai_count,
        COUNT(*) FILTER (WHERE u.model_used = 'deepseek') AS deepseek_count,
        COUNT(*) FILTER (WHERE u.cached = true)          AS cache_hits,
        COALESCE(AVG(u.response_ms), 0)::int             AS avg_latency,
        MAX(u.created_at)                                AS last_used,
        s.preferred_provider,
        s.mode,
        c.balance                                        AS credit_balance
      FROM ai_usage_logs u
      LEFT JOIN office_ai_settings s ON s.office_id = u.office_id
      LEFT JOIN office_ai_credits  c ON c.office_id = u.office_id
      WHERE u.created_at > NOW() - INTERVAL '30 days'
      GROUP BY u.office_id, s.preferred_provider, s.mode, c.balance
      ORDER BY total_requests DESC
      LIMIT 50
    `);
    res.json({ distribution: dist });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /api/ai/gateway/office-settings/all — admin view of all office settings */
router.get("/ai/gateway/office-settings/all", adminOnly, async (_req, res) => {
  await ensureTables();
  try {
    const data = await rows(sql`
      SELECT s.*, c.balance AS credit_balance, c.monthly_allowance
      FROM office_ai_settings s
      LEFT JOIN office_ai_credits c ON c.office_id = s.office_id
      ORDER BY s.updated_at DESC
    `);
    res.json({ settings: data });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* POST /api/ai/gateway/office-settings/:officeId — admin override office settings */
router.post("/ai/gateway/office-settings/:officeId", adminOnly, async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const officeId = String(req.params.officeId ?? "");
    const { preferred_provider, mode, allowed_providers, max_monthly_spend, smart_routing } = req.body;
    await db.execute(sql`
      INSERT INTO office_ai_settings (office_id, preferred_provider, mode, allowed_providers, max_monthly_spend, smart_routing)
      VALUES (
        ${officeId},
        ${preferred_provider ?? "auto"},
        ${mode               ?? "balanced"},
        ${allowed_providers  ?? ["gemini","claude","openai","deepseek"]}::text[],
        ${max_monthly_spend  ?? null},
        ${smart_routing      ?? true}
      )
      ON CONFLICT (office_id) DO UPDATE SET
        preferred_provider = EXCLUDED.preferred_provider,
        mode               = EXCLUDED.mode,
        allowed_providers  = EXCLUDED.allowed_providers,
        max_monthly_spend  = EXCLUDED.max_monthly_spend,
        smart_routing      = EXCLUDED.smart_routing,
        updated_at         = NOW()
    `);
    invalidateOfficeSettingsCache(officeId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /api/ai/gateway/routing-rules — smart routing matrix */
router.get("/ai/gateway/routing-rules", adminOnly, async (_req, res) => {
  res.json({ rules: LEGAL_TASK_ROUTING, modeProviders: MODE_PROVIDERS });
});

/* GET /api/ai/gateway/cost-analytics — cost vs usage analytics */
router.get("/ai/gateway/cost-analytics", adminOnly, async (_req, res) => {
  try {
    const [daily, totals, byModel] = await Promise.all([
      rows(sql`
        SELECT DATE(created_at) AS day,
               COUNT(*)          AS requests,
               COALESCE(SUM(cost_points), 0) AS points,
               COALESCE(SUM(cost_sar), 0)    AS sar_cost
        FROM ai_usage_logs
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at) ORDER BY day ASC
      `),
      one(sql`
        SELECT COUNT(*)                                          AS total_requests,
               COALESCE(SUM(cost_points), 0)                    AS total_points,
               COALESCE(SUM(cost_sar), 0)                       AS total_sar,
               COUNT(*) FILTER (WHERE cached = true)            AS cache_hits,
               COALESCE(AVG(response_ms), 0)::int               AS avg_latency,
               COUNT(DISTINCT office_id)                        AS active_offices
        FROM ai_usage_logs
        WHERE created_at > NOW() - INTERVAL '30 days'
      `),
      rows(sql`
        SELECT model_used, COUNT(*) AS cnt, COALESCE(SUM(cost_points), 0) AS pts
        FROM ai_usage_logs
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY model_used ORDER BY cnt DESC
      `),
    ]);
    res.json({ daily, totals, byModel });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* ══════════════════════════════════════════════════════════════════
   ROUTES — PER-OFFICE (authenticated)
══════════════════════════════════════════════════════════════════ */

/* GET /api/ai/gateway/my-settings */
router.get("/ai/gateway/my-settings", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId || officeId === "platform") return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const s = await one(sql`SELECT * FROM office_ai_settings WHERE office_id = ${officeId} LIMIT 1`);
    const defaults = { preferred_provider: "auto", mode: "balanced", smart_routing: true, allowed_providers: ["gemini","claude","openai","deepseek"] };
    res.json({ settings: s ?? defaults });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* PUT /api/ai/gateway/my-settings */
router.put("/ai/gateway/my-settings", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  await ensureTables();
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId || officeId === "platform") return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { preferred_provider, mode, smart_routing } = req.body;
    await db.execute(sql`
      INSERT INTO office_ai_settings (office_id, preferred_provider, mode, smart_routing)
      VALUES (${officeId}, ${preferred_provider ?? "auto"}, ${mode ?? "balanced"}, ${smart_routing ?? true})
      ON CONFLICT (office_id) DO UPDATE SET
        preferred_provider = EXCLUDED.preferred_provider,
        mode               = EXCLUDED.mode,
        smart_routing      = EXCLUDED.smart_routing,
        updated_at         = NOW()
    `);
    invalidateOfficeSettingsCache(officeId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

/* GET /api/ai/gateway/my-usage — usage history for office */
router.get("/ai/gateway/my-usage", requireAuthWithTenant, requirePermission("ai:access"), async (req: Request, res: Response) => {
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId || officeId === "platform") return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const limit    = Math.min(Number((req.query as any).limit) || 50, 200);
    const [logs, stats] = await Promise.all([
      rows(sql`
        SELECT id, query_type, model_used, tier, cost_points, cost_sar, token_count,
               cached, response_ms, prompt_length, policy_used, created_at
        FROM ai_usage_logs
        WHERE office_id = ${officeId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `),
      one(sql`
        SELECT COUNT(*)                                         AS total,
               COALESCE(SUM(cost_points), 0)                   AS total_points,
               COALESCE(SUM(cost_sar), 0)                      AS total_sar,
               COALESCE(AVG(response_ms), 0)::int              AS avg_latency,
               COUNT(*) FILTER (WHERE cached = true)           AS cache_hits,
               COUNT(*) FILTER (WHERE model_used = 'gemini')   AS gemini_count,
               COUNT(*) FILTER (WHERE model_used = 'claude')   AS claude_count,
               COUNT(*) FILTER (WHERE model_used = 'openai')   AS openai_count
        FROM ai_usage_logs
        WHERE office_id = ${officeId}
          AND created_at > NOW() - INTERVAL '30 days'
      `),
    ]);
    res.json({ logs, stats });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
