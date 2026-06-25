/**
 * JLWM AI Layer — Wrapper around the platform's callAI() with JLWM-specific
 * system prompts, context injection, and audit logging.
 */

import { callAI }    from "../ai/aiChat";
import { auditLog }  from "../../lib/auditLogger";

/* ── JLWM System Prompts ─────────────────────────────────────── */
const JLWM_BASE = `أنت Justice Legal World Model (JLWM) — نظام الذكاء القانوني المؤسسي لمنصة عدالة.
مهمتك تحليل البيانات القانونية للمكتب وتقديم رؤى استراتيجية دقيقة.
أجب دائماً بالعربية. كن محدداً وعملياً. لا تختلق بيانات غير موجودة في السياق المعطى.`;

export const JLWM_PROMPTS = {
  worldState: `${JLWM_BASE}
مهمتك الآن: تحليل حالة المكتب القانوني الحالية وإنتاج:
1. ملخص تنفيذي (2-3 جمل)
2. مستوى الخطر (green/yellow/orange/red) مع السبب
3. التهديدات النشطة (قائمة موجزة)
4. الفرص المتاحة (قائمة موجزة)
أعد JSON فقط دون أي نص إضافي.`,

  patternDiscovery: `${JLWM_BASE}
مهمتك: اكتشاف الأنماط الخفية في بيانات المكتب القانوني.
ابحث عن: أنماط النتائج، أنماط التوقيت، الأنماط المالية، السلوك المتكرر.
أعد JSON فقط بصيغة: { "patterns": [{ "type", "name", "description", "confidence", "applies_to" }] }`,

  memoryAnalysis: `${JLWM_BASE}
مهمتك: تحليل مخطط المعرفة القانوني وإيجاد:
1. الروابط المخفية بين الكيانات
2. الكيانات الأكثر تأثيراً
3. الشبكات القانونية القوية
أعد JSON فقط.`,

  commandQuery: `${JLWM_BASE}
أنت مساعد ذكي يجيب على استفسارات مدير المكتب القانوني.
السياق يشمل: بيانات القضايا، العملاء، الإيرادات، حالة العالم القانوني.
أجب بشكل مفصّل وعملي. استخدم القوائم والأرقام عند الإمكان.`,
};

/* ── Core AI call for JLWM ───────────────────────────────────── */
export async function callJLWMAI(opts: {
  task:     keyof typeof JLWM_PROMPTS;
  message:  string;
  officeId: string;
  userId?:  string;
  context?: Record<string, unknown>;
}): Promise<{ reply: string; modelUsed: string; durationMs: number }> {
  const start  = Date.now();
  const system = JLWM_PROMPTS[opts.task];

  const contextMsg = opts.context
    ? `\n\n[CONTEXT DATA]\n${JSON.stringify(opts.context, null, 2)}\n\n[USER QUERY]\n${opts.message}`
    : opts.message;

  const { reply, modelUsed } = await callAI(system, contextMsg, [], "mid", opts.officeId);
  const durationMs = Date.now() - start;

  /* Non-blocking audit */
  auditLog({
    userId:     opts.userId ?? "system",
    officeId:   opts.officeId,
    action:     `jlwm_ai_${opts.task}`,
    resource:   "jlwm",
    resourceId: opts.officeId,
    details:    `model:${modelUsed} dur:${durationMs}ms`,
    ipAddress:  null,
    userAgent:  null,
  }).catch(() => {});

  return { reply, modelUsed, durationMs };
}

/* ── JSON extractor (Gemini sometimes wraps in markdown) ─────── */
export function extractJSON<T = unknown>(text: string): T | null {
  const clean = text
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();
  try {
    return JSON.parse(clean) as T;
  } catch {
    /* Try to find the first { ... } block */
    const m = clean.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]) as T; } catch { /* ignore */ }
    }
    return null;
  }
}
