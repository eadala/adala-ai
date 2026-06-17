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
import { requireAuth }       from "../../middlewares/requireAuth";
import { callAI }            from "./aiChat";
import { cache }             from "../../core/cache";
import { eventBus }          from "../../core/eventBus";
import { auditLog, auditMeta } from "../../lib/auditLogger";
import crypto                from "crypto";

const router = Router();

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

/* ── Cache key builder ──────────────────────────────────────────── */
function buildCacheKey(type: string, input: string, context?: string): string {
  const raw = `${type}|${input}|${context ?? ""}`;
  return `ai:${crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16)}`;
}

/* ─────────────────────────────────────────────────────────────────
   POST /api/ai/query
───────────────────────────────────────────────────────────────── */
router.post("/ai/query", requireAuth, async (req, res) => {
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

  const officeId = (req as any).tenantId ?? (req as any).userId ?? "unknown";
  const cacheKey = buildCacheKey(type, input.trim(), context);

  /* ── Cache hit ──────────────────────────────────────────────── */
  if (!noCache) {
    const cached = cache.get<{ reply: string; modelUsed: string; cached: boolean }>(cacheKey);
    if (cached) {
      res.json({ success: true, ...cached, cached: true, type });
      return;
    }
  }

  /* ── Route to correct system prompt ─────────────────────────── */
  const systemPrompt = SYSTEM_PROMPTS[type] ?? SYSTEM_PROMPTS.custom;
  const fullInput    = context
    ? `السياق:\n${context}\n\nالطلب:\n${input}`
    : input;

  try {
    const { reply, modelUsed } = await callAI(
      systemPrompt,
      fullInput,
      [],
      model as any,
      officeId,
    );

    const result = { reply, modelUsed, cached: false };

    /* ── Cache for 5 minutes ────────────────────────────────── */
    cache.set(cacheKey, result, 300);

    /* ── Emit event (non-blocking) ──────────────────────────── */
    eventBus.emit({ type: "AI_QUERY", data: { queryType: type, modelUsed, officeId } }).catch(() => {});

    /* ── Audit log ──────────────────────────────────────────── */
    auditLog({
      ...auditMeta(req),
      action:   "ai.query",
      resource: "ai_gateway",
      details:  `type=${type} model=${modelUsed}`,
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
   GET /api/ai/query/types  — list available query types
───────────────────────────────────────────────────────────────── */
router.get("/ai/query/types", requireAuth, (_req, res) => {
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

/* ─────────────────────────────────────────────────────────────────
   GET /api/ai/query/cache-stats  — monitoring
───────────────────────────────────────────────────────────────── */
router.get("/ai/query/cache-stats", requireAuth, (_req, res) => {
  res.json({ success: true, cache: cache.stats() });
});

export default router;
