import cron from "node-cron";
import { systemHealthCheck } from "../observability/healthcheck";
import { sendSmartAlert, checkTrendAlerts } from "../alerts/smart.alerts";
import { runSelfHealingCycle } from "../healing/self.healer";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

let lastStatus = "healthy";
let cronTick = 0;

export function startMonitoringCron() {
  /* ── Every 60 seconds: health check + log to DB + smart alerts ── */
  cron.schedule("*/60 * * * * *", async () => {
    cronTick++;
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
        await sendSmartAlert("critical", `🔴 النظام في حالة حرجة — درجة الصحة: ${score}/100`, { channel: "both" });
      } else if (status === "degraded" && lastStatus === "healthy") {
        await sendSmartAlert("high", `🟠 أداء النظام متدهور — درجة الصحة: ${score}/100`, { channel: "both" });
      } else if (status === "healthy" && lastStatus !== "healthy") {
        await sendSmartAlert("low", `🟢 النظام عاد للعمل الطبيعي — درجة الصحة: ${score}/100`, { channel: "in-app" });
      }

      /* Alert on specific thresholds (with dedup built into sendSmartAlert) */
      if (metrics.dbLatency > 800) {
        await sendSmartAlert("high", `⚠️ تأخر عالٍ في قاعدة البيانات: ${metrics.dbLatency}ms`);
      }
      if (metrics.errorRate > 0.05) {
        await sendSmartAlert("high", `⚠️ معدل أخطاء عالٍ: ${(metrics.errorRate * 100).toFixed(1)}%`);
      }
      if (metrics.webhookFailures >= 5) {
        await sendSmartAlert("critical", `🔴 فشل متكرر في Webhook: ${metrics.webhookFailures} خطأ`, { channel: "both" });
      }
      if (metrics.memory.percent > 90) {
        await sendSmartAlert("high", `⚠️ استهلاك ذاكرة عالٍ: ${metrics.memory.percent}%`);
      }

      /* Trend analysis — every 5 ticks (5 min) */
      if (cronTick % 5 === 0) {
        await checkTrendAlerts();
        /* Self-healing cycle — runs alongside trend analysis */
        runSelfHealingCycle().catch(() => {});
      }

      lastStatus = status;
    } catch { /* non-blocking — never crash the cron */ }
  });

  console.log("[Monitoring Cron] ✅ Started — health check every 60s (smart alerts enabled)");
}
