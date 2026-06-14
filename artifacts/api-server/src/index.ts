import app from "./app";
import { logger } from "./lib/logger";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { startEmailCron } from "./cron/emailCron";
import { registerAllListeners } from "./core/listeners/index";
import { initVapid } from "./lib/webPush";
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
initStripe();
startEmailCron();
registerAllListeners();
initVapid().catch(e => console.error("[WebPush] init error:", e));

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
