import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export type AlertSeverity = "low" | "medium" | "high" | "critical";

const alertBuffer: { ts: number; severity: AlertSeverity; message: string }[] = [];

export async function sendAlert(severity: AlertSeverity, message: string) {
  const entry = { ts: Date.now(), severity, message };
  alertBuffer.push(entry);
  if (alertBuffer.length > 200) alertBuffer.shift();

  const icon = severity === "critical" ? "🔴" : severity === "high" ? "🟠" : severity === "medium" ? "🟡" : "🟢";
  console.log(`[ALERT] ${icon} [${severity.toUpperCase()}] ${message}`);

  try {
    await db.execute(sql`
      INSERT INTO healing_events (event_type, severity, source, message, anomalies, metadata)
      VALUES ('ALERT', ${severity}, 'monitoring', ${message}, '{}'::text[], '{}'::jsonb)
    `);
  } catch { /* non-blocking */ }
}

export function getRecentAlerts(limit = 50) {
  return alertBuffer.slice(-limit).reverse();
}

export async function simulate(flags: {
  stripeWebhookFailure?: boolean;
  dbLatency?: boolean;
  highErrorRate?: boolean;
}) {
  if (flags.stripeWebhookFailure) {
    const { recordWebhookFailure } = await import("../observability/metrics");
    for (let i = 0; i < 5; i++) recordWebhookFailure();
    await sendAlert("high", "[SIMULATE] Stripe webhook failure spike injected");
  }
  if (flags.highErrorRate) {
    const { recordRequest } = await import("../observability/metrics");
    for (let i = 0; i < 30; i++) recordRequest(false);
    await sendAlert("high", "[SIMULATE] High error rate injected");
  }
  if (flags.dbLatency) {
    await sendAlert("medium", "[SIMULATE] DB latency spike simulated");
  }
}
