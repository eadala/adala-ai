import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { getUncachableStripeClient } from "../stripeClient";

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

/* ══════════════════════════════════════════════════
   STRIPE CONNECT — account management
══════════════════════════════════════════════════ */

/* GET  /api/payments/connect/status */
router.get("/payments/connect/status", async (req, res) => {
  try {
    const officeId = (req as any).headers["x-office-id"] ?? "default";
    const account = await one(sql`SELECT * FROM office_stripe_accounts WHERE office_id = ${officeId} LIMIT 1`);
    if (!account) return res.json({ connected: false });

    /* Re-check with Stripe for live status */
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
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      business_type: "individual",
      settings: { payouts: { schedule: { interval: "manual" } } },
    });

    /* Upsert record */
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
   PAYMENT INTENTS
══════════════════════════════════════════════════ */

/* POST /api/payments/intent */
router.post("/payments/intent", async (req, res) => {
  try {
    const {
      amountSAR,          // Amount in SAR (e.g. 1000)
      description = "دفع خدمة قانونية",
      clientName,
      invoiceId,
      caseId,
      connectAccountId,   // Stripe Connect account of the law office
      officeId = "default",
      commissionPercent,
    } = req.body;

    if (!amountSAR || amountSAR <= 0) return res.status(400).json({ error: "المبلغ مطلوب" });

    const stripe = await getUncachableStripeClient();

    /* Determine commission */
    let commission = commissionPercent ?? 10;
    if (!commissionPercent) {
      const acc = await one(sql`SELECT commission_percent FROM office_stripe_accounts WHERE office_id=${officeId} LIMIT 1`);
      if (acc) commission = acc.commission_percent;
    }

    const amountHalalas = Math.round(amountSAR * 100); // SAR → halalas
    const platformFeeHalalas = Math.floor(amountHalalas * (commission / 100));
    const netHalalas = amountHalalas - platformFeeHalalas;

    const intentParams: any = {
      amount: amountHalalas,
      currency: "sar",
      description,
      metadata: { officeId, invoiceId: invoiceId ?? "", caseId: caseId ?? "", clientName: clientName ?? "" },
    };

    if (connectAccountId) {
      intentParams.application_fee_amount = platformFeeHalalas;
      intentParams.transfer_data = { destination: connectAccountId };
    }

    const intent = await stripe.paymentIntents.create(intentParams);

    /* Save transaction record */
    await db.execute(sql`
      INSERT INTO payment_transactions
        (office_id, client_name, description, amount, platform_fee, net_amount,
         stripe_payment_intent_id, status, invoice_id, case_id)
      VALUES
        (${officeId}, ${clientName ?? null}, ${description}, ${amountSAR},
         ${platformFeeHalalas / 100}, ${netHalalas / 100},
         ${intent.id}, 'pending', ${invoiceId ?? null}, ${caseId ?? null})
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
   TRANSACTIONS
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

/* DELETE /api/payments/transactions/:id */
router.delete("/payments/transactions/:id", async (req, res) => {
  try {
    await db.execute(sql`DELETE FROM payment_transactions WHERE id=${req.params.id}::uuid`);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════ */
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

    /* Monthly chart data — last 6 months */
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

export default router;
