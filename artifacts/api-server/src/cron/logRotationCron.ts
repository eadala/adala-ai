import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import cron from "node-cron";
import { logger } from "../lib/logger";

async function runLogRotation(): Promise<void> {
  const results: Record<string, number> = {};

  // 1. system_metrics_log — keep 30 days
  const m1 = await db.execute(sql`
    DELETE FROM system_metrics_log
    WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.system_metrics_log = m1;

  // 2. healing_events + heal_events — keep 30 days
  const m2 = await db.execute(sql`
    DELETE FROM healing_events WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.healing_events = m2;

  const m3 = await db.execute(sql`
    DELETE FROM heal_events WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.heal_events = m3;

  // 3. agent_job_logs — keep 30 days
  const m4 = await db.execute(sql`
    DELETE FROM agent_job_logs WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.agent_job_logs = m4;

  // 4. stripe_reconciliation_log — keep 90 days (financial)
  const m5 = await db.execute(sql`
    DELETE FROM stripe_reconciliation_log WHERE created_at < NOW() - INTERVAL '90 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.stripe_reconciliation_log = m5;

  // 5. ai_analytics_cache — keep 7 days (short cache)
  const m6 = await db.execute(sql`
    DELETE FROM ai_analytics_cache WHERE created_at < NOW() - INTERVAL '7 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.ai_analytics_cache = m6;

  // 6. email_logs — keep 30 days
  const m7 = await db.execute(sql`
    DELETE FROM email_logs WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.email_logs = m7;

  // 7. whatsapp_logs + telegram_logs — keep 30 days
  const m8 = await db.execute(sql`
    DELETE FROM whatsapp_logs WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.whatsapp_logs = m8;

  const m9 = await db.execute(sql`
    DELETE FROM telegram_logs WHERE created_at < NOW() - INTERVAL '30 days'
  `).then((r: any) => (r?.rowCount ?? 0)).catch(() => 0);
  results.telegram_logs = m9;

  // 8. Persist daily aggregate stats before deleting (for historical reporting)
  await db.execute(sql`
    INSERT INTO event_daily_counts (date, event_type, count, created_at)
    SELECT
      DATE(NOW()) - INTERVAL '1 day' as date,
      'log_rotation_purged' as event_type,
      ${Object.values(results).reduce((a, b) => a + b, 0)}::int as count,
      NOW()
    ON CONFLICT (date, event_type) DO UPDATE SET count = EXCLUDED.count
  `).catch(() => {});

  // 9. tenant_audit_logs — compress + archive rows older than 7 days
  try {
    const { compressAuditLogs } = await import("../core/tenant/tenantVersioning");
    const compressed = await compressAuditLogs(7);
    results.tenant_audit_logs_compressed = compressed;
  } catch { results.tenant_audit_logs_compressed = 0; }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  logger.info({ ...results, total }, `Log rotation complete — purged ${total} rows`);
}

export function startLogRotationCron(): void {
  // Run daily at 03:00 AM
  cron.schedule("0 3 * * *", async () => {
    try { await runLogRotation(); }
    catch (e: any) { logger.error({ err: e.message }, "Log rotation error"); }
  });
  logger.info("Log rotation cron started — runs daily at 03:00");
}
