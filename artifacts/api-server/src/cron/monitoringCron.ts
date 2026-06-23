import cron from "node-cron";
import { collectMetrics } from "../observability/metrics";
import { sendSmartAlert, checkTrendAlerts } from "../alerts/smart.alerts";
import { runSelfHealingCycle } from "../healing/self.healer";

let lastStatus = "healthy";
let cronTick = 0;

function healthScore(metrics: Awaited<ReturnType<typeof collectMetrics>>): { score: number; status: string } {
  let score = 100;
  if (metrics.memory.percent > 85)   score -= 20;
  if (metrics.memory.percent > 95)   score -= 20;
  if (metrics.dbLatency > 800)       score -= 15;
  if (metrics.dbLatency > 2000)      score -= 15;
  if (metrics.errorRate > 0.05)      score -= 20;
  if (!metrics.dbHealth)             score -= 30;
  score = Math.max(0, score);
  const status = score >= 70 ? "healthy" : score >= 40 ? "degraded" : "critical";
  return { score, status };
}

export function startMonitoringCron() {
  /* ── Every 10 minutes: lightweight in-process health check ── */
  cron.schedule("*/10 * * * *", async () => {
    cronTick++;
    try {
      /* collectMetrics() only pings DB once per 5min (cached), so this is cheap */
      const metrics = await collectMetrics();
      const { score, status } = healthScore(metrics);

      /* Alert on status transitions */
      if (status === "critical" && lastStatus !== "critical") {
        await sendSmartAlert("critical", `🔴 النظام في حالة حرجة — درجة الصحة: ${score}/100`, { channel: "both" });
      } else if (status === "degraded" && lastStatus === "healthy") {
        await sendSmartAlert("high", `🟠 أداء النظام متدهور`, { channel: "in-app" });
      } else if (status === "healthy" && lastStatus !== "healthy") {
        await sendSmartAlert("low", `🟢 النظام عاد للعمل الطبيعي`, { channel: "in-app" });
      }

      /* Threshold alerts — static keys ensure dedup works correctly */
      if (metrics.dbLatency > 800) {
        await sendSmartAlert("high", `⚠️ تأخر عالٍ في قاعدة البيانات`);
      }
      if (metrics.errorRate > 0.05) {
        await sendSmartAlert("high", `⚠️ معدل أخطاء عالٍ في الطلبات`);
      }
      if (metrics.webhookFailures >= 5) {
        await sendSmartAlert("critical", `🔴 فشل متكرر في Webhook`, { channel: "both" });
      }
      if (metrics.memory.percent > 85) {
        await sendSmartAlert("high", `⚠️ استهلاك ذاكرة عالٍ`);
      }

      /* Trend analysis + self-healing — every 3 ticks (30 min) */
      if (cronTick % 3 === 0) {
        checkTrendAlerts().catch(() => {});
        runSelfHealingCycle().catch(() => {});
      }

      lastStatus = status;
    } catch { /* never crash the cron */ }
  });

  console.log("[Monitoring Cron] ✅ Started — health check every 10 min (lightweight)");
}
