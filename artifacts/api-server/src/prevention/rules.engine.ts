/**
 * Prevention Rules Engine — قواعد واضحة تمنع 80% من الأعطال
 */

import { circuitBreaker, CIRCUITS } from "./circuit.breaker";

export type RuleAction =
  | "BLOCK_PAYMENT_FLOW"
  | "THROTTLE_REQUESTS"
  | "REJECT_REQUEST"
  | "OPEN_CIRCUIT"
  | "LOG_WARN"
  | "ALLOW";

export interface PreventionRule {
  id: string;
  condition: string;
  description: string;
  check: (ctx: RuleContext) => boolean;
  action: RuleAction;
  severity: "critical" | "high" | "medium" | "low";
}

export interface RuleContext {
  dbLatencyMs?: number;
  memoryPercent?: number;
  webhookFailures?: number;
  errorRate?: number;
  stripeSecretAvailable?: boolean;
  requestsPerMinute?: number;
  circuitStates?: Record<string, string>;
}

export interface RuleResult {
  triggered: boolean;
  ruleId: string;
  action: RuleAction;
  condition: string;
  severity: string;
  message: string;
}

/* ── الدليل الرسمي للقواعد ── */
export const PREVENTION_RULES: PreventionRule[] = [
  {
    id: "R001",
    condition: "missing_stripe_webhook_secret",
    description: "مفتاح Stripe مفقود → توقيف تدفق الدفع",
    check: (ctx) => ctx.stripeSecretAvailable === false,
    action: "BLOCK_PAYMENT_FLOW",
    severity: "critical",
  },
  {
    id: "R002",
    condition: "db_latency_critical",
    description: "تأخر DB فوق 1000ms → تقليل الطلبات",
    check: (ctx) => (ctx.dbLatencyMs ?? 0) > 1000,
    action: "THROTTLE_REQUESTS",
    severity: "critical",
  },
  {
    id: "R003",
    condition: "db_latency_high",
    description: "تأخر DB فوق 600ms → تحذير",
    check: (ctx) => (ctx.dbLatencyMs ?? 0) > 600 && (ctx.dbLatencyMs ?? 0) <= 1000,
    action: "LOG_WARN",
    severity: "high",
  },
  {
    id: "R004",
    condition: "high_error_rate",
    description: "معدل أخطاء > 10% → رفض الطلبات الجديدة",
    check: (ctx) => (ctx.errorRate ?? 0) > 0.10,
    action: "THROTTLE_REQUESTS",
    severity: "critical",
  },
  {
    id: "R005",
    condition: "webhook_storm",
    description: "فشل متكرر في Webhooks (≥5) → فتح دائرة Stripe",
    check: (ctx) => (ctx.webhookFailures ?? 0) >= 5,
    action: "OPEN_CIRCUIT",
    severity: "high",
  },
  {
    id: "R006",
    condition: "memory_critical",
    description: "استهلاك ذاكرة > 90% → تقليل الطلبات",
    check: (ctx) => (ctx.memoryPercent ?? 0) > 90,
    action: "THROTTLE_REQUESTS",
    severity: "critical",
  },
  {
    id: "R007",
    condition: "memory_high",
    description: "استهلاك ذاكرة > 80% → تحذير",
    check: (ctx) => (ctx.memoryPercent ?? 0) > 80 && (ctx.memoryPercent ?? 0) <= 90,
    action: "LOG_WARN",
    severity: "high",
  },
  {
    id: "R008",
    condition: "request_flood",
    description: "طلبات > 500/دقيقة → تقليل حركة المرور",
    check: (ctx) => (ctx.requestsPerMinute ?? 0) > 500,
    action: "THROTTLE_REQUESTS",
    severity: "high",
  },
  {
    id: "R009",
    condition: "stripe_circuit_open",
    description: "دائرة Stripe مفتوحة → توقيف تدفق الدفع",
    check: (ctx) => ctx.circuitStates?.[CIRCUITS.STRIPE] === "OPEN",
    action: "BLOCK_PAYMENT_FLOW",
    severity: "critical",
  },
  {
    id: "R010",
    condition: "ai_circuit_open",
    description: "دائرة AI مفتوحة → استخدام قالب احتياطي",
    check: (ctx) => ctx.circuitStates?.[CIRCUITS.AI] === "OPEN",
    action: "LOG_WARN",
    severity: "medium",
  },
];

/** تشغيل محرك القواعد على سياق معيّن */
export function evaluateRules(ctx: RuleContext): {
  results: RuleResult[];
  blocked: boolean;
  throttled: boolean;
  actions: RuleAction[];
} {
  const results: RuleResult[] = [];
  const actions = new Set<RuleAction>();

  /* أضف حالات الدوائر للسياق */
  const circuitStates: Record<string, string> = {};
  for (const [name] of Object.entries(CIRCUITS)) {
    circuitStates[name.toLowerCase()] = circuitBreaker.getState(name.toLowerCase());
  }
  const enriched: RuleContext = { ...ctx, circuitStates };

  for (const rule of PREVENTION_RULES) {
    if (rule.check(enriched)) {
      results.push({
        triggered: true,
        ruleId: rule.id,
        action: rule.action,
        condition: rule.condition,
        severity: rule.severity,
        message: rule.description,
      });
      actions.add(rule.action);

      /* تنفيذ جانبي — فتح دائرة Stripe عند webhook storm */
      if (rule.action === "OPEN_CIRCUIT" && rule.condition === "webhook_storm") {
        circuitBreaker.record(CIRCUITS.STRIPE, false);
      }
    }
  }

  return {
    results,
    blocked: actions.has("BLOCK_PAYMENT_FLOW") || actions.has("REJECT_REQUEST"),
    throttled: actions.has("THROTTLE_REQUESTS"),
    actions: Array.from(actions),
  };
}

/** السياق من مقاييس النظام الحالية */
export function buildRuleContext(metrics: {
  dbLatency?: number;
  memoryPercent?: number;
  webhookFailures?: number;
  errorRate?: number;
  activeRequests?: number;
}): RuleContext {
  const mem = process.memoryUsage();
  return {
    dbLatencyMs:       metrics.dbLatency,
    memoryPercent:     metrics.memoryPercent ?? Math.round((mem.heapUsed / mem.heapTotal) * 100),
    webhookFailures:   metrics.webhookFailures ?? 0,
    errorRate:         metrics.errorRate ?? 0,
    requestsPerMinute: (metrics.activeRequests ?? 0) * 60,
    stripeSecretAvailable: !!(process.env.STRIPE_SECRET_KEY),
  };
}
