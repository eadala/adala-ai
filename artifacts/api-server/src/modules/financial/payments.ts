import { requireAuthWithTenant } from "../../middlewares/requireAuth";
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../../stripeClient";
import { requireProductionBaseUrl } from "../../lib/productionUrl";
import { logEndpointError } from "../../lib/endpointErrorLog";
import { logger } from "../../lib/logger";
import { logPaymentSideEffectFailure, paymentDbRows } from "../../lib/paymentDb";
import crypto from "crypto";
import { eventBus } from "../../core/eventBus";

/* Legacy payment router — Batch 1 only removes error-swallowing; full retype is out of scope. */
/* eslint-disable @typescript-eslint/no-explicit-any */

const router = Router();

/* ── helpers ─────────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  return paymentDbRows((qq) => db.execute(qq as any), q);
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

function getBaseDomain(): string {
  return process.env.BASE_URL?.trim()
    ? process.env.BASE_URL.trim().replace(/\/+$/, "")
    : requireProductionBaseUrl();
}

function logEnsureFailure(step: string, err: unknown): void {
  logger.error({ err }, `[payments] ensureGatewaySettingsTables failed: ${step}`);
}

/* Gateway settings tables remain Runtime DDL until a future Schema Authority batch.
   payment_transactions schema is owned by:
   artifacts/api-server/migrations/012_payment_transactions.sql */
async function ensureGatewaySettingsTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS moyasar_settings (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id         TEXT NOT NULL DEFAULT 'default',
      publishable_key   TEXT,
      secret_key        TEXT,
      webhook_secret    TEXT,
      test_mode         BOOLEAN DEFAULT true,
      enabled           BOOLEAN DEFAULT false,
      callback_url      TEXT,
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW(),
      UNIQUE(office_id)
    )
  `).catch((err) => logEnsureFailure("moyasar_settings table", err));

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS checkout_settings (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id         TEXT NOT NULL DEFAULT 'default',
      secret_key        TEXT,
      public_key        TEXT,
      webhook_secret    TEXT,
      test_mode         BOOLEAN DEFAULT true,
      enabled           BOOLEAN DEFAULT false,
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW(),
      UNIQUE(office_id)
    )
  `).catch((err) => logEnsureFailure("checkout_settings table", err));
}
ensureGatewaySettingsTables();

/* ══════════════════════════════════════════════════
   STRIPE CONNECT — account management
══════════════════════════════════════════════════ */

/* GET  /api/payments/connect/status */
router.get("/payments/connect/status", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const account = await one(sql`SELECT * FROM office_stripe_accounts WHERE office_id = ${officeId} LIMIT 1`);
    if (!account) return res.json({ connected: false });

    if (account.stripe_account_id) {
      try {
        const stripe = await getUncachableStripeClient();
        const sa = await stripe.accounts.retrieve(account.stripe_account_id);
        await db.execute(sql`
          UPDATE office_stripe_accounts
          SET charges_enabled   = ${sa.charges_enabled},
              payouts_enabled   = ${sa.payouts_enabled},
              onboarding_completed = ${sa.details_submitted},
              updated_at = NOW()
          WHERE id = ${account.id}::uuid
        `);
        return res.json({
          connected: true,
          stripeAccountId: sa.id,
          onboardingCompleted: sa.details_submitted,
          chargesEnabled: sa.charges_enabled,
          payoutsEnabled: sa.payouts_enabled,
          commissionPercent: account.commission_percent,
        });
      } catch (err) {
        logger.warn(
          { err, officeId, stripeAccountId: account.stripe_account_id },
          "[payments] Stripe account retrieve failed; returning cached connect status",
        );
      }
    }

    return res.json({
      connected: !!account.stripe_account_id,
      onboardingCompleted: account.onboarding_completed,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      commissionPercent: account.commission_percent,
    });
  } catch (e: any) {
    logEndpointError("GET /api/payments/connect/status", req, e);
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/payments/connect/create */
router.post("/payments/connect/create", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const { email, commissionPercent = 10 } = req.body;
    if (!email) return res.status(400).json({ error: "البريد الإلكتروني مطلوب" });

    const stripe = await getUncachableStripeClient();
    const account = await stripe.accounts.create({
      type: "express",
      email,
      country: "SA",
      capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
      business_type: "individual",
      settings: { payouts: { schedule: { interval: "manual" } } },
    });

    const existing = await one(sql`SELECT id FROM office_stripe_accounts WHERE office_id = ${officeId} LIMIT 1`);
    if (existing) {
      await db.execute(sql`
        UPDATE office_stripe_accounts
        SET stripe_account_id=${account.id}, account_email=${email}, commission_percent=${commissionPercent}, updated_at=NOW()
        WHERE office_id=${officeId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO office_stripe_accounts (office_id, stripe_account_id, account_email, commission_percent)
        VALUES (${officeId}, ${account.id}, ${email}, ${commissionPercent})
      `);
    }

    res.json({ stripeAccountId: account.id, created: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/connect/onboarding */
router.post("/payments/connect/onboarding", requireAuthWithTenant, async (req, res) => {
  try {
    const { stripeAccountId } = req.body;
    if (!stripeAccountId) return res.status(400).json({ error: "معرّف الحساب مطلوب" });

    const stripe = await getUncachableStripeClient();
    const basePath = getBaseDomain();
    const link = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${basePath}/payment-center?onboarding=refresh`,
      return_url:  `${basePath}/payment-center?onboarding=complete`,
      type: "account_onboarding",
    });

    res.json({ url: link.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/connect/login-link */
router.post("/payments/connect/login-link", requireAuthWithTenant, async (req, res) => {
  try {
    const { stripeAccountId } = req.body;
    if (!stripeAccountId) return res.status(400).json({ error: "معرّف الحساب مطلوب" });
    const stripe = await getUncachableStripeClient();
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
    res.json({ url: loginLink.url });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   PAYMENT INTENTS (Stripe)
══════════════════════════════════════════════════ */
router.post("/payments/intent", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const {
      amountSAR, description = "دفع خدمة قانونية",
      clientName, invoiceId, caseId,
      connectAccountId, commissionPercent,
    } = req.body;

    if (!amountSAR || amountSAR <= 0) return res.status(400).json({ error: "المبلغ مطلوب" });

    const stripe = await getUncachableStripeClient();

    let commission = commissionPercent ?? 10;
    if (!commissionPercent) {
      const acc = await one(sql`SELECT commission_percent FROM office_stripe_accounts WHERE office_id=${officeId} LIMIT 1`);
      if (acc) commission = acc.commission_percent;
    }

    const amountHalalas = Math.round(amountSAR * 100);
    const platformFeeHalalas = Math.floor(amountHalalas * (commission / 100));
    const netHalalas = amountHalalas - platformFeeHalalas;

    const intentParams: any = {
      amount: amountHalalas, currency: "sar", description,
      metadata: { officeId, invoiceId: invoiceId ?? "", caseId: caseId ?? "", clientName: clientName ?? "" },
    };

    if (connectAccountId) {
      intentParams.application_fee_amount = platformFeeHalalas;
      intentParams.transfer_data = { destination: connectAccountId };
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    await db.execute(sql`
      INSERT INTO payment_transactions
        (office_id, client_name, description, amount, platform_fee, net_amount,
         stripe_payment_intent_id, status, invoice_id, case_id, gateway)
      VALUES
        (${officeId}, ${clientName ?? null}, ${description}, ${amountSAR},
         ${platformFeeHalalas / 100}, ${netHalalas / 100},
         ${intent.id}, 'pending', ${invoiceId ?? null}, ${caseId ?? null}, 'stripe')
    `);

    res.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: amountSAR,
      platformFee: platformFeeHalalas / 100,
      netAmount: netHalalas / 100,
      commissionPercent: commission,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   TRANSACTIONS CRUD
══════════════════════════════════════════════════ */

/* GET /api/payments/transactions */
router.get("/payments/transactions", requireAuthWithTenant, async (_req, res) => {
  try {
    const txs = await rows(sql`
      SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 200
    `);
    res.json(txs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/transactions — manual record */
router.post("/payments/transactions", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId as string;
    if (!officeId) return res.status(403).json({ error: "لا يمكن تحديد المكتب" });
    const {
      clientName, description, amount,
      status = "completed", paymentMethod = "bank_transfer",
      invoiceId, caseId, commissionPercent = 10,
    } = req.body;

    if (!amount || !description) return res.status(400).json({ error: "المبلغ والوصف مطلوبان" });

    const platformFee = parseFloat((amount * commissionPercent / 100).toFixed(2));
    const netAmount   = parseFloat((amount - platformFee).toFixed(2));

    const result = await rows(sql`
      INSERT INTO payment_transactions
        (office_id, client_name, description, amount, platform_fee, net_amount,
         status, payment_method, invoice_id, case_id)
      VALUES
        (${officeId}, ${clientName ?? null}, ${description}, ${amount}, ${platformFee},
         ${netAmount}, ${status}, ${paymentMethod}, ${invoiceId ?? null}, ${caseId ?? null})
      RETURNING *
    `);

    if (status === "completed") {
      eventBus.emit({
        type: "PAYMENT_SUCCESS",
        officeId,
        data: { amount, clientName, description, invoiceId, caseId, gateway: paymentMethod, platformFee, netAmount },
      }).catch((err) => {
        logPaymentSideEffectFailure("PAYMENT_SUCCESS event emit failed", err, { officeId });
      });
    }

    if (!result[0]) {
      logEndpointError("POST /api/payments/transactions", req, new Error("INSERT RETURNING empty"));
      return res.status(500).json({ error: "فشل تسجيل الدفعة" });
    }

    res.json(result[0]);
  } catch (e: any) {
    logEndpointError("POST /api/payments/transactions", req, e);
    res.status(500).json({ error: e.message });
  }
});

/* PATCH /api/payments/transactions/:id/status */
router.patch("/payments/transactions/:id/status", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { status } = req.body;
    await db.execute(sql`
      UPDATE payment_transactions SET status=${status}, updated_at=NOW()
      WHERE id=${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/payments/transactions/:id/settle — mark transaction settled */
router.patch("/payments/transactions/:id/settle", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { settlementRef = "" } = req.body;
    await db.execute(sql`
      UPDATE payment_transactions
      SET settlement_status = 'settled',
          settled_at = NOW(),
          settlement_ref = ${settlementRef || null},
          updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/batch-settle — settle all completed unsettled */
router.post("/payments/batch-settle", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { settlementRef = "" } = req.body;
    const result = await rows(sql`
      UPDATE payment_transactions
      SET settlement_status = 'settled',
          settled_at = NOW(),
          settlement_ref = ${settlementRef || null},
          updated_at = NOW()
      WHERE office_id = ${tenantId}
        AND status = 'completed'
        AND (settlement_status IS NULL OR settlement_status = 'unsettled')
      RETURNING id
    `);
    res.json({ settled: result.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/payments/transactions/:id */
router.delete("/payments/transactions/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    await db.execute(sql`
      DELETE FROM payment_transactions
      WHERE id=${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   WALLET — settlement breakdown
══════════════════════════════════════════════════ */
router.get("/payments/wallet", requireAuthWithTenant, async (req, res) => {
  try {
    const totals = await one(sql`
      SELECT
        COUNT(*)::int                                                                        AS total_transactions,
        COALESCE(SUM(amount),0)::numeric                                                    AS total_amount,
        COALESCE(SUM(platform_fee),0)::numeric                                              AS total_commission,
        COALESCE(SUM(net_amount),0)::numeric                                                AS total_net,
        COALESCE(SUM(CASE WHEN status='pending'   THEN amount   ELSE 0 END),0)::numeric    AS pending_amount,
        COALESCE(SUM(CASE WHEN status='completed' THEN amount   ELSE 0 END),0)::numeric    AS completed_amount,
        COALESCE(SUM(CASE WHEN status='completed' AND (settlement_status='settled')
                          THEN net_amount ELSE 0 END),0)::numeric                          AS settled_net,
        COALESCE(SUM(CASE WHEN status='completed' AND (settlement_status IS NULL OR settlement_status='unsettled')
                          THEN net_amount ELSE 0 END),0)::numeric                          AS unsettled_net,
        COUNT(CASE WHEN status='completed' AND (settlement_status IS NULL OR settlement_status='unsettled')
                   THEN 1 END)::int                                                        AS unsettled_count
      FROM payment_transactions
    `);

    const monthly = await rows(sql`
      SELECT
        TO_CHAR(created_at,'YYYY-MM') AS month,
        COALESCE(SUM(amount),0)::numeric      AS total,
        COALESCE(SUM(platform_fee),0)::numeric AS commission,
        COALESCE(SUM(net_amount),0)::numeric  AS net
      FROM payment_transactions
      WHERE created_at >= NOW() - INTERVAL '6 months'
        AND status = 'completed'
      GROUP BY month ORDER BY month
    `);

    /* Gateway breakdown */
    const byGateway = await rows(sql`
      SELECT
        COALESCE(gateway,'manual') AS gateway,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount),0)::numeric AS total
      FROM payment_transactions
      WHERE status = 'completed'
      GROUP BY gateway
    `);

    res.json({
      totalTransactions: totals?.total_transactions ?? 0,
      totalAmount:     parseFloat(totals?.total_amount ?? 0),
      totalCommission: parseFloat(totals?.total_commission ?? 0),
      totalNet:        parseFloat(totals?.total_net ?? 0),
      pendingAmount:   parseFloat(totals?.pending_amount ?? 0),
      completedAmount: parseFloat(totals?.completed_amount ?? 0),
      settledNet:      parseFloat(totals?.settled_net ?? 0),
      unsettledNet:    parseFloat(totals?.unsettled_net ?? 0),
      unsettledCount:  totals?.unsettled_count ?? 0,
      monthly: monthly.map((m: any) => ({
        month: m.month,
        total: parseFloat(m.total),
        commission: parseFloat(m.commission),
        net: parseFloat(m.net),
      })),
      byGateway: byGateway.map((g: any) => ({
        gateway: g.gateway,
        count: g.count,
        total: parseFloat(g.total),
      })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* backwards compat */
router.get("/payments/stats", requireAuthWithTenant, async (_req, res) => {
  try {
    const totals = await one(sql`
      SELECT
        COUNT(*)::int                                 AS total_transactions,
        COALESCE(SUM(amount),0)::numeric              AS total_amount,
        COALESCE(SUM(platform_fee),0)::numeric        AS total_commission,
        COALESCE(SUM(net_amount),0)::numeric          AS total_net,
        COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0)::numeric AS pending_amount,
        COALESCE(SUM(CASE WHEN status='completed' THEN amount ELSE 0 END),0)::numeric AS completed_amount
      FROM payment_transactions
    `);

    const monthly = await rows(sql`
      SELECT
        TO_CHAR(created_at,'YYYY-MM') AS month,
        COALESCE(SUM(amount),0)::numeric AS total,
        COALESCE(SUM(platform_fee),0)::numeric AS commission,
        COALESCE(SUM(net_amount),0)::numeric AS net
      FROM payment_transactions
      WHERE created_at >= NOW() - INTERVAL '6 months'
        AND status = 'completed'
      GROUP BY month ORDER BY month
    `);

    res.json({
      totalTransactions: totals?.total_transactions ?? 0,
      totalAmount:     parseFloat(totals?.total_amount ?? 0),
      totalCommission: parseFloat(totals?.total_commission ?? 0),
      totalNet:        parseFloat(totals?.total_net ?? 0),
      pendingAmount:   parseFloat(totals?.pending_amount ?? 0),
      completedAmount: parseFloat(totals?.completed_amount ?? 0),
      monthly: monthly.map((m: any) => ({
        month: m.month,
        total: parseFloat(m.total),
        commission: parseFloat(m.commission),
        net: parseFloat(m.net),
      })),
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   MOYASAR SETTINGS
══════════════════════════════════════════════════ */

/* GET /api/payments/moyasar/settings */
router.get("/payments/moyasar/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const s = await one(sql`SELECT * FROM moyasar_settings WHERE office_id=${officeId} LIMIT 1`);
    if (!s) return res.json({ enabled: false, testMode: true });
    res.json({
      enabled:        s.enabled,
      testMode:       s.test_mode,
      publishableKey: s.publishable_key,
      secretKey:      s.secret_key ? "••••••••" + s.secret_key.slice(-4) : "",
      webhookSecret:  s.webhook_secret ? "••••" : "",
      callbackUrl:    s.callback_url ?? `${getBaseDomain()}/api/webhook/moyasar`,
      webhookUrl:     `${getBaseDomain()}/api/webhook/moyasar`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/payments/moyasar/settings */
router.put("/payments/moyasar/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const { publishableKey, secretKey, webhookSecret, testMode = true, enabled = false } = req.body;

    const existing = await one(sql`SELECT id FROM moyasar_settings WHERE office_id=${officeId} LIMIT 1`);
    if (existing) {
      await db.execute(sql`
        UPDATE moyasar_settings
        SET publishable_key  = COALESCE(NULLIF(${publishableKey ?? ""},''), publishable_key),
            secret_key       = COALESCE(NULLIF(${secretKey ?? ""},''), secret_key),
            webhook_secret   = COALESCE(NULLIF(${webhookSecret ?? ""},''), webhook_secret),
            test_mode        = ${testMode},
            enabled          = ${enabled},
            callback_url     = ${`${getBaseDomain()}/api/webhook/moyasar`},
            updated_at       = NOW()
        WHERE office_id = ${officeId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO moyasar_settings (office_id, publishable_key, secret_key, webhook_secret, test_mode, enabled, callback_url)
        VALUES (${officeId}, ${publishableKey ?? null}, ${secretKey ?? null}, ${webhookSecret ?? null},
                ${testMode}, ${enabled}, ${`${getBaseDomain()}/api/webhook/moyasar`})
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   PAYMENT LINK GENERATOR
══════════════════════════════════════════════════ */

/* POST /api/payments/payment-link — generate a Moyasar payment page link */
router.post("/payments/payment-link", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const {
      amountSAR, description = "خدمة قانونية", clientName, clientEmail: _clientEmail,
      clientPhone: _clientPhone, invoiceId, caseId, commissionPercent = 10,
    } = req.body;

    if (!amountSAR || amountSAR <= 0) return res.status(400).json({ error: "المبلغ مطلوب" });

    const settings = await one(sql`SELECT * FROM moyasar_settings WHERE office_id=${officeId} LIMIT 1`);

    const platformFee = parseFloat((amountSAR * commissionPercent / 100).toFixed(2));
    const netAmount   = parseFloat((amountSAR - platformFee).toFixed(2));
    const txRef       = `ADALA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    /* Save pending transaction */
    const [tx] = await rows(sql`
      INSERT INTO payment_transactions
        (office_id, client_name, description, amount, platform_fee, net_amount,
         status, payment_method, invoice_id, case_id, gateway, gateway_payment_id)
      VALUES
        (${officeId}, ${clientName ?? null}, ${description}, ${amountSAR}, ${platformFee},
         ${netAmount}, 'pending', 'moyasar', ${invoiceId ?? null}, ${caseId ?? null}, 'moyasar', ${txRef})
      RETURNING *
    `);

    /* Build Moyasar hosted checkout URL */
    const pubKey = settings?.publishable_key ?? "";
    const callbackUrl = `${getBaseDomain()}/api/webhook/moyasar/callback?tx=${tx?.id ?? ""}`;
    const successUrl  = `${getBaseDomain()}/api/payments/moyasar/success?tx=${tx?.id ?? ""}`;

    const moyasarUrl = pubKey
      ? `https://checkout.moyasar.com/v1?publishable_api_key=${pubKey}&amount=${Math.round(amountSAR * 100)}&currency=SAR&description=${encodeURIComponent(description)}&callback_url=${encodeURIComponent(callbackUrl)}&success_url=${encodeURIComponent(successUrl)}&metadata[ref]=${txRef}`
      : null;

    res.json({
      transactionId: tx?.id,
      ref: txRef,
      amount: amountSAR,
      platformFee,
      netAmount,
      paymentUrl: moyasarUrl,
      manualLink: `${getBaseDomain()}/pay/${tx?.id ?? ""}`,
      configured: !!pubKey,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/payments/moyasar/success — Moyasar redirect back */
router.get("/payments/moyasar/success", requireAuthWithTenant, async (req, res) => {
  try {
    const { tx, id: moyasarId, status: mStatus } = req.query as any;
    if (tx) {
      const finalStatus = mStatus === "paid" ? "completed" : "pending";
      await db.execute(sql`
        UPDATE payment_transactions
        SET status=${finalStatus}, gateway_payment_id=COALESCE(gateway_payment_id, ${moyasarId ?? null}), updated_at=NOW()
        WHERE id=${tx}::uuid
      `);
    }
    res.redirect(`${getBaseDomain()}/payment-center?gateway=moyasar&result=${mStatus ?? "unknown"}`);
  } catch (e: any) {
    logEndpointError("GET /api/payments/moyasar/success", req, e);
    res.status(500).json({ error: e.message });
  }
});

/* ══════════════════════════════════════════════════
   CHECKOUT.COM SETTINGS
══════════════════════════════════════════════════ */

/* GET /api/payments/checkout/settings */
router.get("/payments/checkout/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const s = await one(sql`SELECT * FROM checkout_settings WHERE office_id=${officeId} LIMIT 1`);
    if (!s) return res.json({ enabled: false, testMode: true });
    res.json({
      enabled:       s.enabled,
      testMode:      s.test_mode,
      publicKey:     s.public_key ?? "",
      secretKey:     s.secret_key ? "••••••••" + s.secret_key.slice(-4) : "",
      webhookSecret: s.webhook_secret ? "••••" : "",
      webhookUrl:    `${getBaseDomain()}/api/webhook/checkout`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/payments/checkout/settings */
router.put("/payments/checkout/settings", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const { secretKey, publicKey, webhookSecret, testMode = true, enabled = false } = req.body;
    const existing = await one(sql`SELECT id FROM checkout_settings WHERE office_id=${officeId} LIMIT 1`);
    if (existing) {
      await db.execute(sql`
        UPDATE checkout_settings
        SET secret_key      = COALESCE(NULLIF(${secretKey ?? ""},''), secret_key),
            public_key      = COALESCE(NULLIF(${publicKey ?? ""},''), public_key),
            webhook_secret  = COALESCE(NULLIF(${webhookSecret ?? ""},''), webhook_secret),
            test_mode       = ${testMode},
            enabled         = ${enabled},
            updated_at      = NOW()
        WHERE office_id = ${officeId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO checkout_settings (office_id, secret_key, public_key, webhook_secret, test_mode, enabled)
        VALUES (${officeId}, ${secretKey ?? null}, ${publicKey ?? null}, ${webhookSecret ?? null}, ${testMode}, ${enabled})
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/checkout/create-payment */
router.post("/payments/checkout/create-payment", requireAuthWithTenant, async (req, res) => {
  try {
    const officeId = (req as any).tenantId;
    const { amountSAR, description = "خدمة قانونية", clientName, clientEmail, invoiceId, caseId, commissionPercent = 10 } = req.body;
    if (!amountSAR || amountSAR <= 0) return res.status(400).json({ error: "المبلغ مطلوب" });

    const settings = await one(sql`SELECT * FROM checkout_settings WHERE office_id=${officeId} LIMIT 1`);
    const secretKey = settings?.secret_key ?? process.env.CHECKOUT_SECRET_KEY ?? "";

    const platformFee = parseFloat((amountSAR * commissionPercent / 100).toFixed(2));
    const netAmount   = parseFloat((amountSAR - platformFee).toFixed(2));
    const txRef       = `CHK-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    const [tx] = await rows(sql`
      INSERT INTO payment_transactions
        (office_id, client_name, description, amount, platform_fee, net_amount,
         status, payment_method, invoice_id, case_id, gateway, gateway_payment_id)
      VALUES
        (${officeId}, ${clientName ?? null}, ${description}, ${amountSAR}, ${platformFee},
         ${netAmount}, 'pending', 'checkout', ${invoiceId ?? null}, ${caseId ?? null}, 'checkout', ${txRef})
      RETURNING *
    `);

    const successUrl = `${getBaseDomain()}/api/payments/checkout/success?tx=${tx?.id ?? ""}&status=captured`;
    const failureUrl = `${getBaseDomain()}/api/payments/checkout/success?tx=${tx?.id ?? ""}&status=failed`;

    let checkoutUrl: string | null = null;
    if (secretKey) {
      const payload = {
        amount: Math.round(amountSAR * 100),
        currency: "SAR",
        reference: txRef,
        description,
        customer: clientEmail ? { email: clientEmail, name: clientName } : undefined,
        success_url: successUrl,
        failure_url: failureUrl,
        metadata: { tx_id: tx?.id ?? "", office_id: officeId },
      };
      const response = await fetch("https://api.checkout.com/payment-links", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        throw new Error(`Checkout.com payment-links failed (${response.status}): ${bodyText.slice(0, 200)}`);
      }
      const r = (await response.json()) as { _links?: { redirect?: { href?: string } } };
      checkoutUrl = r._links?.redirect?.href ?? null;
      if (!checkoutUrl) {
        throw new Error("Checkout.com payment-links response missing redirect URL");
      }
    }

    res.json({
      transactionId: tx?.id,
      ref: txRef,
      amount: amountSAR,
      platformFee,
      netAmount,
      paymentUrl: checkoutUrl,
      configured: !!secretKey,
    });
  } catch (e: any) {
    logEndpointError("POST /api/payments/checkout/create-payment", req, e);
    res.status(500).json({ error: e.message });
  }
});

/* GET /api/payments/checkout/success — Checkout.com redirect back */
router.get("/payments/checkout/success", requireAuthWithTenant, async (req, res) => {
  try {
    const { tx, status: cStatus } = req.query as any;
    if (tx) {
      const finalStatus = cStatus === "captured" ? "completed" : "failed";
      await db.execute(sql`
        UPDATE payment_transactions
        SET status=${finalStatus}, updated_at=NOW()
        WHERE id=${tx}::uuid
      `);
    }
    res.redirect(`${getBaseDomain()}/payment-center?gateway=checkout&result=${cStatus ?? "unknown"}`);
  } catch (e: any) {
    logEndpointError("GET /api/payments/checkout/success", req, e);
    res.status(500).json({ error: e.message });
  }
});

/* POST /api/webhook/checkout — Checkout.com webhook */
router.post("/webhook/checkout", requireAuthWithTenant, async (req, res) => {
  try {
    const event = req.body;
    const type  = event?.type ?? "";
    const ref   = event?.data?.reference ?? event?.data?.metadata?.tx_id ?? "";
    if (type === "payment_captured" || type === "payment_approved") {
      await db.execute(sql`
        UPDATE payment_transactions
        SET status='completed', gateway_payment_id=${event?.data?.id ?? null}, updated_at=NOW()
        WHERE gateway_payment_id=${ref} OR id=${ref}::uuid
      `);
    } else if (type === "payment_declined" || type === "payment_expired") {
      await db.execute(sql`
        UPDATE payment_transactions SET status='failed', updated_at=NOW()
        WHERE gateway_payment_id=${ref} OR id=${ref}::uuid
      `);
    }
    res.json({ ok: true });
  } catch (e: any) {
    logEndpointError("POST /api/webhook/checkout", req, e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
