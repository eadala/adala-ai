import { requireAuth, requireAuthWithTenant } from "../../middlewares/requireAuth";
/**
 * Financial Core System — عدالة AI
 * Double-entry Ledger + Wallets + Payouts + Settlement Engine + Dashboard
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { PaymentService } from "../../payments/orchestrator";

const router = Router();

/* ── helpers ──────────────────────────────────── */
async function rows(q: any): Promise<any[]> {
  try { const r = await db.execute(q) as any; return Array.isArray(r) ? r : (r?.rows ?? []); }
  catch { return []; }
}
async function one(q: any): Promise<any | null> { return (await rows(q))[0] ?? null; }

/* ── Auto-migrate tables ──────────────────────── */
async function ensureFinancialCoreTables() {
  /* Financial Accounts — per entity (platform / office / lawyer) */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS financial_accounts (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id     TEXT NOT NULL,
      owner_type   TEXT NOT NULL DEFAULT 'office',  -- platform | office | lawyer | client
      label        TEXT,
      currency     TEXT NOT NULL DEFAULT 'SAR',
      balance      NUMERIC(14,2) NOT NULL DEFAULT 0,
      frozen_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_at   TIMESTAMP DEFAULT NOW(),
      updated_at   TIMESTAMP DEFAULT NOW(),
      UNIQUE(owner_id, currency)
    )
  `).catch(() => {});

  /* Double-Entry Ledger */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ledger_entries (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      transaction_ref TEXT,
      debit_account   TEXT NOT NULL,
      credit_account  TEXT NOT NULL,
      amount          NUMERIC(14,2) NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'SAR',
      description     TEXT,
      entry_type      TEXT DEFAULT 'payment',  -- payment | refund | fee | payout | adjustment
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  /* Wallets — available + pending per user/office */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS wallets (
      id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id          TEXT NOT NULL UNIQUE,
      owner_label       TEXT,
      available_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
      pending_balance   NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_earned      NUMERIC(14,2) NOT NULL DEFAULT 0,
      total_withdrawn   NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency          TEXT NOT NULL DEFAULT 'SAR',
      created_at        TIMESTAMP DEFAULT NOW(),
      updated_at        TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  /* Payouts — lawyer/office payouts */
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS lawyer_payouts (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      office_id       TEXT NOT NULL,
      owner_label     TEXT,
      amount          NUMERIC(14,2) NOT NULL,
      platform_fee    NUMERIC(14,2) NOT NULL DEFAULT 0,
      net_amount      NUMERIC(14,2) NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',  -- pending | processing | sent | failed
      bank_reference  TEXT,
      provider        TEXT DEFAULT 'manual',
      transaction_ids TEXT[],
      notes           TEXT,
      processed_at    TIMESTAMP,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});

  /* Ensure platform wallet exists */
  await db.execute(sql`
    INSERT INTO wallets (owner_id, owner_label, currency)
    VALUES ('platform', 'عدالة AI — المنصة', 'SAR')
    ON CONFLICT (owner_id) DO NOTHING
  `).catch(() => {});
}
ensureFinancialCoreTables();

/* ════════════════════════════════════════════════
   PLATFORM DASHBOARD
════════════════════════════════════════════════ */
router.get("/fincore/dashboard", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    /* Revenue from payment_transactions */
    const revenue = await one(sql`
      SELECT
        COALESCE(SUM(amount),0)::numeric            AS total_revenue,
        COALESCE(SUM(platform_fee),0)::numeric      AS platform_profit,
        COALESCE(SUM(net_amount),0)::numeric        AS total_net,
        COUNT(*)::int                               AS total_transactions,
        COUNT(CASE WHEN status='completed' THEN 1 END)::int AS paid_count,
        COUNT(CASE WHEN status='pending'   THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN status='failed'    THEN 1 END)::int AS failed_count,
        COALESCE(SUM(CASE WHEN status='completed' AND (settlement_status IS NULL OR settlement_status='unsettled')
                          THEN net_amount ELSE 0 END),0)::numeric AS unsettled_net
      FROM payment_transactions
      WHERE office_id = ${tenantId}
    `);

    /* Pending payouts */
    const payoutStats = await one(sql`
      SELECT
        COUNT(*)::int                        AS pending_payouts,
        COALESCE(SUM(net_amount),0)::numeric AS pending_payout_amount
      FROM lawyer_payouts WHERE status = 'pending' AND office_id = ${tenantId}
    `);

    /* Monthly trend (last 6 months) */
    const monthly = await rows(sql`
      SELECT
        TO_CHAR(created_at,'YYYY-MM') AS month,
        COALESCE(SUM(amount),0)::numeric       AS revenue,
        COALESCE(SUM(platform_fee),0)::numeric AS profit,
        COALESCE(SUM(net_amount),0)::numeric   AS net,
        COUNT(*)::int                          AS count
      FROM payment_transactions
      WHERE created_at >= NOW() - INTERVAL '6 months' AND status='completed'
        AND office_id = ${tenantId}
      GROUP BY month ORDER BY month
    `);

    /* Gateway split */
    const byGateway = await rows(sql`
      SELECT COALESCE(gateway,'manual') AS gateway,
             COUNT(*)::int AS count,
             COALESCE(SUM(amount),0)::numeric AS total
      FROM payment_transactions WHERE status='completed' AND office_id = ${tenantId}
      GROUP BY gateway
    `);

    /* Wallet balances */
    const wallets = await rows(sql`SELECT * FROM wallets WHERE owner_id = ${tenantId} ORDER BY available_balance DESC LIMIT 10`);

    /* Ledger last 10 */
    const recentLedger = await rows(sql`
      SELECT * FROM ledger_entries WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 10
    `);

    const conversionRate = revenue?.total_transactions > 0
      ? Math.round((revenue.paid_count / revenue.total_transactions) * 100)
      : 0;

    res.json({
      kpi: {
        totalRevenue:       parseFloat(revenue?.total_revenue ?? 0),
        platformProfit:     parseFloat(revenue?.platform_profit ?? 0),
        totalNet:           parseFloat(revenue?.total_net ?? 0),
        totalTransactions:  revenue?.total_transactions ?? 0,
        paidCount:          revenue?.paid_count ?? 0,
        pendingCount:       revenue?.pending_count ?? 0,
        failedCount:        revenue?.failed_count ?? 0,
        unsettledNet:       parseFloat(revenue?.unsettled_net ?? 0),
        pendingPayouts:     payoutStats?.pending_payouts ?? 0,
        pendingPayoutAmount: parseFloat(payoutStats?.pending_payout_amount ?? 0),
        conversionRate,
      },
      monthly: monthly.map((m: any) => ({
        month: m.month, revenue: parseFloat(m.revenue), profit: parseFloat(m.profit),
        net: parseFloat(m.net), count: m.count,
      })),
      byGateway: byGateway.map((g: any) => ({ ...g, total: parseFloat(g.total) })),
      wallets,
      recentLedger,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════════════════════════════════
   LEDGER
════════════════════════════════════════════════ */
router.get("/fincore/ledger", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { limit = 100, offset = 0 } = req.query;
    const entries = await rows(sql`
      SELECT * FROM ledger_entries
      WHERE office_id = ${tenantId}
      ORDER BY created_at DESC
      LIMIT ${Number(limit)} OFFSET ${Number(offset)}
    `);
    const total = await one(sql`SELECT COUNT(*)::int AS count FROM ledger_entries WHERE office_id = ${tenantId}`);
    res.json({ entries, total: total?.count ?? 0 });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/fincore/ledger — create double-entry */
router.post("/fincore/ledger", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { debitAccount, creditAccount, amount, currency = "SAR", description, entryType = "payment", transactionRef } = req.body;
    if (!debitAccount || !creditAccount || !amount) return res.status(400).json({ error: "الحقول مطلوبة" });

    const [entry] = await rows(sql`
      INSERT INTO ledger_entries (office_id, transaction_ref, debit_account, credit_account, amount, currency, description, entry_type)
      VALUES (${tenantId}, ${transactionRef ?? null}, ${debitAccount}, ${creditAccount}, ${amount}, ${currency}, ${description ?? null}, ${entryType})
      RETURNING *
    `);

    /* Update account balances */
    await db.execute(sql`
      INSERT INTO financial_accounts (owner_id, owner_type, balance, currency)
      VALUES (${debitAccount}, 'office', 0, ${currency})
      ON CONFLICT (owner_id, currency) DO NOTHING
    `).catch(() => {});
    await db.execute(sql`
      INSERT INTO financial_accounts (owner_id, owner_type, balance, currency)
      VALUES (${creditAccount}, 'office', 0, ${currency})
      ON CONFLICT (owner_id, currency) DO NOTHING
    `).catch(() => {});

    await db.execute(sql`
      UPDATE financial_accounts SET balance = balance - ${amount}, updated_at = NOW()
      WHERE owner_id = ${debitAccount} AND currency = ${currency}
    `).catch(() => {});
    await db.execute(sql`
      UPDATE financial_accounts SET balance = balance + ${amount}, updated_at = NOW()
      WHERE owner_id = ${creditAccount} AND currency = ${currency}
    `).catch(() => {});

    res.json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════════════════════════════════
   WALLETS
════════════════════════════════════════════════ */
router.get("/fincore/wallets", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const wallets = await rows(sql`SELECT * FROM wallets WHERE owner_id = ${tenantId} ORDER BY available_balance DESC`);
    res.json(wallets);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* GET /api/fincore/wallets/:ownerId */
router.get("/fincore/wallets/:ownerId", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const ownerId = String(req.params.ownerId);
    if (ownerId !== tenantId) return res.status(403).json({ error: "غير مصرح" });
    const wallet = await one(sql`SELECT * FROM wallets WHERE owner_id = ${ownerId} LIMIT 1`);
    if (!wallet) return res.json({ owner_id: ownerId, available_balance: 0, pending_balance: 0 });
    res.json(wallet);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/fincore/wallets/credit — credit wallet */
router.post("/fincore/wallets/credit", requireAuthWithTenant, async (req, res) => {
  try {
    const { ownerId, ownerLabel, amount, type = "available" } = req.body;
    if (!ownerId || !amount) return res.status(400).json({ error: "المعطيات مطلوبة" });

    const col = type === "pending" ? "pending_balance" : "available_balance";
    await db.execute(sql`
      INSERT INTO wallets (owner_id, owner_label, available_balance, total_earned)
      VALUES (${ownerId}, ${ownerLabel ?? null}, 0, 0)
      ON CONFLICT (owner_id) DO NOTHING
    `).catch(() => {});

    if (col === "available_balance") {
      await db.execute(sql`
        UPDATE wallets SET available_balance = available_balance + ${amount}, total_earned = total_earned + ${amount}, updated_at = NOW()
        WHERE owner_id = ${ownerId}
      `);
    } else {
      await db.execute(sql`
        UPDATE wallets SET pending_balance = pending_balance + ${amount}, updated_at = NOW()
        WHERE owner_id = ${ownerId}
      `);
    }

    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════════════════════════════════
   PAYOUTS
════════════════════════════════════════════════ */
router.get("/fincore/payouts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { status } = req.query;
    const payouts = status
      ? await rows(sql`SELECT * FROM lawyer_payouts WHERE office_id = ${tenantId} AND status = ${status} ORDER BY created_at DESC LIMIT 100`)
      : await rows(sql`SELECT * FROM lawyer_payouts WHERE office_id = ${tenantId} ORDER BY created_at DESC LIMIT 100`);
    res.json(payouts);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/fincore/payouts — create payout */
router.post("/fincore/payouts", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { ownerLabel, amount, platformFee = 0, notes } = req.body;
    const officeId = tenantId;
    if (!amount) return res.status(400).json({ error: "المبلغ مطلوب" });

    const fee = parseFloat((amount * (platformFee / 100 || 0)).toFixed(2));
    const net = parseFloat((amount - fee).toFixed(2));

    const [payout] = await rows(sql`
      INSERT INTO lawyer_payouts (office_id, owner_label, amount, platform_fee, net_amount, notes)
      VALUES (${officeId}, ${ownerLabel ?? null}, ${amount}, ${fee}, ${net}, ${notes ?? null})
      RETURNING *
    `);
    res.json(payout);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* PATCH /api/fincore/payouts/:id/process — move to processing/sent */
router.patch("/fincore/payouts/:id/process", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    const { status = "processing", bankReference, provider = "manual" } = req.body;
    await db.execute(sql`
      UPDATE lawyer_payouts
      SET status = ${status},
          bank_reference = ${bankReference ?? null},
          provider = ${provider},
          processed_at = ${status === "sent" ? sql`NOW()` : sql`processed_at`},
          updated_at = NOW()
      WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/fincore/payouts/:id */
router.delete("/fincore/payouts/:id", requireAuthWithTenant, async (req, res) => {
  try {
    const tenantId = (req as any).tenantId as string;
    await db.execute(sql`
      DELETE FROM lawyer_payouts WHERE id = ${String(req.params.id)}::uuid AND office_id = ${tenantId}
    `);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* POST /api/fincore/settlement — daily settlement run */
router.post("/fincore/settlement", requireAuthWithTenant, async (req, res) => {
  try {
    const pending = await rows(sql`SELECT * FROM lawyer_payouts WHERE status = 'pending'`);
    const results: any[] = [];

    for (const p of pending) {
      /* In production: call actual bank/provider API here */
      await db.execute(sql`
        UPDATE lawyer_payouts
        SET status = 'sent', processed_at = NOW(), updated_at = NOW()
        WHERE id = ${p.id}::uuid
      `).catch(() => {});

      /* Update wallet */
      await db.execute(sql`
        UPDATE wallets
        SET available_balance = available_balance - ${p.net_amount},
            total_withdrawn = total_withdrawn + ${p.net_amount},
            updated_at = NOW()
        WHERE owner_id = ${p.office_id}
      `).catch(() => {});

      results.push({ id: p.id, office: p.office_id, amount: p.net_amount, status: "sent" });
    }

    /* Also settle payment_transactions */
    const txSettled = await rows(sql`
      UPDATE payment_transactions
      SET settlement_status = 'settled', settled_at = NOW(), updated_at = NOW()
      WHERE status = 'completed' AND (settlement_status IS NULL OR settlement_status = 'unsettled')
      RETURNING id
    `);

    res.json({ payoutsProcessed: results.length, transactionsSettled: txSettled.length, results });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════════════════════════════════
   PAYMENT ORCHESTRATOR API
════════════════════════════════════════════════ */
router.get("/fincore/providers", (_req, res) => {
  res.json(PaymentService.listProviders());
});

router.post("/fincore/pay", requireAuthWithTenant, async (req, res) => {
  try {
    const { provider = "stripe", ...data } = req.body;
    if (!data.amount) return res.status(400).json({ error: "المبلغ مطلوب" });
    const result = await PaymentService.createPayment(provider, data);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/fincore/refund", requireAuthWithTenant, async (req, res) => {
  try {
    const { provider = "stripe", paymentId, amount } = req.body;
    if (!paymentId) return res.status(400).json({ error: "معرف الدفعة مطلوب" });
    const result = await PaymentService.refund(provider, paymentId, amount);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

/* ════════════════════════════════════════════════
   REPORTS
════════════════════════════════════════════════ */
router.get("/fincore/reports", requireAuthWithTenant, async (req, res) => {
  try {
    const { period = "6m" } = req.query;
    const interval = period === "1y" ? "12 months" : period === "3m" ? "3 months" : "6 months";

    const monthly = await rows(sql`
      SELECT
        TO_CHAR(created_at,'YYYY-MM') AS month,
        COALESCE(SUM(amount),0)::numeric       AS gross,
        COALESCE(SUM(platform_fee),0)::numeric AS fees,
        COALESCE(SUM(net_amount),0)::numeric   AS net,
        COUNT(*)::int                          AS transactions,
        COUNT(CASE WHEN status='completed' THEN 1 END)::int AS paid,
        COUNT(CASE WHEN status='failed'    THEN 1 END)::int AS failed
      FROM payment_transactions
      WHERE created_at >= NOW() - INTERVAL '${sql.raw(interval)}'
      GROUP BY month ORDER BY month
    `);

    const byType = await rows(sql`
      SELECT
        COALESCE(payment_method, 'other') AS method,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount),0)::numeric AS total
      FROM payment_transactions WHERE status='completed'
      GROUP BY payment_method
    `);

    const topClients = await rows(sql`
      SELECT
        COALESCE(client_name, 'غير محدد') AS name,
        COUNT(*)::int AS transactions,
        COALESCE(SUM(amount),0)::numeric AS total
      FROM payment_transactions WHERE status='completed'
      GROUP BY client_name ORDER BY total DESC LIMIT 10
    `);

    const summary = await one(sql`
      SELECT
        COALESCE(SUM(amount),0)::numeric       AS gross,
        COALESCE(SUM(platform_fee),0)::numeric AS fees,
        COALESCE(SUM(net_amount),0)::numeric   AS net,
        AVG(amount)::numeric                   AS avg_transaction,
        COUNT(*)::int                          AS total
      FROM payment_transactions WHERE status='completed'
    `);

    res.json({
      period,
      monthly: monthly.map((m: any) => ({
        ...m, gross: parseFloat(m.gross), fees: parseFloat(m.fees), net: parseFloat(m.net),
      })),
      byType: byType.map((t: any) => ({ ...t, total: parseFloat(t.total) })),
      topClients: topClients.map((c: any) => ({ ...c, total: parseFloat(c.total) })),
      summary: summary ? {
        gross: parseFloat(summary.gross), fees: parseFloat(summary.fees), net: parseFloat(summary.net),
        avgTransaction: parseFloat(summary.avg_transaction ?? 0), total: summary.total,
      } : null,
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
