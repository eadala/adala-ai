import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";
import crypto from "crypto";
import { eventBus } from "../core/eventBus";

const router = Router();

/* ── helpers ─────────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try {
    const r = await db.execute(q) as any;
    return Array.isArray(r) ? r : (r?.rows ?? []);
  } catch { return []; }
}
async function one(q: any): Promise<any | null> {
  const r = await rows(q);
  return r[0] ?? null;
}

const BASE_DOMAIN = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://adala-ai.app";

/* ── auto-migrate ─────────────────────────────────── */
async function ensurePaymentCols() {
  await db.execute(sql`
    ALTER TABLE payment_transactions
      ADD COLUMN IF NOT EXISTS settlement_status TEXT DEFAULT 'unsettled',
      ADD COLUMN IF NOT EXISTS settled_at        TIMESTAMP,
      ADD COLUMN IF NOT EXISTS settlement_ref    TEXT,
      ADD COLUMN IF NOT EXISTS gateway           TEXT DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_link      TEXT
  `).catch(() => {});

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
  `).catch(() => {});

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
  `).catch(() => {});
}
ensurePaymentCols();

/* ══════════════════════════════════════════════════
   STRIPE CONNECT — account management
══════════════════════════════════════════════════ */

/* GET  /api/payments/connect/status */
router.get("/payments/connect/status", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
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
      } catch { /* fall through */ }
    }

    return res.json({
      connected: !!account.stripe_account_id,
      onboardingCompleted: account.onboarding_completed,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      commissionPercent: account.commission_percent,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/connect/create */
router.post("/payments/connect/create", async (req, res) => {
  try {
    const { officeId = "default", email, commissionPercent = 10 } = req.body;
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
router.post("/payments/connect/onboarding", async (req, res) => {
  try {
    const { stripeAccountId } = req.body;
    if (!stripeAccountId) return res.status(400).json({ error: "معرّف الحساب مطلوب" });

    const stripe = await getUncachableStripeClient();
    const basePath = process.env.BASE_URL ?? BASE_DOMAIN;
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
router.post("/payments/connect/login-link", async (req, res) => {
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
router.post("/payments/intent", async (req, res) => {
  try {
    const {
      amountSAR, description = "دفع خدمة قانونية",
      clientName, invoiceId, caseId,
      connectAccountId, officeId = "default", commissionPercent,
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
router.get("/payments/transactions", async (_req, res) => {
  try {
    const txs = await rows(sql`
      SELECT * FROM payment_transactions ORDER BY created_at DESC LIMIT 200
    `);
    res.json(txs);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/transactions — manual record */
router.post("/payments/transactions", async (req, res) => {
  try {
    const {
      officeId = "default", clientName, description, amount,
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
      }).catch(() => {});
    }

    res.json(result[0]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/payments/transactions/:id/status */
router.patch("/payments/transactions/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    await db.execute(sql`
      UPDATE payment_transactions SET status=${status}, updated_at=NOW() WHERE id=${req.params.id}::uuid
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/payments/transactions/:id/settle — mark transaction settled */
router.patch("/payments/transactions/:id/settle", async (req, res) => {
  try {
    const { settlementRef = "" } = req.body;
    await db.execute(sql`
      UPDATE payment_transactions
      SET settlement_status = 'settled',
          settled_at = NOW(),
          settlement_ref = ${settlementRef || null},
          updated_at = NOW()
      WHERE id = ${req.params.id}::uuid
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/payments/batch-settle — settle all completed unsettled */
router.post("/payments/batch-settle", async (req, res) => {
  try {
    const { officeId = "default", settlementRef = "" } = req.body;
    const result = await rows(sql`
      UPDATE payment_transactions
      SET settlement_status = 'settled',
          settled_at = NOW(),
          settlement_ref = ${settlementRef || null},
          updated_at = NOW()
      WHERE office_id = ${officeId}
        AND status = 'completed'
        AND (settlement_status IS NULL OR settlement_status = 'unsettled')
      RETURNING id
    `);
    res.json({ settled: result.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/payments/transactions/:id */
router.delete("/payments/transactions/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM payment_transactions WHERE id=${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   WALLET — settlement breakdown
══════════════════════════════════════════════════ */
router.get("/payments/wallet", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";

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
router.get("/payments/stats", async (_req, res) => {
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
router.get("/payments/moyasar/settings", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
    const s = await one(sql`SELECT * FROM moyasar_settings WHERE office_id=${officeId} LIMIT 1`);
    if (!s) return res.json({ enabled: false, testMode: true });
    res.json({
      enabled:        s.enabled,
      testMode:       s.test_mode,
      publishableKey: s.publishable_key,
      secretKey:      s.secret_key ? "••••••••" + s.secret_key.slice(-4) : "",
      webhookSecret:  s.webhook_secret ? "••••" : "",
      callbackUrl:    s.callback_url ?? `${BASE_DOMAIN}/api/webhook/moyasar`,
      webhookUrl:     `${BASE_DOMAIN}/api/webhook/moyasar`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/payments/moyasar/settings */
router.put("/payments/moyasar/settings", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
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
            callback_url     = ${`${BASE_DOMAIN}/api/webhook/moyasar`},
            updated_at       = NOW()
        WHERE office_id = ${officeId}
      `);
    } else {
      await db.execute(sql`
        INSERT INTO moyasar_settings (office_id, publishable_key, secret_key, webhook_secret, test_mode, enabled, callback_url)
        VALUES (${officeId}, ${publishableKey ?? null}, ${secretKey ?? null}, ${webhookSecret ?? null},
                ${testMode}, ${enabled}, ${`${BASE_DOMAIN}/api/webhook/moyasar`})
      `);
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   PAYMENT LINK GENERATOR
══════════════════════════════════════════════════ */

/* POST /api/payments/payment-link — generate a Moyasar payment page link */
router.post("/payments/payment-link", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
    const {
      amountSAR, description = "خدمة قانونية", clientName, clientEmail,
      clientPhone, invoiceId, caseId, commissionPercent = 10,
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
    const callbackUrl = `${BASE_DOMAIN}/api/webhook/moyasar/callback?tx=${tx?.id ?? ""}`;
    const successUrl  = `${BASE_DOMAIN}/api/payments/moyasar/success?tx=${tx?.id ?? ""}`;

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
      manualLink: `${BASE_DOMAIN}/pay/${tx?.id ?? ""}`,
      configured: !!pubKey,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/payments/moyasar/success — Moyasar redirect back */
router.get("/payments/moyasar/success", async (req, res) => {
  try {
    const { tx, id: moyasarId, status: mStatus } = req.query as any;
    if (tx) {
      const finalStatus = mStatus === "paid" ? "completed" : "pending";
      await db.execute(sql`
        UPDATE payment_transactions
        SET status=${finalStatus}, gateway_payment_id=COALESCE(gateway_payment_id, ${moyasarId ?? null}), updated_at=NOW()
        WHERE id=${tx}::uuid
      `).catch(() => {});
    }
    res.redirect(`${BASE_DOMAIN}/payment-center?gateway=moyasar&result=${mStatus ?? "unknown"}`);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   CHECKOUT.COM SETTINGS
══════════════════════════════════════════════════ */

/* GET /api/payments/checkout/settings */
router.get("/payments/checkout/settings", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
    const s = await one(sql`SELECT * FROM checkout_settings WHERE office_id=${officeId} LIMIT 1`);
    if (!s) return res.json({ enabled: false, testMode: true });
    res.json({
      enabled:       s.enabled,
      testMode:      s.test_mode,
      publicKey:     s.public_key ?? "",
      secretKey:     s.secret_key ? "••••••••" + s.secret_key.slice(-4) : "",
      webhookSecret: s.webhook_secret ? "••••" : "",
      webhookUrl:    `${BASE_DOMAIN}/api/webhook/checkout`,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/payments/checkout/settings */
router.put("/payments/checkout/settings", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
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
router.post("/payments/checkout/create-payment", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
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

    const successUrl = `${BASE_DOMAIN}/api/payments/checkout/success?tx=${tx?.id ?? ""}&status=captured`;
    const failureUrl = `${BASE_DOMAIN}/api/payments/checkout/success?tx=${tx?.id ?? ""}&status=failed`;

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
      const r = await fetch("https://api.checkout.com/payment-links", {
        method: "POST",
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(x => x.json()).catch(() => ({}));
      checkoutUrl = (r as any)._links?.redirect?.href ?? null;
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
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/payments/checkout/success — Checkout.com redirect back */
router.get("/payments/checkout/success", async (req, res) => {
  try {
    const { tx, status: cStatus } = req.query as any;
    if (tx) {
      const finalStatus = cStatus === "captured" ? "completed" : "failed";
      await db.execute(sql`
        UPDATE payment_transactions
        SET status=${finalStatus}, updated_at=NOW()
        WHERE id=${tx}::uuid
      `).catch(() => {});
    }
    res.redirect(`${BASE_DOMAIN}/payment-center?gateway=checkout&result=${cStatus ?? "unknown"}`);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/webhook/checkout — Checkout.com webhook */
router.post("/webhook/checkout", async (req, res) => {
  try {
    const event = req.body;
    const type  = event?.type ?? "";
    const ref   = event?.data?.reference ?? event?.data?.metadata?.tx_id ?? "";
    if (type === "payment_captured" || type === "payment_approved") {
      await db.execute(sql`
        UPDATE payment_transactions
        SET status='completed', gateway_payment_id=${event?.data?.id ?? null}, updated_at=NOW()
        WHERE gateway_payment_id=${ref} OR id=${ref}::uuid
      `).catch(() => {});
    } else if (type === "payment_declined" || type === "payment_expired") {
      await db.execute(sql`
        UPDATE payment_transactions SET status='failed', updated_at=NOW()
        WHERE gateway_payment_id=${ref} OR id=${ref}::uuid
      `).catch(() => {});
    }
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
