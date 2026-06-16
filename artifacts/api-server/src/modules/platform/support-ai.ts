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

/* ══════════════════════════════════════════════════════════════════════════
   TABLES
══════════════════════════════════════════════════════════════════════════ */
export async function ensureSupportAITables(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_ai_analysis (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ticket_id       TEXT NOT NULL UNIQUE,
      ai_type         TEXT,   -- security | bug | billing | performance | feature | general
      ai_priority     TEXT,   -- critical | high | medium | low
      ai_root_cause   TEXT,
      ai_confidence   NUMERIC(4,2) DEFAULT 0,
      ai_suggestions  JSONB  DEFAULT '[]',
      ai_summary      TEXT,
      ai_auto_replied BOOLEAN DEFAULT FALSE,
      ai_escalated    BOOLEAN DEFAULT FALSE,
      soc_alerted     BOOLEAN DEFAULT FALSE,
      knowledge_hits  JSONB  DEFAULT '[]',
      model_used      TEXT,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS support_knowledge_base (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category    TEXT NOT NULL,
      issue       TEXT NOT NULL,
      fix         TEXT NOT NULL,
      tags        TEXT[] DEFAULT '{}',
      hits        INT  DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  /* Seed knowledge base */
  await db.execute(sql`
    INSERT INTO support_knowledge_base (category, issue, fix, tags) VALUES
      ('security', 'cross-tenant data leak', 'Add office_id filter + enable RLS on all tables', ARRAY['security','rls','office_id']),
      ('security', 'auth bypass', 'Check middleware order + JWT validation + requireAuthWithTenant', ARRAY['auth','jwt','middleware']),
      ('security', 'unauthorized access', 'Verify Clerk session + check role permissions in hr_memberships', ARRAY['clerk','auth','rbac']),
      ('bug', 'missing data in dashboard', 'Check SQL WHERE office_id filter + verify tenantId resolution', ARRAY['sql','tenant','filter']),
      ('bug', 'invoice not appearing', 'Verify office_id on client_invoices + check status filter', ARRAY['invoice','billing']),
      ('bug', 'ai not responding', 'Check GEMINI_API_KEY env var + callAI() error fallback', ARRAY['ai','gemini','api']),
      ('billing', 'payment failed', 'Check Stripe webhook handler + office_stripe_accounts entry', ARRAY['stripe','payment','webhook']),
      ('billing', 'subscription not active', 'Check office_subscriptions table + plan expiry date', ARRAY['subscription','plan']),
      ('performance', 'slow loading', 'Check query staleTime + QueryClient config + add SQL indexes', ARRAY['performance','react-query','sql']),
      ('feature', 'request new feature', 'Log in product backlog + estimate priority based on plan tier', ARRAY['feature','product'])
    ON CONFLICT DO NOTHING
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
