import cron from "node-cron";
import { systemHealthCheck } from "../observability/healthcheck";
import { sendAlert } from "../monitoring/alerts";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let lastStatus = "healthy";

export function startMonitoringCron() {
  /* ── Every 60 seconds: health check + log to DB + alert if degraded ── */
  cron.schedule("*/60 * * * * *", async () => {
    try {
      const health = await systemHealthCheck();
      const { score, status, metrics, checks } = health;

      /* Log to system_metrics_log */
      try {
        await db.execute(sql`
          INSERT INTO system_metrics_log
            (health_score, error_rate, db_latency, memory_used, memory_total, active_fixes, anomalies, snapshot)
          VALUES (
            ${score},
            ${metrics.errorRate},
            ${metrics.dbLatency},
            ${metrics.memory.used},
            ${metrics.memory.total},
            0,
            '{}'::text[],
            ${JSON.stringify({ checks, uptime: metrics.uptime, webhookFailures: metrics.webhookFailures })}::jsonb
          )
        `);
      } catch { /* non-blocking */ }

      /* Alert on status transitions */
      if (status === "critical" && lastStatus !== "critical") {
        await sendAlert("critical", `🔴 النظام في حالة حرجة — درجة الصحة: ${score}/100`);
      } else if (status === "degraded" && lastStatus === "healthy") {
        await sendAlert("high", `🟠 أداء النظام متدهور — درجة الصحة: ${score}/100`);
      } else if (status === "healthy" && lastStatus !== "healthy") {
        await sendAlert("low", `🟢 النظام عاد للعمل الطبيعي — درجة الصحة: ${score}/100`);
      }

      /* Alert on specific thresholds */
      if (metrics.dbLatency > 800) {
        await sendAlert("high", `⚠️ تأخر عالٍ في قاعدة البيانات: ${metrics.dbLatency}ms`);
      }
      if (metrics.errorRate > 0.05) {
        await sendAlert("high", `⚠️ معدل أخطاء عالٍ: ${(metrics.errorRate * 100).toFixed(1)}%`);
      }
      if (metrics.webhookFailures >= 5) {
        await sendAlert("critical", `🔴 فشل متكرر في Webhook: ${metrics.webhookFailures} خطأ`);
      }
      if (metrics.memory.percent > 90) {
        await sendAlert("high", `⚠️ استهلاك ذاكرة عالٍ: ${metrics.memory.percent}%`);
      }

      lastStatus = status;
    } catch { /* non-blocking — never crash the cron */ }
  });

  console.log("[Monitoring Cron] ✅ Started — health check every 60s");
}
