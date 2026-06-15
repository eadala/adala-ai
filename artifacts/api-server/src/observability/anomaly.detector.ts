import { SystemMetrics } from "./metrics";

export type AnomalyCode =
  | "HIGH_ERROR_RATE"
  | "DB_SLOWDOWN"
  | "MEMORY_PRESSURE"
  | "WEBHOOK_SPIKE"
  | "DB_DOWN"
  | "HIGH_ACTIVE_REQUESTS";

export interface Anomaly {
  code: AnomalyCode;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  value: number;
  threshold: number;
}

export function detectAnomalies(metrics: SystemMetrics): Anomaly[] {
  const anomalies: Anomaly[] = [];

  if (!metrics.dbHealth) {
    anomalies.push({
      code: "DB_DOWN",
      severity: "critical",
      message: "قاعدة البيانات غير متاحة",
      value: 0,
      threshold: 1,
    });
  }

  if (metrics.errorRate > 0.1) {
    anomalies.push({
      code: "HIGH_ERROR_RATE",
      severity: metrics.errorRate > 0.25 ? "critical" : "high",
      message: `معدل الأخطاء مرتفع: ${(metrics.errorRate * 100).toFixed(1)}%`,
      value: metrics.errorRate,
      threshold: 0.1,
    });
  }

  if (metrics.dbLatency > 500) {
    anomalies.push({
      code: "DB_SLOWDOWN",
      severity: metrics.dbLatency > 1500 ? "high" : "medium",
      message: `استجابة DB بطيئة: ${metrics.dbLatency}ms`,
      value: metrics.dbLatency,
      threshold: 500,
    });
  }

  if (metrics.memory.percent > 85) {
    anomalies.push({
      code: "MEMORY_PRESSURE",
      severity: metrics.memory.percent > 95 ? "critical" : "high",
      message: `ضغط ذاكرة عالٍ: ${metrics.memory.percent}%`,
      value: metrics.memory.percent,
      threshold: 85,
    });
  }

  if (metrics.webhookFailures > 3) {
    anomalies.push({
      code: "WEBHOOK_SPIKE",
      severity: "high",
      message: `ارتفاع فشل Webhooks: ${metrics.webhookFailures}`,
      value: metrics.webhookFailures,
      threshold: 3,
    });
  }

  if (metrics.activeRequests > 150) {
    anomalies.push({
      code: "HIGH_ACTIVE_REQUESTS",
      severity: "medium",
      message: `طلبات نشطة عالية: ${metrics.activeRequests}`,
      value: metrics.activeRequests,
      threshold: 150,
    });
  }

  return anomalies;
}
