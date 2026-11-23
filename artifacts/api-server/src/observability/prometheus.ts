/**
 * 📊 Prometheus Metrics — عدالة AI
 * ──────────────────────────────────
 * يتتبع:
 *  • عدد الطلبات (method + route + status + tenant)
 *  • زمن الاستجابة (histogram بـ buckets متدرجة)
 *  • الأخطاء (route + tenant)
 *  • مقاييس Node.js الافتراضية (CPU, memory, event loop)
 *  • AI requests + latency
 *
 * Endpoint: GET /metrics  (Prometheus scrape)
 * تكامل: app.ts middleware + router
 */

import * as client from "prom-client";

/* ── سجل منفصل عن prom-client الافتراضي لضمان namespace نظيف ──── */
export const registry = new client.Registry();
registry.setDefaultLabels({ app: "adala-ai", env: process.env.NODE_ENV ?? "development" });

/* ── Default Node.js metrics (CPU, memory, GC, event loop) ──────── */
client.collectDefaultMetrics({ register: registry, prefix: "adala_node_" });

/* ═══════════════════════════════════════════════════════════════════
   HTTP METRICS
═══════════════════════════════════════════════════════════════════ */

/** عدد الطلبات الكاملة */
export const httpRequestsTotal = new client.Counter({
  name:    "adala_http_requests_total",
  help:    "Total HTTP requests",
  labelNames: ["method", "route", "status", "tenant"] as const,
  registers: [registry],
});

/** زمن معالجة الطلب (ms) */
export const httpRequestDuration = new client.Histogram({
  name:    "adala_http_request_duration_ms",
  help:    "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "tenant"] as const,
  buckets: [20, 50, 100, 200, 300, 500, 1000, 2000, 5000],
  registers: [registry],
});

/** عدد الأخطاء (4xx / 5xx) */
export const httpErrorsTotal = new client.Counter({
  name:    "adala_http_errors_total",
  help:    "Total HTTP errors (4xx + 5xx)",
  labelNames: ["route", "status", "tenant"] as const,
  registers: [registry],
});

/* ═══════════════════════════════════════════════════════════════════
   BUSINESS METRICS
═══════════════════════════════════════════════════════════════════ */

/** عدد طلبات AI */
export const aiRequestsTotal = new client.Counter({
  name:    "adala_ai_requests_total",
  help:    "Total AI requests (legal-ai, copilot, chat, etc.)",
  labelNames: ["type", "tenant", "model"] as const,
  registers: [registry],
});

/** زمن استجابة AI */
export const aiRequestDuration = new client.Histogram({
  name:    "adala_ai_request_duration_ms",
  help:    "AI request duration in milliseconds",
  labelNames: ["type", "tenant"] as const,
  buckets: [500, 1000, 2000, 5000, 10000, 30000],
  registers: [registry],
});

/** القضايا المُنشأة */
export const casesCreatedTotal = new client.Counter({
  name:    "adala_cases_created_total",
  help:    "Total cases created",
  labelNames: ["tenant"] as const,
  registers: [registry],
});

/** الفواتير المدفوعة */
export const invoicesPaidTotal = new client.Counter({
  name:    "adala_invoices_paid_total",
  help:    "Total invoices paid",
  labelNames: ["tenant", "currency"] as const,
  registers: [registry],
});

/** إجمالي المبلغ المحصَّل */
export const revenueTotal = new client.Counter({
  name:    "adala_revenue_total",
  help:    "Total revenue collected (in smallest currency unit)",
  labelNames: ["tenant", "currency"] as const,
  registers: [registry],
});

/** مؤشر صحة DB */
export const dbHealthGauge = new client.Gauge({
  name:    "adala_db_health",
  help:    "Database health (1=healthy, 0=down)",
  registers: [registry],
});

/** زمن استجابة DB */
export const dbLatencyMs = new client.Gauge({
  name:    "adala_db_latency_ms",
  help:    "Latest DB query latency in milliseconds",
  registers: [registry],
});

/** المستخدمون النشطون الآن */
export const activeUsersGauge = new client.Gauge({
  name:    "adala_active_users",
  help:    "Users active in the last hour",
  registers: [registry],
});

/** مهام AI المعلّقة */
export const aiPendingTasksGauge = new client.Gauge({
  name:    "adala_ai_pending_tasks",
  help:    "AI tasks currently pending",
  registers: [registry],
});

/* ═══════════════════════════════════════════════════════════════════
   MIDDLEWARE FACTORY
═══════════════════════════════════════════════════════════════════ */

/**
 * Express middleware — يُضاف على app قبل الـ routes
 * يتتبع كل طلب بعد انتهائه (on "finish")
 */
export function prometheusMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    /* استخرج tenant من JWT header أو office-id header */
    const tenant: string =
      (req.headers["x-office-id"] as string) ||
      (req.auth?.sessionClaims?.officeId as string) ||
      "unknown";

    res.on("finish", () => {
      const duration    = Date.now() - start;
      const route       = sanitizeRoute(req.path);
      const method      = req.method;
      const status      = String(res.statusCode);

      httpRequestsTotal.labels(method, route, status, tenant).inc();
      httpRequestDuration.labels(method, route, tenant).observe(duration);

      if (res.statusCode >= 400) {
        httpErrorsTotal.labels(route, status, tenant).inc();
      }
    });

    next();
  };
}

/** يُبسّط المسارات الديناميكية — /cases/abc123 → /cases/:id */
function sanitizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:uuid")
    .replace(/\/\d+/g,  "/:id")
    .split("?")[0]
    .substring(0, 80);
}

/* ═══════════════════════════════════════════════════════════════════
   HELPER — يُسجَّل من أي route يدوياً
═══════════════════════════════════════════════════════════════════ */

export function recordAiRequest(opts: {
  type: string; tenant: string; model?: string; durationMs: number;
}) {
  aiRequestsTotal.labels(opts.type, opts.tenant, opts.model ?? "gemini").inc();
  aiRequestDuration.labels(opts.type, opts.tenant).observe(opts.durationMs);
}

export function recordCaseCreated(tenant: string) {
  casesCreatedTotal.labels(tenant).inc();
}

export function recordInvoicePaid(tenant: string, currency = "SAR", amount = 0) {
  invoicesPaidTotal.labels(tenant, currency).inc();
  revenueTotal.labels(tenant, currency).inc(amount);
}

export function updateSystemGauges(opts: {
  dbHealth: boolean; dbLatencyMs: number;
  activeUsers: number; aiPendingTasks: number;
}) {
  dbHealthGauge.set(opts.dbHealth ? 1 : 0);
  dbLatencyMs.set(opts.dbLatencyMs);
  activeUsersGauge.set(opts.activeUsers);
  aiPendingTasksGauge.set(opts.aiPendingTasks);
}
