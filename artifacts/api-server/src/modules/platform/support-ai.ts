/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars -- pre-existing lint debt; Stage 7 schema ownership only */
/**
 * AI Support Agent Layer — عدالة AI
 * ─────────────────────────────────────────────────────────────────────────
 * Self-Healing Support System:
 *   1. AI Classification Engine   — classifyTicket()
 *   2. Root Cause Analysis        — analyzeRootCause() via callAI()
 *   3. Solution Generator         — suggestFix() via callAI()
 *   4. Auto-Response Engine       — postAIReply() → support_messages
 *   5. SOC Integration            — eventBus for security tickets
 *   6. Knowledge Base             — support_knowledge_base table
 *   7. AI Metrics                 — stats & performance
 *
 * Schema owned by Migration 045 — Runtime CREATE removed.
 * KB seed INSERT uses WHERE NOT EXISTS (category, issue); no invented UNIQUE.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
import { getAuth } from "@clerk/express";
import { callAI } from "../ai/aiChat";
import { eventBus } from "../../core/eventBus";

const router = Router();

/* ── helpers ─────────────────────────────────────────────────────────────── */
function rows(r: any): any[] { return Array.isArray(r) ? r : (r?.rows ?? []); }
function one(r: any): any    { return rows(r)[0] ?? null; }

/* ── readiness — schema owned by Migration 045 ── */
let supportAiSchemaReady = false;
export async function ensureSupportAITables(): Promise<void> {
  if (!supportAiSchemaReady) {
    try {
      const r = await db.execute(sql`
        SELECT
          to_regclass('public.support_ai_analysis') IS NOT NULL AS analysis_present,
          to_regclass('public.support_knowledge_base') IS NOT NULL AS kb_present
      `).catch(() => ({ rows: [{}] }));
      const row = ((r as { rows?: Record<string, unknown>[] }).rows ?? [])[0] ?? {};
      if (!row.analysis_present || !row.kb_present) {
        console.error("[support-ai] Migration 045 schema not ready — support_ai_analysis / support_knowledge_base missing");
        return;
      }
      supportAiSchemaReady = true;
    } catch { /* non-blocking */ }
  }

  /* Canonical KB seed — PK-only table (no invented UNIQUE). Logical identity
   * is the full canonical tuple (category, issue, fix, tags). INSERT … SELECT
   * … WHERE NOT EXISTS so re-runs and process restarts never duplicate the
   * canonical rows, while operator/admin rows with different fix/tags are
   * preserved and do not suppress the canonical entry. */
  await db.execute(sql`
    INSERT INTO support_knowledge_base (category, issue, fix, tags)
    SELECT v.category, v.issue, v.fix, v.tags
    FROM (VALUES
      ('security'::text, 'cross-tenant data leak'::text, 'Add office_id filter + enable RLS on all tables'::text, ARRAY['security','rls','office_id']::text[]),
      ('security'::text, 'auth bypass'::text, 'Check middleware order + JWT validation + requireAuthWithTenant'::text, ARRAY['auth','jwt','middleware']::text[]),
      ('security'::text, 'unauthorized access'::text, 'Verify Clerk session + check role permissions in hr_memberships'::text, ARRAY['clerk','auth','rbac']::text[]),
      ('bug'::text, 'missing data in dashboard'::text, 'Check SQL WHERE office_id filter + verify tenantId resolution'::text, ARRAY['sql','tenant','filter']::text[]),
      ('bug'::text, 'invoice not appearing'::text, 'Verify office_id on client_invoices + check status filter'::text, ARRAY['invoice','billing']::text[]),
      ('bug'::text, 'ai not responding'::text, 'Check GEMINI_API_KEY env var + callAI() error fallback'::text, ARRAY['ai','gemini','api']::text[]),
      ('billing'::text, 'payment failed'::text, 'Check Stripe webhook handler + office_stripe_accounts entry'::text, ARRAY['stripe','payment','webhook']::text[]),
      ('billing'::text, 'subscription not active'::text, 'Check office_subscriptions table + plan expiry date'::text, ARRAY['subscription','plan']::text[]),
      ('performance'::text, 'slow loading'::text, 'Check query staleTime + QueryClient config + add SQL indexes'::text, ARRAY['performance','react-query','sql']::text[]),
      ('feature'::text, 'request new feature'::text, 'Log in product backlog + estimate priority based on plan tier'::text, ARRAY['feature','product']::text[])
    ) AS v(category, issue, fix, tags)
    WHERE NOT EXISTS (
      SELECT 1 FROM support_knowledge_base k
      WHERE k.category = v.category
        AND k.issue = v.issue
        AND k.fix = v.fix
        AND coalesce(k.tags, ARRAY[]::text[]) = v.tags
    )
  `).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   1) AI CLASSIFICATION ENGINE — rule-based fast path
══════════════════════════════════════════════════════════════════════════ */
export function classifyTicket(subject: string, body: string): {
  type: string; priority: string; confidence: number;
} {
  const text = `${subject} ${body}`.toLowerCase();

  if (/unauthorized|leak|breach|exploit|sql.?inject|xss|csrf|bypass|privilege|hack|intrusion|تسريب|اختراق|تجاوز|غير مصرح/.test(text))
    return { type: "security", priority: "critical", confidence: 0.93 };

  if (/payment|invoice|billing|stripe|subscription|charge|refund|فاتورة|دفع|اشتراك|مبلغ/.test(text))
    return { type: "billing", priority: "medium", confidence: 0.88 };

  if (/error|bug|crash|broken|not working|fail|خطأ|عطل|مشكلة|لا يعمل|توقف/.test(text))
    return { type: "bug", priority: "high", confidence: 0.85 };

  if (/slow|timeout|loading|performance|latency|بطيء|تحميل|أداء/.test(text))
    return { type: "performance", priority: "medium", confidence: 0.82 };

  if (/feature|request|suggest|improve|enhance|ميزة|طلب|مقترح|تحسين/.test(text))
    return { type: "feature", priority: "low", confidence: 0.80 };

  return { type: "general", priority: "low", confidence: 0.5 };
}

/* ══════════════════════════════════════════════════════════════════════════
   2) KNOWLEDGE BASE LOOKUP
══════════════════════════════════════════════════════════════════════════ */
async function lookupKnowledge(type: string, text: string): Promise<any[]> {
  const hits = rows(await db.execute(sql`
    SELECT *, ts_rank(to_tsvector('simple', issue || ' ' || fix), plainto_tsquery('simple', ${text})) AS rank
    FROM support_knowledge_base
    WHERE category = ${type} OR ${text} ILIKE '%' || issue || '%'
    ORDER BY rank DESC, hits DESC
    LIMIT 3
  `).catch(() => null));

  /* Increment hit counter fire-and-forget */
  for (const h of hits) {
    db.execute(sql`UPDATE support_knowledge_base SET hits = hits + 1 WHERE id = ${h.id}::uuid`).catch(() => {});
  }

  return hits.map((h: any) => ({ issue: h.issue, fix: h.fix }));
}

/* ══════════════════════════════════════════════════════════════════════════
   3) ROOT CAUSE ANALYSIS + SOLUTION GENERATOR (AI-Powered)
══════════════════════════════════════════════════════════════════════════ */
async function runAIPipeline(ticketId: string, subject: string, body: string, type: string, knowledgeHits: any[]): Promise<{
  rootCause: string; suggestions: string[]; summary: string; modelUsed: string;
}> {
  const kbContext = knowledgeHits.length
    ? `\n\nقاعدة المعرفة ذات الصلة:\n${knowledgeHits.map(k => `- المشكلة: ${k.issue}\n  الحل: ${k.fix}`).join("\n")}`
    : "";

  const systemPrompt = `أنت وكيل دعم فني ذكي لمنصة عدالة AI — منصة SaaS قانونية. 
مهمتك تحليل تذاكر الدعم الفني وتقديم تشخيص دقيق وحلول عملية.
المنصة مبنية على: Node.js + PostgreSQL + Clerk Auth + Drizzle ORM + React.
الأنماط الشائعة للأخطاء: فلترة office_id، RBAC، اتصال AI، Stripe webhooks.${kbContext}`;

  const userPrompt = `تحليل هذه التذكرة (نوع: ${type}):
الموضوع: ${subject}
التفاصيل: ${body}

أجب بـ JSON بهذا الشكل بالضبط:
{
  "root_cause": "السبب الجذري المحتمل (جملة واحدة)",
  "suggestions": ["اقتراح 1", "اقتراح 2", "اقتراح 3"],
  "summary": "ملخص التحليل للمستخدم (2-3 جمل)"
}`;

  try {
    const { reply, modelUsed } = await callAI(systemPrompt, userPrompt);
    const cleaned = reply.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      rootCause: parsed.root_cause ?? "يتطلب مراجعة بشرية",
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      summary: parsed.summary ?? "",
      modelUsed: modelUsed ?? "unknown",
    };
  } catch {
    /* Fallback — rule-based */
    const fallbacks: Record<string, { rootCause: string; suggestions: string[] }> = {
      security: {
        rootCause: "احتمال وجود ثغرة في التحقق من الصلاحيات أو فلترة office_id",
        suggestions: ["مراجعة RLS policy على الجداول المتأثرة", "التحقق من requireAuthWithTenant في المسار", "فحص سجلات SOC للأنماط غير الطبيعية"],
      },
      bug: {
        rootCause: "خلل محتمل في validation البيانات أو معالج الخطأ",
        suggestions: ["مراجعة آخر deployment", "فحص schema API response", "التحقق من null handling"],
      },
      billing: {
        rootCause: "مشكلة في معالج Stripe webhook أو حالة الاشتراك",
        suggestions: ["التحقق من office_subscriptions", "مراجعة Stripe dashboard", "فحص حساب office_stripe_accounts"],
      },
      performance: {
        rootCause: "بطء في الاستعلام أو غياب فهرس قاعدة البيانات",
        suggestions: ["إضافة SQL index على office_id", "مراجعة staleTime في QueryClient", "فحص حجم البيانات المُعادة"],
      },
    };
    const fb = fallbacks[type] ?? { rootCause: "يتطلب مراجعة يدوية", suggestions: ["تصعيد للدعم البشري"] };
    return { rootCause: fb.rootCause, suggestions: fb.suggestions, summary: "", modelUsed: "fallback" };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   4) AUTO-RESPONSE ENGINE
══════════════════════════════════════════════════════════════════════════ */
async function postAIReply(ticketId: string, rootCause: string, suggestions: string[], summary: string): Promise<void> {
  const messageLines = [
    "🤖 **تحليل وكيل الدعم الذكي**",
    "",
    summary ? `**ملخص:** ${summary}` : "",
    "",
    `**السبب الجذري المحتمل:**`,
    `${rootCause}`,
    "",
    "**الإجراءات المقترحة:**",
    ...suggestions.map((s, i) => `${i + 1}. ${s}`),
    "",
    "---",
    "_إذا لم تُحَل المشكلة، تم تصعيد طلبك إلى فريق الدعم البشري تلقائياً._",
  ].filter(l => l !== undefined).join("\n");

  await db.execute(sql`
    INSERT INTO support_messages (ticket_id, sender_type, sender_name, message)
    VALUES (${ticketId}, 'admin', 'وكيل الدعم الذكي 🤖', ${messageLines})
  `).catch(() => {});

  /* Update ticket status to in_progress */
  await db.execute(sql`
    UPDATE support_tickets SET status = 'in_progress', updated_at = NOW()
    WHERE id = ${ticketId} AND status = 'open'
  `).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   5) SOC INTEGRATION
══════════════════════════════════════════════════════════════════════════ */
function alertSOC(ticketId: string, type: string, subject: string): void {
  eventBus.emit({
    type: "SECURITY_EVENT" as any,
    data: {
      hrEventType: "AI_DETECTED_SECURITY_ISSUE",
      severity: "CRITICAL",
      ticketId,
      subject,
      detectedAt: new Date().toISOString(),
    },
  }).catch(() => {});
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PIPELINE — called after ticket creation
══════════════════════════════════════════════════════════════════════════ */
export async function runSupportAIPipeline(ticketId: string, subject: string, body: string): Promise<void> {
  try {
    await ensureSupportAITables();

    /* 1. Classify */
    const { type, priority, confidence } = classifyTicket(subject, body);

    /* 2. Knowledge base */
    const kbHits = await lookupKnowledge(type, `${subject} ${body}`.substring(0, 200));

    /* 3. AI analysis */
    const { rootCause, suggestions, summary, modelUsed } = await runAIPipeline(ticketId, subject, body, type, kbHits);

    /* 4. SOC alert for security */
    const socAlerted = type === "security";
    if (socAlerted) alertSOC(ticketId, type, subject);

    /* 5. Save analysis */
    await db.execute(sql`
      INSERT INTO support_ai_analysis
        (ticket_id, ai_type, ai_priority, ai_root_cause, ai_confidence,
         ai_suggestions, ai_summary, ai_escalated, soc_alerted, knowledge_hits,
         model_used, ai_auto_replied)
      VALUES (${ticketId}, ${type}, ${priority}, ${rootCause}, ${confidence},
              ${JSON.stringify(suggestions)}::jsonb, ${summary},
              ${type === "security"}, ${socAlerted},
              ${JSON.stringify(kbHits)}::jsonb, ${modelUsed}, true)
      ON CONFLICT (ticket_id) DO UPDATE SET
        ai_type = EXCLUDED.ai_type, ai_priority = EXCLUDED.ai_priority,
        ai_root_cause = EXCLUDED.ai_root_cause, ai_confidence = EXCLUDED.ai_confidence,
        ai_suggestions = EXCLUDED.ai_suggestions, ai_summary = EXCLUDED.ai_summary,
        ai_auto_replied = true, updated_at = NOW()
    `).catch(() => {});

    /* 6. Post auto-reply */
    await postAIReply(ticketId, rootCause, suggestions, summary);

  } catch { /* never crash the ticket flow */ }
}

/* ══════════════════════════════════════════════════════════════════════════
   ROUTES
══════════════════════════════════════════════════════════════════════════ */

/* POST /support/tickets/:id/ai-analyze — re-analyze existing ticket */
router.post("/support/tickets/:id/ai-analyze", requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    await ensureSupportAITables();
    const ticket = one(await db.execute(sql`
      SELECT * FROM support_tickets WHERE id = ${String(req.params.id)} AND user_id = ${userId}
    `));
    if (!ticket) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }

    /* Run async so client gets immediate response */
    runSupportAIPipeline(ticket.id, ticket.subject, ticket.body ?? "").catch(() => {});
    res.json({ status: "processing", message: "الذكاء الاصطناعي يحلل التذكرة..." });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /support/tickets/:id/ai-analysis — fetch AI analysis for a ticket */
router.get("/support/tickets/:id/ai-analysis", requireAuth, async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    await ensureSupportAITables();
    /* Verify ownership */
    const ticket = one(await db.execute(sql`
      SELECT id FROM support_tickets WHERE id = ${String(req.params.id)} AND user_id = ${userId}
    `));
    if (!ticket) { res.status(404).json({ error: "التذكرة غير موجودة" }); return; }

    const analysis = one(await db.execute(sql`
      SELECT * FROM support_ai_analysis WHERE ticket_id = ${String(req.params.id)}
    `));
    res.json(analysis ?? null);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /support/ai-stats — AI performance metrics */
router.get("/support/ai-stats", requireAuth, async (req, res) => {
  try {
    await ensureSupportAITables();
    const stats = one(await db.execute(sql`
      SELECT
        COUNT(*)::int                                                        AS total_analyzed,
        COUNT(*) FILTER (WHERE ai_auto_replied)::int                        AS auto_replied,
        COUNT(*) FILTER (WHERE ai_escalated)::int                           AS escalated,
        COUNT(*) FILTER (WHERE soc_alerted)::int                            AS soc_alerts,
        ROUND(AVG(ai_confidence) * 100, 1)                                  AS avg_confidence_pct,
        COUNT(*) FILTER (WHERE ai_type = 'security')::int                   AS security_tickets,
        COUNT(*) FILTER (WHERE ai_type = 'bug')::int                        AS bug_tickets,
        COUNT(*) FILTER (WHERE ai_type = 'billing')::int                    AS billing_tickets,
        COUNT(*) FILTER (WHERE ai_type = 'performance')::int                AS performance_tickets,
        COUNT(*) FILTER (WHERE ai_type = 'feature')::int                    AS feature_tickets,
        COUNT(*) FILTER (WHERE ai_type = 'general')::int                    AS general_tickets,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ai_auto_replied) / NULLIF(COUNT(*), 0), 1
        )                                                                    AS ai_resolution_rate,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ai_escalated) / NULLIF(COUNT(*), 0), 1
        )                                                                    AS escalation_rate
      FROM support_ai_analysis
    `));

    /* Total tickets in system */
    const totals = one(await db.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status IN ('open','in_progress'))::int AS active,
        COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE status = 'closed')::int AS closed
      FROM support_tickets
    `));

    res.json({ ai: stats ?? {}, tickets: totals ?? {} });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /support/knowledge-base — list knowledge base entries */
router.get("/support/knowledge-base", requireAuth, async (req, res) => {
  try {
    await ensureSupportAITables();
    const data = rows(await db.execute(sql`
      SELECT * FROM support_knowledge_base ORDER BY hits DESC, created_at DESC
    `));
    res.json(data);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
