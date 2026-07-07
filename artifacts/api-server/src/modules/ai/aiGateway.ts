/**
 * AI Gateway — Unified Entry Point
 * ─────────────────────────────────────────────────────────────────
 * POST /api/ai/query  — single endpoint for ALL AI operations.
 *
 * Architectural rule (spec):
 *   AI must NOT be called directly from UI modules.
 *   All AI calls pass through this gateway, which handles:
 *     • Routing to the correct agent/service
 *     • 10-minute response caching
 *     • Credit deduction
 *     • Audit logging via EventBus
 *
 * Query types:
 *   legal_assistant    — general legal Q&A (عدل)
 *   document_draft     — draft a legal document
 *   case_analysis      — analyse case data
 *   opponent_sim       — simulate opponent arguments
 *   legal_research     — research a legal topic
 *   contract_review    — review contract clauses
 *   custom             — freeform prompt
 */

import { Router }            from "express";
import { requireAuthWithTenant, requirePermission, requireSuperAdmin } from "../../middlewares/requireAuth";
import {
  getRequiredTenantId,
  tenantRequiredResponse,
  TenantRequiredError,
} from "../../core/tenantContext";
import { callAI, classifyPrompt, logAIUsage } from "./aiChat";
import { cache }             from "../../core/cache";
import { eventBus }          from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import { db }                from "@workspace/db";
import { sql }               from "drizzle-orm";
import crypto                from "crypto";

const router = Router();

/** Tenant-scoped analytics; super-admins may query globally */
function resolveAnalyticsScope(req: unknown): { officeId: string | null; global: boolean } {
  if ((req as { isSuperAdmin?: boolean }).isSuperAdmin) {
    return { officeId: null, global: true };
  }
  return { officeId: getRequiredTenantId(req), global: false };
}

/* ── Prompt templates per query type ───────────────────────────── */
const SYSTEM_PROMPTS: Record<string, string> = {
  legal_assistant: `أنت مساعد قانوني متخصص في القانون السعودي والإماراتي. 
أجب بدقة وأشر إلى المواد القانونية ذات الصلة. اكتب بالعربية الفصحى.`,

  document_draft: `أنت محرر قانوني متخصص في صياغة الوثائق القانونية السعودية. 
اصغ الوثيقة المطلوبة بشكل رسمي واحترافي مع مراعاة الأنظمة السعودية النافذة.`,

  case_analysis: `أنت محلل قانوني خبير. حلل الحالة القانونية المعطاة وقدم:
١- تقييم نقاط القوة والضعف
٢- المخاطر القانونية المحتملة
٣- الاستراتيجية المقترحة
٤- احتمالية النجاح (%)`,

  opponent_sim: `أنت تمثل دور محامي الخصم. اعرض أقوى الحجج المضادة للموقف المقدم، 
مستنداً للأنظمة واللوائح السعودية. كن دقيقاً ومقنعاً.`,

  legal_research: `أنت باحث قانوني متخصص. ابحث في الموضوع المطلوب وقدم:
١- النصوص النظامية ذات الصلة
٢- أحكام قضائية سابقة (إن وجدت)
٣- الفقه القانوني
٤- توصياتك`,

  contract_review: `أنت مراجع عقود قانوني خبير. راجع النص المقدم وحدد:
١- البنود الإشكالية أو الغامضة
٢- الثغرات القانونية
٣- المخاطر التعاقدية
٤- المقترحات التحسينية`,

  custom: `أنت مساعد قانوني ذكي متخصص في القانون السعودي.`,
};

/* ── Cache key — tenant + user + type + model + input (no shared namespace) ── */
export interface AiCacheKeyInput {
  officeId: string;
  userId:   string;
  type:     string;
  model:    string;
  input:    string;
  context?: string;
}

export function buildCacheKey(opts: AiCacheKeyInput): string {
  const raw = `${opts.officeId}|${opts.userId}|${opts.type}|${opts.model}|${opts.input}|${opts.context ?? ""}`;
  return `ai:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/ai/query
───────────────────────────────────────────────────────────────── */
router.post("/ai/query", requireAuthWithTenant, requirePermission("ai:access"), async (req, res) => {
  const {
    type    = "legal_assistant",
    input,
    context,
    model   = "auto",
    noCache = false,
  } = req.body as {
    type?:    string;
    input:    string;
    context?: string;
    model?:   string;
    noCache?: boolean;
  };

  if (!input || typeof input !== "string" || input.trim().length === 0) {
    res.status(422).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "حقل input مطلوب" },
    });
    return;
  }

  let officeId: string;
  try {
    officeId = getRequiredTenantId(req);
  } catch (err) {
    if (err instanceof TenantRequiredError) {
      res.status(403).json(tenantRequiredResponse());
      return;
    }
    throw err;
  }
  const userId = (req as any).userId as string;
  const cacheKey = buildCacheKey({
    officeId,
    userId,
    type,
    model,
    input: input.trim(),
    context,
  });

  if (!noCache) {
    const cached = cache.get<{ reply: string; modelUsed: string; cached: boolean }>(cacheKey);
    if (cached) {
      res.json({ success: true, ...cached, cached: true, type });
      return;
    }
  }

  const systemPrompt = SYSTEM_PROMPTS[type] ?? SYSTEM_PROMPTS.custom;
  const fullInput    = context
    ? `السياق:\n${context}\n\nالطلب:\n${input}`
    : input;

  try {
    const { reply, modelUsed, tier } = await callAI(
      systemPrompt,
      fullInput,
      [],
      model as any,
      officeId,
      type,
    );

    const result = { reply, modelUsed, tier, cached: false };
    cache.set(cacheKey, result, 600);

    /* ── Emit event (non-blocking) ──────────────────────────── */
    eventBus.emit({ type: "AI_QUERY", officeId, actorId: (req as { userId?: string }).userId, data: { queryType: type, modelUsed, tier } }).catch(() => {});

    auditLog({
      ...auditMeta(req),
      action:   "ai.query",
      resource: "ai_gateway",
      details:  `type=${type} model=${modelUsed} tier=${tier}`,
    }).catch(() => {});

    res.json({ success: true, ...result, type });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: { code: "AI_ERROR", message: err.message ?? "خطأ في معالجة الطلب" },
    });
  }
});

/* ─────────────────────────────────────────────────────────────────
   GET /api/ai/analytics/summary
───────────────────────────────────────────────────────────────── */
router.get("/ai/analytics/summary", requireAuthWithTenant, requirePermission("ai:access"), async (req, res) => {
  try {
    const { officeId, global } = resolveAnalyticsScope(req);
    const whereClause = global ? sql`` : sql`WHERE office_id = ${officeId}`;
    const rows = await db.execute(sql`
      SELECT
        COUNT(*)                                      AS total_queries,
        COUNT(*) FILTER (WHERE cached = true)         AS cache_hits,
        COALESCE(SUM(cost_points), 0)                 AS total_cost,
        COALESCE(AVG(response_ms) FILTER
          (WHERE response_ms IS NOT NULL), 0)::int    AS avg_response_ms,
        COUNT(DISTINCT office_id)                     AS active_offices,
        COUNT(*) FILTER (WHERE model_used='gemini')   AS gemini_count,
        COUNT(*) FILTER (WHERE model_used='claude')   AS claude_count,
        COUNT(*) FILTER (WHERE model_used='openai')   AS openai_count,
        COUNT(*) FILTER (WHERE model_used='deepseek') AS deepseek_count,
        COUNT(*) FILTER (WHERE model_used LIKE 'ollama%') AS ollama_count,
        COUNT(*) FILTER (WHERE model_used='fallback') AS fallback_count,
        COUNT(*) FILTER (WHERE tier='cheap')          AS cheap_count,
        COUNT(*) FILTER (WHERE tier='mid')            AS mid_count,
        COUNT(*) FILTER (WHERE tier='premium')        AS premium_count,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24h') AS last24h
      FROM ai_usage_logs
      ${whereClause}
    `) as any;
    const r = (rows?.rows ?? rows)?.[0] ?? {};
    const total    = Number(r.total_queries ?? 0);
    const cacheHits = Number(r.cache_hits ?? 0);
    const cacheRate = total > 0 ? Math.round((cacheHits / total) * 100) : 0;
    const premiumIfAll = (Number(r.cheap_count ?? 0) + Number(r.mid_count ?? 0)) * 3;
    const actualCost   = Number(r.total_cost ?? 0);
    const savedPoints  = Math.max(0, premiumIfAll - actualCost);
    res.json({
      success: true, total, cacheHits, cacheRate, savedPoints,
      totalCostPoints: actualCost,
      avgResponseMs:   Number(r.avg_response_ms ?? 0),
      activeOffices:   Number(r.active_offices  ?? 0),
      last24h:         Number(r.last24h         ?? 0),
      models: {
        gemini:   Number(r.gemini_count   ?? 0),
        claude:   Number(r.claude_count   ?? 0),
        openai:   Number(r.openai_count   ?? 0),
        deepseek: Number(r.deepseek_count ?? 0),
        ollama:   Number(r.ollama_count   ?? 0),
        fallback: Number(r.fallback_count ?? 0),
      },
      tiers: {
        cheap:   Number(r.cheap_count   ?? 0),
        mid:     Number(r.mid_count     ?? 0),
        premium: Number(r.premium_count ?? 0),
      },
      cacheStats: cache.stats(),
    });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/ai/analytics/daily", requireAuthWithTenant, requirePermission("ai:access"), async (req, res) => {
  try {
    const { officeId, global } = resolveAnalyticsScope(req);
    const rows = await db.execute(sql`
      SELECT
        DATE(created_at)                         AS day,
        COUNT(*)                                 AS total,
        COUNT(*) FILTER (WHERE cached = true)    AS cached,
        COALESCE(SUM(cost_points), 0)            AS cost,
        COUNT(*) FILTER (WHERE tier='cheap')     AS cheap,
        COUNT(*) FILTER (WHERE tier='mid')       AS mid,
        COUNT(*) FILTER (WHERE tier='premium')   AS premium
      FROM ai_usage_logs
      WHERE created_at > NOW() - INTERVAL '30 days'
        ${global ? sql`` : sql`AND office_id = ${officeId}`}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `) as any;
    res.json({
      success: true,
      data: (rows?.rows ?? rows ?? []).map((r: any) => ({
        day:     String(r.day).slice(0, 10),
        total:   Number(r.total   ?? 0),
        cached:  Number(r.cached  ?? 0),
        cost:    Number(r.cost    ?? 0),
        cheap:   Number(r.cheap   ?? 0),
        mid:     Number(r.mid     ?? 0),
        premium: Number(r.premium ?? 0),
      })),
    });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/ai/analytics/by-office", requireAuthWithTenant, requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT office_id,
        COUNT(*)                              AS total,
        COALESCE(SUM(cost_points), 0)         AS cost,
        COUNT(*) FILTER (WHERE cached = true) AS cached,
        MAX(created_at)                       AS last_used
      FROM ai_usage_logs
      GROUP BY office_id
      ORDER BY total DESC LIMIT 20
    `) as any;
    res.json({
      success: true,
      data: (rows?.rows ?? rows ?? []).map((r: any) => ({
        officeId: r.office_id,
        total:    Number(r.total  ?? 0),
        cost:     Number(r.cost   ?? 0),
        cached:   Number(r.cached ?? 0),
        lastUsed: r.last_used,
      })),
    });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/ai/analytics/recent", requireAuthWithTenant, requirePermission("ai:access"), async (req, res) => {
  try {
    const { officeId, global } = resolveAnalyticsScope(req);
    const rows = await db.execute(sql`
      SELECT id, office_id, query_type, model_used, tier, cost_points, cached, response_ms, created_at
      FROM ai_usage_logs
      ${global ? sql`` : sql`WHERE office_id = ${officeId}`}
      ORDER BY created_at DESC LIMIT 50
    `) as any;
    res.json({ success: true, data: rows?.rows ?? rows ?? [] });
  } catch (err: any) { res.status(500).json({ success: false, error: err.message }); }
});

router.get("/ai/query/types", requireAuthWithTenant, requirePermission("ai:access"), (_req, res) => {
  res.json({
    success: true,
    types: Object.keys(SYSTEM_PROMPTS).map((key) => ({
      key,
      label: {
        legal_assistant: "المساعد القانوني (عدل)",
        document_draft:  "صياغة وثيقة",
        case_analysis:   "تحليل قضية",
        opponent_sim:    "محاكاة الخصم (عدول)",
        legal_research:  "بحث قانوني",
        contract_review: "مراجعة عقد",
        custom:          "طلب مخصص",
      }[key] ?? key,
    })),
  });
});

router.get("/ai/query/cache-stats", requireAuthWithTenant, requirePermission("ai:access"), (_req, res) => {
  res.json({ success: true, cache: cache.stats() });
});

export default router;
