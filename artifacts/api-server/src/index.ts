import { initTracer } from "./observability/tracer";
await initTracer();

import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { startEmailCron } from "./cron/emailCron";
import { startMonitoringCron } from "./cron/monitoringCron";
import { startAgentCron } from "./cron/agentCron";
import { startLogRotationCron } from "./cron/logRotationCron";
import { registerAllListeners } from "./core/listeners/index";
import { ensureStripeBufferTables } from "./services/stripeEventBuffer";
import { ensureReconciliationTable, startReconciliationCron } from "./jobs/stripeReconcile";
import { initVapid } from "./lib/webPush";
import { loadHardeningState } from "./hardening/production.lock";
import { ensureERPTables } from "./modules/financial/erp-ledger";
import { ensureBankruptcyTables } from "./modules/bankruptcy/bankruptcy";
import { ensureBankruptcyV2Tables } from "./modules/bankruptcy/bankruptcyV2";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

/** Ensure ad-hoc columns added outside the Drizzle schema always exist at boot */
async function ensureAdHocColumns() {
  try {
    await db.execute(sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS source       TEXT DEFAULT 'manual'`);
    await db.execute(sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS store_order_id TEXT`);
    await db.execute(sql`ALTER TABLE cases ADD COLUMN IF NOT EXISTS created_by    TEXT`);
    await db.execute(sql`ALTER TABLE office_orders ADD COLUMN IF NOT EXISTS auto_case_id TEXT`);
    await db.execute(sql`ALTER TABLE office_orders ADD COLUMN IF NOT EXISTS portal_token TEXT`);

    /* Auto-generate slugs for any office_page rows that have none.
       Pattern: lower-cased name with spaces→dashes + short id suffix */
    await db.execute(sql`
      UPDATE office_page
      SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z\u0600-\u06FF0-9 ]', '', 'g'), '\s+', '-', 'g'))
                 || '-' || SUBSTRING(id::text, 1, 8)
      WHERE (slug IS NULL OR slug = '')
        AND name IS NOT NULL AND name <> ''
    `);
  } catch (e: any) {
    logger.warn({ err: e.message }, "ensureAdHocColumns: non-fatal migration warning");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// ─── Initialize Stripe (migrations → sync → webhook) ───
async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) { logger.warn("DATABASE_URL missing — skipping Stripe init"); return; }
  try {
    await runMigrations({ databaseUrl, schema: "stripe" } as any);
    const stripeSync = await getStripeSync();
    const webhookBase = `https://${(process.env.REPLIT_DOMAINS ?? "").split(",")[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBase}/api/stripe/webhook`);
    stripeSync.syncBackfill().catch(e => logger.error({ e }, "Stripe backfill error"));
    logger.info("Stripe initialized");
  } catch (err) {
    logger.error({ err }, "Stripe init failed — continuing without Stripe");
  }
}

ensureAdHocColumns().catch(e => logger.error({ e }, "ensureAdHocColumns failed"));
ensureStripeBufferTables().catch(e => logger.error({ e }, "ensureStripeBufferTables failed"));
ensureReconciliationTable().catch(e => logger.error({ e }, "ensureReconciliationTable failed"));
ensureERPTables().catch(e => logger.error({ e }, "ensureERPTables failed"));
ensureBankruptcyTables().catch(e => logger.error({ e }, "ensureBankruptcyTables failed"));
ensureBankruptcyV2Tables().catch(e => logger.error({ e }, "ensureBankruptcyV2Tables failed"));
initStripe();
startEmailCron();
startMonitoringCron();
startAgentCron();
startReconciliationCron();
startLogRotationCron();
registerAllListeners();
initVapid().catch(e => console.error("[WebPush] init error:", e));
loadHardeningState().catch(() => {});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

/** Performance indexes — run once at startup, idempotent */
async function ensurePerformanceIndexes() {
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_cases_office_id       ON cases(office_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status          ON cases(status)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_office_status   ON cases(office_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_office_id     ON clients(office_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_office_id   ON documents(office_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_office_due      ON tasks(office_id, due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status          ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_office_due  ON reminders(office_id, due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_logs_office_ts  ON audit_logs(office_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_revenues_office_date  ON revenues(date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_office_date  ON expenses(date DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_office_id    ON client_invoices(office_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status       ON client_invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_contracts_office_id   ON contracts(office_id)`,
    /* Idempotency index — prevents duplicate ledger entries for same Stripe event */
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_office_ledger_stripe_event_id
       ON office_ledger(stripe_event_id)
       WHERE stripe_event_id IS NOT NULL`,
  ];
  for (const idx of indexes) {
    await db.execute(sql.raw(idx)).catch(() => {});
  }
}
ensurePerformanceIndexes().catch(() => {});
